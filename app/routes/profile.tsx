import { useFetcher } from "react-router";
import { useState, useEffect } from "react";
import type { Route } from "./+types/profile";
import { requireUser } from "~/lib/auth.server";
import { roleLabels } from "~/lib/auth";
import { db } from "~/lib/db.server";
import { AppLayout } from "~/components/layout/app-layout";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/badge";
import { AvatarUpload } from "~/components/ui/avatar-upload";
import { User, Lock, Loader2, CheckCircle, ShoppingCart, Receipt, Shield, Activity } from "lucide-react";
import { FormPage } from "~/components/ui/form-page";
import { FormSection } from "~/components/ui/form-section";
import { toast } from "sonner";
import bcrypt from "bcryptjs";

const roleColors: Record<string, string> = {
  admin: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800",
  purchaser: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800",
  inventory_keeper: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/30 dark:text-teal-400 dark:border-teal-800",
  cashier: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-800",
};

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const { loadRoutePermissions } = await import("~/lib/permissions.server");
  const routePermissions = await loadRoutePermissions();
  const fullUser = await db.user.findUnique({
    where: { id: user.id },
    select: { id: true, username: true, name: true, role: true, createdAt: true, avatar: true },
  });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [purchaseCount, salesCount, monthlyOps, recentLogs] = await Promise.all([
    db.purchaseOrder.count({ where: { userId: user.id } }),
    db.saleOrder.count({ where: { userId: user.id } }),
    db.inventoryLog.count({ where: { userId: user.id, createdAt: { gte: monthStart } } }),
    db.inventoryLog.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { product: { select: { name: true } } },
    }),
  ]);

  return {
    user,
    fullUser: fullUser ? { ...fullUser, hasAvatar: fullUser.avatar !== null } : null,
    stats: { purchaseCount, salesCount, monthlyOps },
    recentLogs,
    routePermissions,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "updateName") {
    const name = formData.get("name") as string;
    if (!name) return { error: "姓名不能为空" };
    await db.user.update({ where: { id: user.id }, data: { name } });
    return { ok: true, intent: "updateName" };
  }

  if (intent === "changePassword") {
    const currentPassword = formData.get("currentPassword") as string;
    const newPassword = formData.get("newPassword") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (!currentPassword || !newPassword) return { error: "请填写所有密码字段", intent: "changePassword" };
    if (newPassword !== confirmPassword) return { error: "两次输入的新密码不一致", intent: "changePassword" };
    if (newPassword.length < 6) return { error: "新密码至少6位", intent: "changePassword" };

    const fullUser = await db.user.findUnique({ where: { id: user.id } });
    if (!fullUser) return { error: "用户不存在", intent: "changePassword" };

    const valid = await bcrypt.compare(currentPassword, fullUser.password);
    if (!valid) return { error: "当前密码错误", intent: "changePassword" };

    const hashed = await bcrypt.hash(newPassword, 10);
    await db.user.update({ where: { id: user.id }, data: { password: hashed } });
    return { ok: true, intent: "changePassword" };
  }

  if (intent === "updateAvatar") {
    const dataUrl = formData.get("avatar") as string;
    if (!dataUrl || !dataUrl.startsWith("data:image/")) return { error: "无效的图片数据", intent: "updateAvatar" };
    const base64 = dataUrl.split(",")[1];
    const buffer = Buffer.from(base64, "base64");
    await db.user.update({ where: { id: user.id }, data: { avatar: buffer } });
    return { ok: true, intent: "updateAvatar" };
  }

  if (intent === "removeAvatar") {
    await db.user.update({ where: { id: user.id }, data: { avatar: null } });
    return { ok: true, intent: "removeAvatar" };
  }

  return { ok: false };
}

const rolePermissions: Record<string, { title: string; perms: string[] }> = {
  admin: { title: "店长 — 全功能管理", perms: ["用户管理", "商品管理", "分类管理", "供应商管理", "采购管理", "库存管理", "销售管理", "AI 助手", "通知管理", "系统配置"] },
  purchaser: { title: "采购 — 供应链管理", perms: ["商品查看", "供应商管理", "采购管理", "库存查看", "AI 补货建议"] },
  inventory_keeper: { title: "理货员 — 库存管理", perms: ["商品管理", "库存管理", "出入库操作", "库存预警查看"] },
  cashier: { title: "收银员 — 销售收银", perms: ["收银台操作", "销售记录查看", "热销分析"] },
};

