import { Link } from "react-router";
import type { Route } from "./+types/sales";
import { requireRole } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { AppLayout } from "~/components/layout/app-layout";
import { Card, CardContent } from "~/components/ui/card";
import { buttonVariants } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Receipt, CreditCard } from "lucide-react";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireRole(request, ["admin", "cashier"]);
  const sales = await db.saleOrder.findMany({
    include: { user: { select: { name: true } }, items: { include: { product: true } } },
    orderBy: { createdAt: "desc" },
  });
  return { user, sales };
}

export default function SalesPage({ loaderData }: Route.ComponentProps) {
  const { user, sales } = loaderData;

  return (
    <AppLayout user={user}>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">销售记录</h2>
            <p className="text-sm text-muted-foreground mt-1">查看所有销售订单</p>
          </div>
          <Link to="/sales/new" className={cn(buttonVariants())}>
            <CreditCard className="size-4" />
            收银台
          </Link>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>单号</TableHead>
                  <TableHead>商品</TableHead>
                  <TableHead>营业员</TableHead>
                  <TableHead>总金额</TableHead>
                  <TableHead>时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                      <Receipt className="size-8 mx-auto mb-2 opacity-50" />
                      暂无销售记录
                    </TableCell>
                  </TableRow>
                ) : (
                  sales.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono">SO-{String(s.id).padStart(4, "0")}</TableCell>
                      <TableCell>
                        <div className="max-w-xs truncate">
                          {s.items.map((item) => `${item.product.name}×${item.quantity}`).join("、")}
                        </div>
                      </TableCell>
                      <TableCell>{s.user.name}</TableCell>
                      <TableCell className="font-semibold">¥{Number(s.totalAmount).toFixed(2)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(s.createdAt).toLocaleString()}
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
