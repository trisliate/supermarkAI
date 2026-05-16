import { Link, useNavigation } from "react-router";
import { useState, useMemo } from "react";
import type { Route } from "./+types/sales";
import { requireRole } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { AppLayout } from "~/components/layout/app-layout";

import { Card, CardContent } from "~/components/ui/card";
import { buttonVariants } from "~/components/ui/button";
import { cn, formatPrice } from "~/lib/utils";
import { Input } from "~/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { PageSkeleton } from "~/components/ui/page-skeleton";
import { Receipt, CreditCard, Search, Banknote, QrCode } from "lucide-react";
import { DataTablePagination } from "~/components/ui/data-table-pagination";
import { PAGE_SIZE } from "~/lib/constants";

const paymentLabels: Record<string, { label: string; icon: typeof Banknote; color: string }> = {
  cash: { label: "现金", icon: Banknote, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400" },
  wechat: { label: "微信", icon: QrCode, color: "text-green-600 bg-green-50 dark:bg-green-950/30 dark:text-green-400" },
  alipay: { label: "支付宝", icon: CreditCard, color: "text-blue-600 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400" },
};

const statusLabels: Record<string, { label: string; color: string }> = {
  paid: { label: "已支付", color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400" },
  pending: { label: "待支付", color: "text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400" },
  failed: { label: "失败", color: "text-red-600 bg-red-50 dark:bg-red-950/30 dark:text-red-400" },
  refunded: { label: "已退款", color: "text-slate-600 bg-slate-50 dark:bg-slate-950/30 dark:text-slate-400" },
};

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireRole(request, ["admin", "cashier"]);
  const { loadRoutePermissions } = await import("~/lib/permissions.server");
  const routePermissions = await loadRoutePermissions();
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const [total, sales] = await Promise.all([
    db.saleOrder.count(),
    db.saleOrder.findMany({
      include: { user: { select: { name: true } }, items: { include: { product: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);
  const serializedSales = sales.map((s) => ({
    id: s.id,
    userId: s.userId,
    totalAmount: Number(s.totalAmount),
    paymentMethod: s.paymentMethod,
    paymentStatus: s.paymentStatus,
    paidAmount: s.paidAmount ? Number(s.paidAmount) : null,
    changeAmount: s.changeAmount ? Number(s.changeAmount) : null,
    createdAt: s.createdAt,
    user: s.user,
    items: s.items.map((item) => ({ ...item, unitPrice: Number(item.unitPrice) })),
  }));
  return { user, sales: serializedSales, total, page, pageSize: PAGE_SIZE, routePermissions };
}

export default function SalesPage({ loaderData }: Route.ComponentProps) {
  const { user, sales, total, page, pageSize } = loaderData;
  const [search, setSearch] = useState("");
  const navigation = useNavigation();
  const isLoading = navigation.state === "loading" && navigation.location?.pathname === "/sales";

  const filtered = useMemo(() => {
    if (!search) return sales;
    const q = search.toLowerCase();
    return sales.filter((s) => {
      const orderNo = `SO-${String(s.id).padStart(4, "0")}`;
      return (
        orderNo.toLowerCase().includes(q) ||
        s.user.name.includes(q) ||
        s.items.some((item) => item.product.name.toLowerCase().includes(q))
      );
    });
  }, [sales, search]);

  return (
    <AppLayout
      user={user}
      routePermissions={loaderData.routePermissions}
      description="查看所有销售订单"
    >
      {isLoading ? <PageSkeleton columns={7} rows={6} /> : (
      <div className="space-y-8 animate-fade-in">
        <div className="flex items-center gap-3">
          <Link to="/sales/new" className={cn(buttonVariants({ size: "sm" }), "shrink-0")}>
            <CreditCard className="size-4" /> 收银台
          </Link>
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <Input
              placeholder="搜索单号、商品或营业员..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>单号</TableHead>
                  <TableHead>商品</TableHead>
                  <TableHead>营业员</TableHead>
                  <TableHead>支付方式</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>总金额</TableHead>
                  <TableHead>时间</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                      <Receipt className="size-8 mx-auto mb-2 opacity-50" />
                      {search ? "没有匹配的订单" : "暂无销售记录"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((s) => {
                    const pm = paymentLabels[s.paymentMethod] || paymentLabels.cash;
                    const PmIcon = pm.icon;
                    const st = statusLabels[s.paymentStatus] || statusLabels.paid;
                    return (
                      <TableRow key={s.id} className="cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/20" onClick={() => window.location.href = `/sales/${s.id}`}>
                        <TableCell className="font-mono">SO-{String(s.id).padStart(4, "0")}</TableCell>
                        <TableCell>
                          <div className="max-w-xs truncate">
                            {s.items.map((item) => `${item.product.name}×${item.quantity}`).join("、")}
                          </div>
                        </TableCell>
                        <TableCell>{s.user.name}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${pm.color}`}>
                            <PmIcon className="size-3" />
                            {pm.label}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>
                            {st.label}
                          </span>
                        </TableCell>
                        <TableCell className="font-semibold">¥{formatPrice(Number(s.totalAmount))}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(s.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Link to={`/sales/${s.id}`} className="text-xs text-blue-500 hover:text-blue-600" onClick={(e) => e.stopPropagation()}>
                            详情
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
        <DataTablePagination totalPages={Math.ceil(total / pageSize)} currentPage={page} />
      </div>
      )}
    </AppLayout>
  );
}
