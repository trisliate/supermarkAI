import { useFetcher, useLoaderData } from "react-router";
import { useState, useEffect } from "react";
import type { Route } from "./+types/notifications";
import { requireRole } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { AppLayout } from "~/components/layout/app-layout";

import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Badge } from "~/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "~/components/ui/dialog";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { Bell, Plus, Trash2, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

const typeLabels: Record<string, string> = {
  system: "系统通知",
  stock_alert: "库存预警",
  purchase_status: "采购状态",
  sale_milestone: "销售里程碑",
};

const typeColors: Record<string, string> = {
  system: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  stock_alert: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  purchase_status: "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400",
  sale_milestone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
};

const roleOptions = [
  { value: "all", label: "所有角色" },
  { value: "admin", label: "店长" },
  { value: "purchaser", label: "采购" },
  { value: "inventory_keeper", label: "理货员" },
  { value: "cashier", label: "收银员" },
];

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireRole(request, ["admin"]);
  const notifications = await db.notification.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return { user, notifications };
}

export async function action({ request }: Route.ActionArgs) {
  await requireRole(request, ["admin"]);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    const title = formData.get("title") as string;
    const content = formData.get("content") as string;
    const type = formData.get("type") as string;
    const targetRole = formData.get("targetRole") as string;

    if (!title || !content) return { error: "标题和内容不能为空", intent: "create" };

    await db.notification.create({
      data: {
        title,
        content,
        type: (type || "system") as "system" | "stock_alert" | "purchase_status" | "sale_milestone",
        targetRole: targetRole && targetRole !== "all" ? targetRole as "admin" | "purchaser" | "inventory_keeper" | "cashier" : null,
      },
    });
    return { ok: true, intent: "create" };
  }

  if (intent === "delete") {
    const id = Number(formData.get("id"));
    await db.notification.delete({ where: { id } });
    return { ok: true, intent: "delete" };
  }

  return { ok: false };
}

export default function NotificationsPage({ loaderData }: Route.ComponentProps) {
  const { user, notifications } = loaderData;
  const fetcher = useFetcher();
  const [showNew, setShowNew] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const isSaving = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      if (fetcher.data.error) {
        toast.error(fetcher.data.error);
      } else if (fetcher.data.ok) {
        if (fetcher.data.intent === "create") {
          toast.success("通知已发送");
          setShowNew(false);
        } else if (fetcher.data.intent === "delete") {
          toast.success("通知已删除");
          setDeleteId(null);
        }
      }
    }
  }, [fetcher.state, fetcher.data]);

  return (
    <AppLayout
      user={user}
      description="发送和管理系统通知"
    >
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <div></div>
          <Button onClick={() => setShowNew(true)}>
            <Plus className="size-4" /> 发送通知
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {notifications.length === 0 ? (
              <div className="h-32 flex flex-col items-center justify-center text-slate-400">
                <Bell className="size-8 mb-2 opacity-50" />
                <p className="text-sm">暂无通知</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {notifications.map((n) => (
                  <div key={n.id} className="flex items-start gap-3 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <Send className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{n.title}</span>
                        <Badge variant="secondary" className={`text-[10px] ${typeColors[n.type] || ""}`}>
                          {typeLabels[n.type] || n.type}
                        </Badge>
                        {n.targetRole && (
                          <span className="text-[10px] text-slate-400">
                            → {roleOptions.find((r) => r.value === n.targetRole)?.label || n.targetRole}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{n.content}</p>
                      <p className="text-[10px] text-slate-300 dark:text-slate-600 mt-1">
                        {new Date(n.createdAt).toLocaleString("zh-CN")}
                      </p>
                    </div>
                    <Button
                      variant="ghost" size="sm"
                      className="shrink-0 text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(n.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* New notification dialog */}
      <Dialog open={showNew} onOpenChange={(open) => { if (!open) setShowNew(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="size-4" /> 发送通知
            </DialogTitle>
            <DialogDescription>创建一条新通知，发送给指定角色的用户</DialogDescription>
          </DialogHeader>
          <fetcher.Form method="post" className="space-y-4">
            <input type="hidden" name="intent" value="create" />
            <div className="space-y-1.5">
              <Label htmlFor="notif-title">标题</Label>
              <Input id="notif-title" name="title" required placeholder="通知标题" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notif-content">内容</Label>
              <Textarea id="notif-content" name="content" required placeholder="通知内容..." className="min-h-[80px]" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>类型</Label>
                <Select name="type" defaultValue="system">
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="system">系统通知</SelectItem>
                    <SelectItem value="stock_alert">库存预警</SelectItem>
                    <SelectItem value="purchase_status">采购状态</SelectItem>
                    <SelectItem value="sale_milestone">销售里程碑</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>目标角色</Label>
                <Select name="targetRole" defaultValue="all">
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
                {isSaving ? "发送中..." : "发送通知"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowNew(false)}>取消</Button>
            </div>
          </fetcher.Form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => { if (!open) setDeleteId(null); }}
        title="删除通知"
        description="确定要删除该通知吗？此操作不可撤销。"
        confirmText="删除"
        loading={isSaving}
        onConfirm={() => {
          if (deleteId === null) return;
          const fd = new FormData();
          fd.set("intent", "delete");
          fd.set("id", String(deleteId));
          fetcher.submit(fd, { method: "post" });
        }}
      />
    </AppLayout>
  );
}
