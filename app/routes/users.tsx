import { Link, useFetcher } from "react-router";
import type { Route } from "./+types/users";
import { requireRole } from "~/lib/auth.server";
import { roleLabels } from "~/lib/auth";
import { db } from "~/lib/db.server";
import { AppLayout } from "~/components/layout/app-layout";
import { Card, CardContent } from "~/components/ui/card";
import { Button, buttonVariants } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Plus, Pencil, Trash2, Users } from "lucide-react";

const roleBadgeVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  admin: "destructive",
  purchaser: "secondary",
  inventory_keeper: "default",
  cashier: "outline",
};

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireRole(request, ["admin"]);
  const users = await db.user.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, username: true, name: true, role: true, createdAt: true },
  });
  return { user, users };
}

export async function action({ request }: Route.ActionArgs) {
  await requireRole(request, ["admin"]);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "delete") {
    const id = Number(formData.get("id"));
    await db.user.delete({ where: { id } });
  }

  return { ok: true };
}

export default function UsersPage({ loaderData }: Route.ComponentProps) {
  const { user, users } = loaderData;
  const fetcher = useFetcher();

  return (
    <AppLayout user={user}>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">用户管理</h2>
            <p className="text-sm text-muted-foreground mt-1">管理系统用户和权限</p>
          </div>
          <Link to="/users/new" className={cn(buttonVariants())}>
            <Plus className="size-4" />
            新增用户
          </Link>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-16">ID</TableHead>
                  <TableHead>用户名</TableHead>
                  <TableHead>姓名</TableHead>
                  <TableHead>角色</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      <Users className="size-8 mx-auto mb-2 opacity-50" />
                      暂无用户数据
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-mono text-muted-foreground">{u.id}</TableCell>
                      <TableCell className="font-medium">{u.username}</TableCell>
                      <TableCell>{u.name}</TableCell>
                      <TableCell>
                        <Badge variant={roleBadgeVariant[u.role] || "default"}>
                          {roleLabels[u.role]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link to={`/users/${u.id}/edit`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
                            <Pencil className="size-3.5" />
                            编辑
                          </Link>
                          {u.id !== user.id && (
                            <fetcher.Form method="post" className="inline">
                              <input type="hidden" name="intent" value="delete" />
                              <input type="hidden" name="id" value={u.id} />
                              <Button
                                variant="ghost"
                                size="sm"
                                type="submit"
                                className="text-destructive hover:text-destructive"
                                onClick={(e) => { if (!confirm("确定删除该用户？")) e.preventDefault(); }}
                              >
                                <Trash2 className="size-3.5" />
                                删除
                              </Button>
                            </fetcher.Form>
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
      </div>
    </AppLayout>
  );
}
