import { Link } from "react-router";
import { useState, useMemo } from "react";
import type { Route } from "./+types/inventory.log";
import { requireRole } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { AppLayout } from "~/components/layout/app-layout";

import { Card, CardContent } from "~/components/ui/card";
import { buttonVariants } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { ArrowLeft, History, ArrowDownToLine, ArrowUpFromLine, Search } from "lucide-react";

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
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const filtered = useMemo(() => {
    return logs.filter((log) => {
      const matchSearch = !search || log.product.name.toLowerCase().includes(search.toLowerCase()) || log.user.name.includes(search);
      const matchType = typeFilter === "all" || log.type === typeFilter;
      return matchSearch && matchType;
    });
  }, [logs, search, typeFilter]);

  return (
    <AppLayout
      user={user}
      description="最近 100 条出入库操作记录"
    >
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <div></div>
          <Link to="/inventory" className={cn(buttonVariants({ variant: "outline" }))}>
            <ArrowLeft className="size-4" /> 返回库存
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <Input
              placeholder="搜索商品或操作人..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Tabs value={typeFilter} onValueChange={setTypeFilter}>
            <TabsList className="h-9">
              <TabsTrigger value="all" className="text-xs">全部</TabsTrigger>
              <TabsTrigger value="IN" className="text-xs">入库</TabsTrigger>
              <TabsTrigger value="OUT" className="text-xs">出库</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>时间</TableHead>
                  <TableHead>商品</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>数量</TableHead>
                  <TableHead>原因</TableHead>
                  <TableHead>操作人</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      <History className="size-8 mx-auto mb-2 opacity-50" />
                      {search || typeFilter !== "all" ? "没有匹配的记录" : "暂无出入库记录"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((log) => (
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
