import { Link, useFetcher, useNavigation, useRevalidator } from "react-router";
import { useState, useMemo, useEffect } from "react";
import type { Route } from "./+types/inventory";
import { requireRole } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { AppLayout } from "~/components/layout/app-layout";
import { Card, CardContent } from "~/components/ui/card";
import { Button, buttonVariants } from "~/components/ui/button";
import { cn, formatPrice } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Progress } from "~/components/ui/progress";
import { PageSkeleton } from "~/components/ui/page-skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "~/components/ui/sheet";
import { Settings, Warehouse, History, Package, DollarSign, AlertTriangle, CheckCircle, Loader2, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { DataTablePagination } from "~/components/ui/data-table-pagination";
import { toast } from "sonner";

const PAGE_SIZE = 20;

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireRole(request, ["admin", "inventory_keeper", "purchaser"]);
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const [total, inventories] = await Promise.all([
    db.inventory.count(),
    db.inventory.findMany({
      include: { product: { include: { category: true } } },
      orderBy: { quantity: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);
  const serializedInventories = inventories.map((inv) => ({
    ...inv,
    product: { ...inv.product, price: Number(inv.product.price) },
  }));
  return { user, inventories: serializedInventories, total, page, pageSize: PAGE_SIZE };
}

export default function InventoryPage({ loaderData }: Route.ComponentProps) {
  const { user, inventories, total, page, pageSize } = loaderData;
  const [filter, setFilter] = useState("all");
  const navigation = useNavigation();
  const isLoading = navigation.state === "loading" && navigation.location?.pathname === "/inventory";
  const revalidator = useRevalidator();

  // Sheet state
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const logsFetcher = useFetcher();
  const adjustFetcher = useFetcher();

  useEffect(() => {
    if (selectedId !== null) {
      logsFetcher.load(`/inventory/${selectedId}`);
    }
  }, [selectedId]);

  useEffect(() => {
    if (adjustFetcher.state === "idle" && adjustFetcher.data) {
      if (adjustFetcher.data.ok) {
        toast.success("库存调整成功");
        logsFetcher.load(`/inventory/${selectedId}`);
        revalidator.revalidate();
      } else if (adjustFetcher.data.error) {
        toast.error(adjustFetcher.data.error);
      }
    }
  }, [adjustFetcher.state, adjustFetcher.data]);

  const counts = useMemo(() => {
    let out = 0, low = 0, normal = 0;
    inventories.forEach((inv) => {
      if (inv.quantity === 0) out++;
      else if (inv.quantity < 10) low++;
      else normal++;
    });
    return { all: inventories.length, out, low, normal };
  }, [inventories]);

  const totalValue = useMemo(
    () => inventories.reduce((sum, inv) => sum + inv.quantity * Number(inv.product.price), 0),
    [inventories],
  );

  const filtered = useMemo(() => {
    if (filter === "all") return inventories;
    if (filter === "out") return inventories.filter((i) => i.quantity === 0);
    if (filter === "low") return inventories.filter((i) => i.quantity > 0 && i.quantity < 10);
    return inventories.filter((i) => i.quantity >= 10);
  }, [inventories, filter]);

  return (
    <AppLayout user={user}>
      {isLoading ? <PageSkeleton columns={7} rows={6} /> : (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <Warehouse className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">库存总览</h2>
              <p className="text-xs text-muted-foreground">查看和管理商品库存</p>
            </div>
          </div>
          <Link to="/inventory/log" className={cn(buttonVariants({ variant: "outline" }))}>
            <History className="size-4" />
            出入库记录
          </Link>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-slate-500">商品种类</span>
            </div>
            <p className="text-2xl font-bold">{counts.all}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-red-200 dark:border-red-800/50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <span className="text-xs text-slate-500">缺货</span>
            </div>
            <p className="text-2xl font-bold text-red-600">{counts.out}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-amber-200 dark:border-amber-800/50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="text-xs text-slate-500">库存偏低</span>
            </div>
            <p className="text-2xl font-bold text-amber-600">{counts.low}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-emerald-500" />
              <span className="text-xs text-slate-500">库存总值</span>
            </div>
            <p className="text-2xl font-bold">¥{formatPrice(totalValue)}</p>
          </div>
        </div>

        {/* Filter tabs */}
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList>
            <TabsTrigger value="all">全部 ({counts.all})</TabsTrigger>
            <TabsTrigger value="out" className="text-red-600">缺货 ({counts.out})</TabsTrigger>
            <TabsTrigger value="low" className="text-amber-600">偏低 ({counts.low})</TabsTrigger>
            <TabsTrigger value="normal">正常 ({counts.normal})</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>商品</TableHead>
                  <TableHead>分类</TableHead>
                  <TableHead>单价</TableHead>
                  <TableHead className="w-48">库存数量</TableHead>
                  <TableHead>库存价值</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      <Warehouse className="size-8 mx-auto mb-2 opacity-50" />
                      暂无库存数据
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((inv) => {
                    const isLow = inv.quantity < 10;
                    const isOut = inv.quantity === 0;
                    const maxStock = 200;
                    const pct = Math.min(100, (inv.quantity / maxStock) * 100);
                    return (
                      <TableRow key={inv.id} className={isOut ? "bg-red-50/50 dark:bg-red-950/20" : isLow ? "bg-amber-50/30 dark:bg-amber-950/10" : ""}>
                        <TableCell className="font-medium">{inv.product.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-normal text-xs">{inv.product.category.name}</Badge>
                        </TableCell>
                        <TableCell className="font-mono">¥{formatPrice(Number(inv.product.price))}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Progress
                              value={pct}
                              className={cn("h-2 flex-1", isOut ? "[&>div]:bg-red-500" : isLow ? "[&>div]:bg-amber-500" : "[&>div]:bg-emerald-500")}
                            />
                            <span className={cn("text-sm font-semibold w-16 text-right", isOut ? "text-red-600" : isLow ? "text-amber-600" : "text-slate-600 dark:text-slate-300")}>
                              {inv.quantity} {inv.product.unit}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          ¥{formatPrice(inv.quantity * Number(inv.product.price))}
                        </TableCell>
                        <TableCell>
                          {isOut ? (
                            <Badge variant="destructive" className="text-xs">缺货</Badge>
                          ) : isLow ? (
                            <Badge variant="outline" className="border-amber-300 text-amber-700 dark:text-amber-400 text-xs">偏低</Badge>
                          ) : (
                            <Badge variant="default" className="text-xs">正常</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {user.role !== "purchaser" ? (
                            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setSelectedId(inv.id)}>
                              <Settings className="size-3.5" />
                              调整
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">只读</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <DataTablePagination totalPages={Math.ceil(total / pageSize)} currentPage={page} />
      </div>
      )}

      {/* Inventory Adjustment Sheet */}
      <Sheet open={selectedId !== null} onOpenChange={(open) => { if (!open) setSelectedId(null); }}>
        <SheetContent side="right" className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Settings className="size-4" />
              库存调整
            </SheetTitle>
            <SheetDescription>
              {logsFetcher.data?.inventory?.product?.name ?? "加载中..."}
            </SheetDescription>
          </SheetHeader>

          {logsFetcher.state === "loading" || !logsFetcher.data ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="size-6 animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="flex flex-col gap-4 mt-4 overflow-y-auto" style={{ maxHeight: "calc(100vh - 120px)" }}>
              {/* Stock info */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold text-white ${
                    logsFetcher.data.inventory.quantity === 0 ? "bg-red-500"
                      : logsFetcher.data.inventory.quantity < 10 ? "bg-amber-500"
                      : "bg-emerald-500"
                  }`}>
                    {logsFetcher.data.inventory.quantity}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      {logsFetcher.data.inventory.product.unit}
                    </p>
                    <p className="text-xs text-slate-400">
                      单价 ¥{formatPrice(Number(logsFetcher.data.inventory.product.price))}
                    </p>
                    <Badge variant={
                      logsFetcher.data.inventory.quantity === 0 ? "destructive"
                        : logsFetcher.data.inventory.quantity < 10 ? "secondary"
                        : "default"
                    } className="mt-1 text-[10px]">
                      {logsFetcher.data.inventory.quantity === 0 ? "缺货"
                        : logsFetcher.data.inventory.quantity < 10 ? "库存偏低"
                        : "正常"}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Adjustment form */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-3">出入库操作</p>
                <adjustFetcher.Form method="post" action={`/inventory/${selectedId}`} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">操作类型</Label>
                      <Select name="type" defaultValue="IN">
                        <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="IN">入库</SelectItem>
                          <SelectItem value="OUT">出库</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="sheet-quantity" className="text-xs">数量</Label>
                      <Input name="quantity" id="sheet-quantity" type="number" min="1" required className="h-9" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sheet-reason" className="text-xs">原因 <span className="text-muted-foreground">(可选)</span></Label>
                    <Input name="reason" id="sheet-reason" placeholder="操作原因" className="h-9" />
                  </div>
                  <Button type="submit" disabled={adjustFetcher.state !== "idle"} className="h-9 w-full">
                    {adjustFetcher.state !== "idle" ? <Loader2 className="size-4 animate-spin" /> : null}
                    {adjustFetcher.state !== "idle" ? "提交中..." : "确认调整"}
                  </Button>
                </adjustFetcher.Form>
              </div>

              {/* Recent logs */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-3">操作记录</p>
                <div className="max-h-60 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">时间</TableHead>
                        <TableHead className="text-xs">类型</TableHead>
                        <TableHead className="text-xs text-right">数量</TableHead>
                        <TableHead className="text-xs">操作人</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logsFetcher.data.recentLogs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="h-20 text-center text-muted-foreground text-sm">暂无记录</TableCell>
                        </TableRow>
                      ) : (
                        logsFetcher.data.recentLogs.map((log: { id: number; type: "IN" | "OUT"; quantity: number; createdAt: string; user: { name: string } }) => (
                          <TableRow key={log.id}>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              {new Date(log.createdAt).toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </TableCell>
                            <TableCell>
                              <Badge variant={log.type === "IN" ? "default" : "destructive"} className="text-[10px]">
                                {log.type === "IN" ? <ArrowDownToLine className="size-2.5" /> : <ArrowUpFromLine className="size-2.5" />}
                                {log.type === "IN" ? "入库" : "出库"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">{log.type === "IN" ? "+" : "-"}{log.quantity}</TableCell>
                            <TableCell className="text-sm">{log.user.name}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}
