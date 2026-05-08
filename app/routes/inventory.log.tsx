import { Link } from "react-router";
import type { Route } from "./+types/inventory.log";
import { requireRole } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { AppLayout } from "~/components/layout/app-layout";
import { Card, CardContent } from "~/components/ui/card";
import { buttonVariants } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { ArrowLeft, History, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireRole(request, ["admin", "inventory_keeper"]);
  const logs = await db.inventoryLog.findMany({
    include: { product: true, user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return { user, logs };
}

export default function InventoryLogPage({ loaderData }: Route.ComponentProps) {
  const { user, logs } = loaderData;

  return (
    <AppLayout user={user}>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">出入库记录</h2>
            <p className="text-sm text-muted-foreground mt-1">最近 100 条出入库操作记录</p>
          </div>
          <Link to="/inventory" className={cn(buttonVariants({ variant: "outline" }))}>
            <ArrowLeft className="size-4" />
            返回库存
          </Link>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>时间</TableHead>
                  <TableHead>商品</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>数量</TableHead>
                  <TableHead>原因</TableHead>
                  <TableHead>操作人</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      <History className="size-8 mx-auto mb-2 opacity-50" />
                      暂无出入库记录
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-muted-foreground">
                        {new Date(log.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-medium">{log.product.name}</TableCell>
                      <TableCell>
                        <Badge variant={log.type === "IN" ? "default" : "destructive"}>
                          {log.type === "IN" ? (
                            <><ArrowDownToLine className="size-3" /> 入库</>
                          ) : (
                            <><ArrowUpFromLine className="size-3" /> 出库</>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>{log.quantity}</TableCell>
                      <TableCell className="text-muted-foreground">{log.reason || "-"}</TableCell>
                      <TableCell>{log.user.name}</TableCell>
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
