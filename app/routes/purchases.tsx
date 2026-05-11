import { Link, useFetcher, useNavigation } from "react-router";
import { useState, useEffect } from "react";
import type { Route } from "./+types/purchases";
import { requireRole } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { AppLayout } from "~/components/layout/app-layout";
import { Button, buttonVariants } from "~/components/ui/button";
import { cn, formatPrice } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { PageSkeleton } from "~/components/ui/page-skeleton";
import { Plus, Eye, CheckCircle, XCircle, ShoppingCart, Calendar, User, Building2, Search } from "lucide-react";
import { Input } from "~/components/ui/input";
import { toast } from "sonner";
import { DataTablePagination } from "~/components/ui/data-table-pagination";

const PAGE_SIZE = 20;

const statusLabels: Record<string, string> = {
  pending: "待审批",
  approved: "已审批",
  received: "已入库",
  cancelled: "已取消",
};

const statusColors: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800",
  approved: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800",
  received: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800",
  cancelled: "bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
};

const statusDot: Record<string, string> = {
  pending: "bg-amber-500",
  approved: "bg-blue-500",
  received: "bg-emerald-500",
  cancelled: "bg-slate-400",
};

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireRole(request, ["admin", "purchaser"]);
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const [total, purchases] = await Promise.all([
    db.purchaseOrder.count(),
    db.purchaseOrder.findMany({
      include: { supplier: true, user: { select: { name: true } }, items: { include: { product: { select: { name: true } } } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);
  const serializedPurchases = purchases.map((p) => ({
    ...p,
    totalAmount: Number(p.totalAmount),
    items: p.items.map((item) => ({ ...item, unitPrice: Number(item.unitPrice) })),
  }));
  return { user, purchases: serializedPurchases, total, page, pageSize: PAGE_SIZE };
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
  const { user, purchases, total, page, pageSize } = loaderData;
  const fetcher = useFetcher();
  const [cancelId, setCancelId] = useState<number | null>(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const isCancelling = fetcher.state !== "idle";
  const navigation = useNavigation();
  const isLoading = navigation.state === "loading" && navigation.location?.pathname === "/purchases";

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.ok) {
      if (cancelId !== null) {
        toast.success("采购单已取消");
        setCancelId(null);
      } else {
        toast.success("采购单已审批");
      }
    }
  }, [fetcher.state, fetcher.data]);

  const filtered = purchases.filter((p) => {
    const matchStatus = filter === "all" || p.status === filter;
    const q = search.toLowerCase();
    const matchSearch = !q || p.supplier.name.toLowerCase().includes(q) || p.user.name.toLowerCase().includes(q) || `PO-${String(p.id).padStart(4, "0")}`.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });
  const counts = { all: purchases.length, pending: 0, approved: 0, received: 0, cancelled: 0 };
  purchases.forEach((p) => { counts[p.status as keyof typeof counts]++; });

  return (
    <AppLayout user={user}>
      {isLoading ? <PageSkeleton columns={3} rows={6} /> : (
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

        {/* Search + Filter tabs */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <Input placeholder="搜索供应商、创建人或单号..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
          </div>
        </div>

        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList>
            <TabsTrigger value="all">全部 ({counts.all})</TabsTrigger>
            <TabsTrigger value="pending">待审批 ({counts.pending})</TabsTrigger>
            <TabsTrigger value="approved">已审批 ({counts.approved})</TabsTrigger>
            <TabsTrigger value="received">已入库 ({counts.received})</TabsTrigger>
            <TabsTrigger value="cancelled">已取消 ({counts.cancelled})</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Card grid */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <ShoppingCart className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">{search ? "没有匹配的采购单" : "暂无采购数据"}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((p) => (
              <div
                key={p.id}
                className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 hover:shadow-md transition-shadow group"
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${statusDot[p.status]}`} />
                    <span className="font-mono text-sm font-semibold text-slate-700 dark:text-slate-200">
                      PO-{String(p.id).padStart(4, "0")}
                    </span>
                  </div>
                  <Badge variant="outline" className={cn("text-[10px] border", statusColors[p.status])}>
                    {statusLabels[p.status]}
                  </Badge>
                </div>

                {/* Supplier & Amount */}
                <div className="space-y-2 mb-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-medium text-slate-700 dark:text-slate-200">{p.supplier.name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <User className="w-3 h-3" />
                      <span>{p.user.name}</span>
                    </div>
                    <span className="text-lg font-bold text-slate-900 dark:text-white">
                      ¥{formatPrice(Number(p.totalAmount))}
                    </span>
                  </div>
                </div>

                {/* Items preview */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {p.items.slice(0, 3).map((item, i) => (
                    <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-50 dark:bg-slate-800 text-[11px] text-slate-500">
                      {item.product.name} x{item.quantity}
                    </span>
                  ))}
                  {p.items.length > 3 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-50 dark:bg-slate-800 text-[11px] text-slate-400">
                      +{p.items.length - 3}
                    </span>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Calendar className="w-3 h-3" />
                    <span>{new Date(p.createdAt).toLocaleDateString("zh-CN")}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Link to={`/purchases/${p.id}`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-7 px-2")}>
                      <Eye className="size-3.5" />
                    </Link>

                    {p.status === "pending" && user.role === "admin" && (
                      <fetcher.Form method="post" className="inline">
                        <input type="hidden" name="intent" value="approve" />
                        <input type="hidden" name="id" value={p.id} />
                        <Button variant="ghost" size="sm" type="submit" className="h-7 px-2 text-emerald-600 hover:text-emerald-600">
                          <CheckCircle className="size-3.5" />
                        </Button>
                      </fetcher.Form>
                    )}

                    {p.status === "pending" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-destructive hover:text-destructive"
                        onClick={() => setCancelId(p.id)}
                      >
                        <XCircle className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <DataTablePagination totalPages={Math.ceil(total / pageSize)} currentPage={page} />
      </div>
      )}

      <ConfirmDialog
        open={cancelId !== null}
        onOpenChange={(open) => { if (!open) setCancelId(null); }}
        title="取消采购单"
        description="确定要取消该采购单吗？此操作不可撤销。"
        confirmText="取消采购单"
        loading={isCancelling}
        onConfirm={() => {
          if (cancelId === null) return;
          const fd = new FormData();
          fd.set("intent", "cancel");
          fd.set("id", String(cancelId));
          fetcher.submit(fd, { method: "post" });
        }}
      />
    </AppLayout>
  );
}
