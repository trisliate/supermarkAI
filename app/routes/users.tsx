import { useFetcher, useNavigation } from "react-router";
import { useState, useEffect, useMemo } from "react";
import type { Route } from "./+types/users";
import { requireRole } from "~/lib/auth.server";
import { roleLabels } from "~/lib/auth";
import { db } from "~/lib/db.server";
import { AppLayout } from "~/components/layout/app-layout";

import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { PageSkeleton } from "~/components/ui/page-skeleton";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "~/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Plus, Pencil, Trash2, Users, Search, Loader2, UserCog } from "lucide-react";
import { toast } from "sonner";
import type { Role } from "@prisma/client";
import { DataTablePagination } from "~/components/ui/data-table-pagination";

const PAGE_SIZE = 20;

const roleBadgeVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  admin: "destructive",
  purchaser: "secondary",
  inventory_keeper: "default",
  cashier: "outline",
};

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireRole(request, ["admin"]);
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const [total, users] = await Promise.all([
    db.user.count(),
    db.user.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, username: true, name: true, role: true, createdAt: true },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);
  return { user, users, total, page, pageSize: PAGE_SIZE };
}

export async function action({ request }: Route.ActionArgs) {
  await requireRole(request, ["admin"]);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "delete") {
    const id = Number(formData.get("id"));
    await db.user.delete({ where: { id } });
    return { ok: true, intent: "delete" };
  }

  if (intent === "update") {
    const id = Number(formData.get("id"));
    const name = formData.get("name") as string;
    const role = formData.get("role") as Role;
    const password = formData.get("password") as string;

    const data: { name: string; role: Role; password?: string } = { name, role };
    if (password) {
      const bcrypt = await import("bcryptjs");
      data.password = await bcrypt.hash(password, 10);
    }

    await db.user.update({ where: { id }, data });
    return { ok: true, intent: "update" };
  }

  if (intent === "create") {
    const username = formData.get("username") as string;
    const password = formData.get("password") as string;
    const name = formData.get("name") as string;
    const role = formData.get("role") as Role;

    if (!username || !password || !name || !role) {
      return { error: "所有字段都必填", intent: "create" };
    }

    const exists = await db.user.findUnique({ where: { username } });
    if (exists) return { error: "用户名已存在", intent: "create" };

    const bcrypt = await import("bcryptjs");
    const hashed = await bcrypt.hash(password, 10);
    await db.user.create({ data: { username, password: hashed, name, role } });
    return { ok: true, intent: "create" };
  }

  return { ok: false };
}

