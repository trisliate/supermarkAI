import { Link, useFetcher } from "react-router";
import type { Route } from "./+types/purchases";
import { requireRole } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { AppLayout } from "~/components/layout/app-layout";
import { Card, CardContent } from "~/components/ui/card";
import { Button, buttonVariants } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Plus, Eye, CheckCircle, XCircle, ShoppingCart } from "lucide-react";

const statusLabels: Record<string, string> = {
  pending: "待审批",
  approved: "已审批",
  received: "已入库",
  cancelled: "已取消",
};

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  approved: "secondary",
  received: "default",
  cancelled: "destructive",
};

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireRole(request, ["admin", "purchaser"]);
  const purchases = await db.purchaseOrder.findMany({
    include: { supplier: true, user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return { user, purchases };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireRole(request, ["admin", "purchaser"]);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const id = Number(formData.get("id"));

  if (intent === "approve" && user.role === "admin") {
    await db.purchaseOrder.update({ where: { id }, data: { status: "approved" } });
  } else if (intent === "cancel") {
    await db.purchaseOrder.update({ where: { id }, data: { status: "cancelled" } });
  }

  return { ok: true };
}

export default function PurchasesPage({ loaderData }: Route.ComponentProps) {
  const { user, purchases } = loaderData;
  const fetcher = useFetcher();

  return (
    <AppLayout user={user}>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">采购管理</h2>
            <p className="text-sm text-muted-foreground mt-1">管理采购订单</p>
          </div>
          <Link to="/purchases/new" className={cn(buttonVariants({}))}>
            <Plus className="size-4" />
            新建采购单
          </Link>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>单号</TableHead>
                  <TableHead>供应商</TableHead>
                  <TableHead>采购员</TableHead>
                  <TableHead>总金额</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchases.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      <ShoppingCart className="size-8 mx-auto mb-2 opacity-50" />
                      暂无采购数据
                    </TableCell>
                  </TableRow>
                ) : (
                  purchases.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono">PO-{String(p.id).padStart(4, "0")}</TableCell>
                      <TableCell className="font-medium">{p.supplier.name}</TableCell>
                      <TableCell>{p.user.name}</TableCell>
                      <TableCell>¥{Number(p.totalAmount).toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[p.status] || "default"}>
                          {statusLabels[p.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(p.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link to={`/purchases/${p.id}`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
                            <Eye className="size-3.5" />
                            详情
                          </Link>
                          {p.status === "pending" && user.role === "admin" && (
                            <fetcher.Form method="post" className="inline">
                              <input type="hidden" name="intent" value="approve" />
                              <input type="hidden" name="id" value={p.id} />
                              <Button variant="ghost" size="sm" type="submit" className="text-green-600 hover:text-green-600">
                                <CheckCircle className="size-3.5" />
                                审批
                              </Button>
                            </fetcher.Form>
                          )}
                          {p.status === "pending" && (
                            <fetcher.Form method="post" className="inline">
                              <input type="hidden" name="intent" value="cancel" />
                              <input type="hidden" name="id" value={p.id} />
                              <Button
                                variant="ghost"
                                size="sm"
                                type="submit"
                                className="text-destructive hover:text-destructive"
                                onClick={(e) => { if (!confirm("确定取消？")) e.preventDefault(); }}
                              >
                                <XCircle className="size-3.5" />
                                取消
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
