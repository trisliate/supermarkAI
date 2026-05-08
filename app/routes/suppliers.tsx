import { Link, useFetcher } from "react-router";
import type { Route } from "./+types/suppliers";
import { requireRole } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { AppLayout } from "~/components/layout/app-layout";
import { Card, CardContent } from "~/components/ui/card";
import { Button, buttonVariants } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Plus, Pencil, Trash2, Truck } from "lucide-react";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireRole(request, ["admin", "purchaser"]);
  const suppliers = await db.supplier.findMany({ orderBy: { name: "asc" } });
  return { user, suppliers };
}

export async function action({ request }: Route.ActionArgs) {
  await requireRole(request, ["admin"]);
  const formData = await request.formData();
  if (formData.get("intent") === "delete") {
    await db.supplier.delete({ where: { id: Number(formData.get("id")) } });
  }
  return { ok: true };
}

export default function SuppliersPage({ loaderData }: Route.ComponentProps) {
  const { user, suppliers } = loaderData;
  const fetcher = useFetcher();

  return (
    <AppLayout user={user}>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">供应商管理</h2>
            <p className="text-sm text-muted-foreground mt-1">管理供应商信息</p>
          </div>
          <Link to="/suppliers/new" className={cn(buttonVariants({}))}>
            <Plus className="size-4" />
            新增供应商
          </Link>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-16">ID</TableHead>
                  <TableHead>名称</TableHead>
                  <TableHead>联系人</TableHead>
                  <TableHead>电话</TableHead>
                  <TableHead>地址</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      <Truck className="size-8 mx-auto mb-2 opacity-50" />
                      暂无供应商数据
                    </TableCell>
                  </TableRow>
                ) : (
                  suppliers.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-muted-foreground">{s.id}</TableCell>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>{s.contact}</TableCell>
                      <TableCell>{s.phone}</TableCell>
                      <TableCell className="text-muted-foreground">{s.address || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={s.status === "active" ? "default" : "secondary"}>
                          {s.status === "active" ? "合作中" : "已停用"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link to={`/suppliers/${s.id}/edit`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
                            <Pencil className="size-3.5" />
                            编辑
                          </Link>
                          {user.role === "admin" && (
                            <fetcher.Form method="post" className="inline">
                              <input type="hidden" name="intent" value="delete" />
                              <input type="hidden" name="id" value={s.id} />
                              <Button
                                variant="ghost"
                                size="sm"
                                type="submit"
                                className="text-destructive hover:text-destructive"
                                onClick={(e) => { if (!confirm("确定删除？")) e.preventDefault(); }}
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
