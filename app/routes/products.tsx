import { Link, useFetcher } from "react-router";
import type { Route } from "./+types/products";
import { requireRole } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { AppLayout } from "~/components/layout/app-layout";
import { Card, CardContent } from "~/components/ui/card";
import { Button, buttonVariants } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Plus, Pencil, Trash2, Package } from "lucide-react";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireRole(request, ["admin"]);
  const products = await db.product.findMany({
    include: { category: true, inventory: true },
    orderBy: { createdAt: "desc" },
  });
  return { user, products };
}

export async function action({ request }: Route.ActionArgs) {
  await requireRole(request, ["admin"]);
  const formData = await request.formData();
  if (formData.get("intent") === "delete") {
    const id = Number(formData.get("id"));
    await db.product.delete({ where: { id } });
  }
  return { ok: true };
}

export default function ProductsPage({ loaderData }: Route.ComponentProps) {
  const { user, products } = loaderData;
  const fetcher = useFetcher();

  return (
    <AppLayout user={user}>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">商品管理</h2>
            <p className="text-sm text-muted-foreground mt-1">管理商品信息和库存</p>
          </div>
          <Link to="/products/new" className={cn(buttonVariants({}))}>
            <Plus className="size-4" />
            新增商品
          </Link>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-16">ID</TableHead>
                  <TableHead>名称</TableHead>
                  <TableHead>分类</TableHead>
                  <TableHead>单价</TableHead>
                  <TableHead>单位</TableHead>
                  <TableHead>库存</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                      <Package className="size-8 mx-auto mb-2 opacity-50" />
                      暂无商品数据
                    </TableCell>
                  </TableRow>
                ) : (
                  products.map((p) => {
                    const stock = p.inventory?.quantity ?? 0;
                    const isLow = stock < 10;
                    return (
                      <TableRow key={p.id} className={isLow ? "bg-red-50/50" : ""}>
                        <TableCell className="font-mono text-muted-foreground">{p.id}</TableCell>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell>{p.category.name}</TableCell>
                        <TableCell>¥{Number(p.price).toFixed(2)}</TableCell>
                        <TableCell>{p.unit}</TableCell>
                        <TableCell>
                          <span className={isLow ? "text-red-600 font-semibold" : ""}>
                            {stock}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={p.status === "active" ? "default" : "secondary"}>
                            {p.status === "active" ? "上架" : "下架"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Link to={`/products/${p.id}/edit`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
                              <Pencil className="size-3.5" />
                              编辑
                            </Link>
                            <fetcher.Form method="post" className="inline">
                              <input type="hidden" name="intent" value="delete" />
                              <input type="hidden" name="id" value={p.id} />
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
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
