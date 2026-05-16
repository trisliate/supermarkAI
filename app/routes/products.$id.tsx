import { Link } from "react-router";
import type { Route } from "./+types/products.$id";
import { requireRole } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { AppLayout } from "~/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button, buttonVariants } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { cn, formatPrice } from "~/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Package, Pencil, ArrowDownToLine, ArrowUpFromLine, Clock, Tag } from "lucide-react";

export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireRole(request, ["admin", "purchaser", "inventory_keeper"]);
  const { loadRoutePermissions } = await import("~/lib/permissions.server");
  const routePermissions = await loadRoutePermissions();
  const id = Number(params.id);

  const product = await db.product.findUnique({
    where: { id },
    include: {
      category: true,
      inventory: true,
      inventoryLogs: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { user: { select: { name: true } } },
      },
    },
  });
  if (!product) throw new Response("商品不存在", { status: 404 });

  const serializedProduct = {
    ...product,
    price: Number(product.price),
    hasImage: !!product.image,
    image: undefined,
    productionDate: product.productionDate ? product.productionDate.toISOString() : null,
  };

  return { user, product: serializedProduct, routePermissions };
}

export default function ProductDetailPage({ loaderData }: Route.ComponentProps) {
  const { user, product } = loaderData;
  const stock = product.inventory?.quantity ?? 0;
  const isLow = stock < 10;
  const isOut = stock === 0;

  let daysLeft: number | null = null;
  let expiryLabel = "";
  if (product.productionDate && product.shelfLifeDays) {
    const prodDate = new Date(product.productionDate);
    const expiryDate = new Date(prodDate.getTime() + product.shelfLifeDays * 86400000);
    daysLeft = Math.ceil((expiryDate.getTime() - Date.now()) / 86400000);
    expiryLabel = daysLeft <= 0 ? "已过期" : `${daysLeft}天后过期`;
  }

  return (
    <AppLayout user={user} routePermissions={loaderData.routePermissions} backTo="/products" backLabel="返回商品列表" description="商品详情">
      <div className="max-w-4xl space-y-5 animate-fade-in">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            {product.hasImage ? (
              <img
                src={`/api/product-image?productId=${product.id}`}
                alt={product.name}
                className="w-20 h-20 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shadow-sm"
              />
            ) : (
              <div className="w-20 h-20 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shadow-sm">
                <Package className="w-8 h-8 text-slate-400" />
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold">{product.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">
                  <Tag className="size-3 mr-1" />{product.category.name}
                </Badge>
                <Badge variant={product.status === "active" ? "default" : "secondary"} className="text-xs">
                  {product.status === "active" ? "上架" : "下架"}
                </Badge>
              </div>
            </div>
          </div>
          {user.role === "admin" && (
            <Link to={`/products/${product.id}/edit`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              <Pencil className="size-3.5 mr-1.5" /> 编辑
            </Link>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left: Product info */}
          <div className="lg:col-span-2 space-y-5">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="size-4" /> 商品信息
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted-foreground">单价：</span><span className="font-semibold">¥{formatPrice(product.price)}</span></div>
                  <div><span className="text-muted-foreground">单位：</span>{product.unit}</div>
                  <div><span className="text-muted-foreground">保质期：</span>{product.shelfLifeDays ? `${product.shelfLifeDays} 天` : "-"}</div>
                  <div><span className="text-muted-foreground">生产日期：</span>{product.productionDate ? new Date(product.productionDate).toLocaleDateString() : "-"}</div>
                  {expiryLabel && (
                    <div>
                      <span className="text-muted-foreground">保质状态：</span>
                      <span className={cn("font-medium", daysLeft !== null && daysLeft <= 0 ? "text-red-600" : daysLeft !== null && daysLeft <= 30 ? "text-amber-600" : "text-emerald-600")}>
                        {expiryLabel}
                      </span>
                    </div>
                  )}
                  {product.description && (
                    <div className="col-span-2"><span className="text-muted-foreground">描述：</span>{product.description}</div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Recent inventory logs */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="size-4" /> 最近出入库记录
                </CardTitle>
              </CardHeader>
              <CardContent>
                {product.inventoryLogs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">暂无出入库记录</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>时间</TableHead>
                        <TableHead>类型</TableHead>
                        <TableHead className="text-right">数量</TableHead>
                        <TableHead>原因</TableHead>
                        <TableHead>操作人</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {product.inventoryLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(log.createdAt).toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </TableCell>
                          <TableCell>
                            <Badge variant={log.type === "IN" ? "default" : "destructive"} className="text-[10px]">
                              {log.type === "IN" ? <ArrowDownToLine className="size-2.5" /> : <ArrowUpFromLine className="size-2.5" />}
                              {log.type === "IN" ? "入库" : "出库"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {log.type === "IN" ? "+" : "-"}{log.quantity}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{log.reason || "-"}</TableCell>
                          <TableCell className="text-sm">{log.user.name}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right: Stock info */}
          <div className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">库存状态</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 mb-4">
                  <div className={cn("w-16 h-16 rounded-xl flex items-center justify-center text-2xl font-bold text-white",
                    isOut ? "bg-red-500" : isLow ? "bg-amber-500" : "bg-emerald-500"
                  )}>
                    {stock}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{product.unit}</p>
                    <Badge variant={isOut ? "destructive" : isLow ? "outline" : "default"} className="text-[10px] mt-1">
                      {isOut ? "缺货" : isLow ? "库存偏低" : "正常"}
                    </Badge>
                  </div>
                </div>
                <div className="border-t border-slate-200 dark:border-slate-700 pt-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">库存价值</span>
                    <span className="font-semibold">¥{formatPrice(stock * product.price)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">单位</span>
                    <span>{product.unit}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
