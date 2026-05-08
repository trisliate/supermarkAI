import { Link } from "react-router";
import type { Route } from "./+types/inventory";
import { requireRole } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { AppLayout } from "~/components/layout/app-layout";
import { Card, CardContent } from "~/components/ui/card";
import { buttonVariants } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Settings, Warehouse, History } from "lucide-react";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireRole(request, ["admin", "inventory_keeper"]);
  const inventories = await db.inventory.findMany({
    include: { product: { include: { category: true } } },
    orderBy: { quantity: "asc" },
  });
  return { user, inventories };
}

export default function InventoryPage({ loaderData }: Route.ComponentProps) {
  const { user, inventories } = loaderData;

  return (
    <AppLayout user={user}>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">库存总览</h2>
            <p className="text-sm text-muted-foreground mt-1">查看和管理商品库存</p>
          </div>
          <Link to="/inventory/log" className={cn(buttonVariants({ variant: "outline" }))}>
            <History className="size-4" />
            出入库记录
          </Link>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>商品</TableHead>
                  <TableHead>分类</TableHead>
                  <TableHead>单价</TableHead>
                  <TableHead>库存数量</TableHead>
                  <TableHead>库存价值</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventories.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      <Warehouse className="size-8 mx-auto mb-2 opacity-50" />
                      暂无库存数据
                    </TableCell>
                  </TableRow>
                ) : (
                  inventories.map((inv) => {
                    const isLow = inv.quantity < 10;
                    const isOut = inv.quantity === 0;
                    return (
                      <TableRow key={inv.id} className={isLow ? "bg-red-50/50" : ""}>
                        <TableCell className="font-medium">{inv.product.name}</TableCell>
                        <TableCell>{inv.product.category.name}</TableCell>
                        <TableCell>¥{Number(inv.product.price).toFixed(2)}</TableCell>
                        <TableCell>
                          <span className={`font-semibold ${isLow ? "text-red-600" : ""}`}>
                            {inv.quantity} {inv.product.unit}
                          </span>
                        </TableCell>
                        <TableCell>¥{(inv.quantity * Number(inv.product.price)).toFixed(2)}</TableCell>
                        <TableCell>
                          {isOut ? (
                            <Badge variant="destructive">缺货</Badge>
                          ) : isLow ? (
                            <Badge variant="outline" className="border-yellow-300 text-yellow-700">库存不足</Badge>
                          ) : (
                            <Badge variant="default">正常</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Link to={`/inventory/${inv.id}`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
                            <Settings className="size-3.5" />
                            调整
                          </Link>
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
