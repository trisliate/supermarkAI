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
import { Receipt, CreditCard, Search } from "lucide-react";
import { DataTablePagination } from "~/components/ui/data-table-pagination";

const PAGE_SIZE = 20;

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireRole(request, ["admin", "cashier"]);
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
    ...s,
    totalAmount: Number(s.totalAmount),
    items: s.items.map((item) => ({ ...item, unitPrice: Number(item.unitPrice) })),
  }));
  return { user, sales: serializedSales, total, page, pageSize: PAGE_SIZE };
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
      description="查看所有销售订单"
    >
      {isLoading ? <PageSkeleton columns={5} rows={6} /> : (
      <div className="space-y-6 animate-fade-in">
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
                  <TableHead>总金额</TableHead>
                  <TableHead>时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                      <Receipt className="size-8 mx-auto mb-2 opacity-50" />
                      {search ? "没有匹配的订单" : "暂无销售记录"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono">SO-{String(s.id).padStart(4, "0")}</TableCell>
                      <TableCell>
                        <div className="max-w-xs truncate">
                          {s.items.map((item) => `${item.product.name}×${item.quantity}`).join("、")}
                        </div>
                      </TableCell>
                      <TableCell>{s.user.name}</TableCell>
                      <TableCell className="font-semibold">¥{formatPrice(Number(s.totalAmount))}</TableCell>
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
        <DataTablePagination totalPages={Math.ceil(total / pageSize)} currentPage={page} />
      </div>
      )}
    </AppLayout>
  );
}