export default function UsersPage({ loaderData }: Route.ComponentProps) {
  const { user, users, total, page, pageSize } = loaderData;
  const fetcher = useFetcher();
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editUser, setEditUser] = useState<typeof users[number] | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const isDeleting = fetcher.state !== "idle";
  const isSaving = fetcher.state !== "idle";
  const navigation = useNavigation();
  const isLoading = navigation.state === "loading" && navigation.location?.pathname === "/users";

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      if (fetcher.data.ok && fetcher.data.intent === "delete") {
        toast.success("用户已删除");
        setDeleteId(null);
      } else if (fetcher.data.ok && fetcher.data.intent === "update") {
        toast.success("用户已更新");
        setEditUser(null);
      } else if (fetcher.data.ok && fetcher.data.intent === "create") {
        toast.success("用户创建成功");
        setShowNew(false);
      } else if (fetcher.data.error) {
        toast.error(fetcher.data.error);
      }
    }
  }, [fetcher.state, fetcher.data]);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const matchSearch = !search || u.name.includes(search) || u.username.includes(search);
      const matchRole = roleFilter === "all" || u.role === roleFilter;
      return matchSearch && matchRole;
    });
  }, [users, search, roleFilter]);

  return (
    <AppLayout
      user={user}
      description="管理系统用户和权限"
    >
      {isLoading ? <PageSkeleton columns={6} rows={6} /> : (
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <div></div>
          <Button onClick={() => setShowNew(true)}>
            <Plus className="size-4" /> 新增用户
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <Input placeholder="搜索用户名或姓名..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
          </div>
          <Tabs value={roleFilter} onValueChange={setRoleFilter}>
            <TabsList className="h-9">
              <TabsTrigger value="all" className="text-xs">全部</TabsTrigger>
              <TabsTrigger value="admin" className="text-xs">店长</TabsTrigger>
              <TabsTrigger value="purchaser" className="text-xs">采购</TabsTrigger>
              <TabsTrigger value="inventory_keeper" className="text-xs">理货员</TabsTrigger>
              <TabsTrigger value="cashier" className="text-xs">收银员</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">ID</TableHead>
                  <TableHead>用户名</TableHead>
                  <TableHead>姓名</TableHead>
                  <TableHead>角色</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      <Users className="size-8 mx-auto mb-2 opacity-50" />
                      {search || roleFilter !== "all" ? "没有匹配的用户" : "暂无用户数据"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-mono text-muted-foreground">{u.id}</TableCell>
                      <TableCell className="font-medium">{u.username}</TableCell>
                      <TableCell>{u.name}</TableCell>
                      <TableCell><Badge variant={roleBadgeVariant[u.role] || "default"}>{roleLabels[u.role]}</Badge></TableCell>
                      <TableCell className="text-muted-foreground">{new Date(u.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setEditUser(u)}>
                            <Pencil className="size-3.5" /> 编辑
                          </Button>
                          {u.id !== user.id && (
                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteId(u.id)}>
                              <Trash2 className="size-3.5" /> 删除
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <DataTablePagination totalPages={Math.ceil(total / pageSize)} currentPage={page} />
      </div>
      )}

      {/* New User Dialog */}
      <Dialog open={showNew} onOpenChange={(open) => { if (!open) setShowNew(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="size-4" /> 新增用户
            </DialogTitle>
            <DialogDescription>创建新的系统用户</DialogDescription>
          </DialogHeader>
          <fetcher.Form method="post" className="space-y-4">
            <input type="hidden" name="intent" value="create" />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="new-username">用户名</Label>
                <Input id="new-username" name="username" required placeholder="登录用户名" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-password">密码</Label>
                <Input id="new-password" name="password" type="password" required placeholder="登录密码" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="new-name">姓名</Label>
                <Input id="new-name" name="name" required placeholder="真实姓名" />
              </div>
              <div className="space-y-1.5">
                <Label>角色</Label>
                <Select name="role" required>
                  <SelectTrigger className="w-full"><SelectValue placeholder="选择角色" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(roleLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
                {isSaving ? "创建中..." : "创建用户"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowNew(false)}>取消</Button>
            </div>
          </fetcher.Form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editUser !== null} onOpenChange={(open) => { if (!open) setEditUser(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="size-4" /> 编辑用户
            </DialogTitle>
            <DialogDescription>修改用户信息和权限</DialogDescription>
          </DialogHeader>
          {editUser && (
            <fetcher.Form method="post" className="space-y-4">
              <input type="hidden" name="intent" value="update" />
              <input type="hidden" name="id" value={editUser.id} />
              <div className="space-y-1.5">
                <Label>用户名</Label>
                <Input value={editUser.username} disabled />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-name">姓名</Label>
                <Input id="edit-name" name="name" defaultValue={editUser.name} required />
              </div>
              <div className="space-y-1.5">
                <Label>角色</Label>
                <Select name="role" required defaultValue={editUser.role}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(roleLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-password">新密码（留空不修改）</Label>
                <Input id="edit-password" name="password" type="password" placeholder="留空则不修改" />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
                  {isSaving ? "保存中..." : "保存"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setEditUser(null)}>取消</Button>
              </div>
            </fetcher.Form>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => { if (!open) setDeleteId(null); }}
        title="删除用户"
        description="确定要删除该用户吗？此操作不可撤销。"
        confirmText="删除"
        loading={isDeleting}
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
