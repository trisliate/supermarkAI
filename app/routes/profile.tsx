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
import { User, Lock, Loader2, CheckCircle } from "lucide-react";
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
  const fullUser = await db.user.findUnique({
    where: { id: user.id },
    select: { id: true, username: true, name: true, role: true, createdAt: true, avatar: true },
  });
  return { user, fullUser: fullUser ? { ...fullUser, hasAvatar: fullUser.avatar !== null } : null };
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

export default function ProfilePage({ loaderData }: Route.ComponentProps) {
  const { user, fullUser } = loaderData;
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

  return (
    <AppLayout user={user}>
      <FormPage
        icon={User}
        title="个人信息"
        subtitle="管理您的账户信息"
      >
        <FormSection icon={User} title="基本信息">
          <div className="flex items-center gap-4">
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

          <fetcher.Form method="post" className="flex gap-3 items-end">
            <input type="hidden" name="intent" value="updateName" />
            <div className="flex-1 space-y-2">
              <Label htmlFor="name">姓名</Label>
              <Input id="name" name="name" defaultValue={fullUser.name} required />
            </div>
            <Button type="submit" disabled={isSaving} className="shrink-0">
              {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
              保存
            </Button>
          </fetcher.Form>

          <div className="text-xs text-slate-400">
            注册时间：{new Date(fullUser.createdAt).toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })}
          </div>
        </FormSection>

        <FormSection icon={Lock} title="修改密码">
          <fetcher.Form method="post" className="space-y-4">
            <input type="hidden" name="intent" value="changePassword" />
            <div className="space-y-2">
              <Label htmlFor="currentPassword">当前密码</Label>
              <Input id="currentPassword" name="currentPassword" type="password" required placeholder="请输入当前密码" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">新密码</Label>
                <Input id="newPassword" name="newPassword" type="password" required placeholder="至少6位" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">确认新密码</Label>
                <Input id="confirmPassword" name="confirmPassword" type="password" required placeholder="再次输入新密码" />
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
        </FormSection>
      </FormPage>
    </AppLayout>
  );
}