export default function ProfilePage({ loaderData }: Route.ComponentProps) {
  const { user, fullUser, stats, recentLogs } = loaderData;
  const fetcher = useFetcher();
  const [pwSuccess, setPwSuccess] = useState(false);
  const isSaving = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      if (fetcher.data.error) {
        toast.error(fetcher.data.error);
      } else if (fetcher.data.ok) {
        if (fetcher.data.intent === "updateName") {
          toast.success("姓名已更新");
        } else if (fetcher.data.intent === "changePassword") {
          toast.success("密码已修改");
          setPwSuccess(true);
          setTimeout(() => setPwSuccess(false), 3000);
        } else if (fetcher.data.intent === "updateAvatar") {
          toast.success("头像已更新");
        } else if (fetcher.data.intent === "removeAvatar") {
          toast.success("头像已移除");
        }
      }
    }
  }, [fetcher.state, fetcher.data]);

  const handleAvatarUpload = (dataUrl: string) => {
    const fd = new FormData();
    fd.set("intent", "updateAvatar");
    fd.set("avatar", dataUrl);
    fetcher.submit(fd, { method: "post" });
  };

  const handleAvatarRemove = () => {
    const fd = new FormData();
    fd.set("intent", "removeAvatar");
    fetcher.submit(fd, { method: "post" });
  };

  if (!fullUser) return null;

  const permInfo = rolePermissions[fullUser.role] || rolePermissions.admin;
  const logTypeLabel: Record<string, string> = { IN: "入库", OUT: "出库" };
  const logTypeColor: Record<string, string> = {
    IN: "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/30",
    OUT: "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950/30",
  };

  return (
    <AppLayout user={user} routePermissions={loaderData.routePermissions}>
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Top: Profile + Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Profile card */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
              <div className="flex items-center gap-4 mb-4">
                <AvatarUpload
                  user={{ name: fullUser.name, hasAvatar: fullUser.hasAvatar, id: fullUser.id }}
                  onUpload={handleAvatarUpload}
                  onRemove={handleAvatarRemove}
                  isSaving={isSaving}
                />
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{fullUser.name}</h3>
                  <p className="text-sm text-slate-500">@{fullUser.username}</p>
                  <Badge variant="outline" className={`mt-1 ${roleColors[fullUser.role as keyof typeof roleColors] || ""}`}>
                    {roleLabels[fullUser.role]}
                  </Badge>
                </div>
              </div>
              <div className="text-xs text-slate-400 dark:text-slate-500">
                注册时间：{new Date(fullUser.createdAt).toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })}
              </div>
            </div>

            {/* Role permissions */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{permInfo.title}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {permInfo.perms.map((p) => (
                  <span key={p} className="px-2 py-0.5 text-[11px] rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Name edit + Password */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
              <div className="flex items-center gap-2 mb-4">
                <User className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-medium text-slate-800 dark:text-slate-200">编辑资料</span>
              </div>
              <fetcher.Form method="post" className="flex gap-3 items-end">
                <input type="hidden" name="intent" value="updateName" />
                <div className="flex-1 space-y-2">
                  <Label htmlFor="name" className="text-xs text-slate-500">姓名</Label>
                  <Input id="name" name="name" defaultValue={fullUser.name} required />
                </div>
                <Button type="submit" disabled={isSaving} className="shrink-0">
                  {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
                  保存
                </Button>
              </fetcher.Form>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Lock className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-medium text-slate-800 dark:text-slate-200">修改密码</span>
              </div>
              <fetcher.Form method="post" className="space-y-3">
                <input type="hidden" name="intent" value="changePassword" />
                <div className="space-y-2">
                  <Label htmlFor="currentPassword" className="text-xs text-slate-500">当前密码</Label>
                  <Input id="currentPassword" name="currentPassword" type="password" required placeholder="请输入当前密码" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="newPassword" className="text-xs text-slate-500">新密码</Label>
                    <Input id="newPassword" name="newPassword" type="password" required placeholder="至少6位" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-xs text-slate-500">确认新密码</Label>
                    <Input id="confirmPassword" name="confirmPassword" type="password" required placeholder="再次输入" />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
                    修改密码
                  </Button>
                  {pwSuccess && (
                    <span className="flex items-center gap-1 text-sm text-emerald-600">
                      <CheckCircle className="size-4" /> 密码已修改
                    </span>
                  )}
                </div>
              </fetcher.Form>
            </div>
          </div>
        </div>

        {/* Statistics cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center shrink-0">
              <ShoppingCart className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.purchaseCount}</p>
              <p className="text-xs text-slate-500">我的采购单</p>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center shrink-0">
              <Receipt className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.salesCount}</p>
              <p className="text-xs text-slate-500">我的销售单</p>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-950/30 flex items-center justify-center shrink-0">
              <Activity className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.monthlyOps}</p>
              <p className="text-xs text-slate-500">本月操作次数</p>
            </div>
          </div>
        </div>

        {/* Recent activity */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-medium text-slate-800 dark:text-slate-200">最近操作记录</span>
          </div>
          {recentLogs.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-6">暂无操作记录</p>
          ) : (
            <div className="space-y-2">
              {recentLogs.map((log) => (
                <div key={log.id} className="flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <span className={`px-2 py-0.5 text-[11px] font-medium rounded-full ${logTypeColor[log.type] || "bg-slate-100 text-slate-600"}`}>
                    {logTypeLabel[log.type] || log.type}
                  </span>
                  <span className="text-sm text-slate-700 dark:text-slate-300 flex-1 truncate">{log.product.name}</span>
                  <span className="text-sm font-medium text-slate-900 dark:text-white">
                    {log.type === "OUT" ? "-" : "+"}{log.quantity}
                  </span>
                  <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">
                    {new Date(log.createdAt).toLocaleDateString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
