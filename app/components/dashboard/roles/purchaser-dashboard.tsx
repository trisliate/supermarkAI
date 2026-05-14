import { lazy, Suspense } from "react";
import { Link } from "react-router";
import {
  ShoppingCart, DollarSign, Truck, AlertTriangle,
  ArrowRight, Phone, Zap, Package,
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { formatPrice } from "~/lib/utils";
import type { RestockItem } from "~/lib/recommendation.server";
import { StatCard } from "../stat-card";

const BarChartCard = lazy(() => import("../charts").then((m) => ({ default: m.BarChartCard })));

interface PurchaserDashboardProps {
  stats: {
    pendingCount: number;
    monthlyPurchaseAmount: number;
    activeSuppliers: number;
    needRestockCount: number;
  };
  restockItems: RestockItem[];
  purchaseTrend: Array<{ date: string; amount: number }>;
  supplierSpend: Array<{ name: string; amount: number }>;
  recentPurchases: Array<{ id: number; supplier: string; status: string; amount: number; createdAt: string }>;
  suppliers: Array<{ id: number; name: string; contact: string; phone: string; address: string | null }>;
}

const statusLabels: Record<string, string> = {
  pending: "待审批", approved: "已审批", received: "已入库", cancelled: "已取消",
};

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  approved: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  received: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  cancelled: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};

const urgencyStyles: Record<string, string> = {
  critical: "bg-red-500", urgent: "bg-orange-500", watch: "bg-yellow-500", sufficient: "bg-emerald-500",
};

export function PurchaserDashboard({
  stats, restockItems, recentPurchases, suppliers, supplierSpend,
}: PurchaserDashboardProps) {
  const urgentItems = restockItems.filter((r) => r.urgency !== "sufficient");

  return (
    <div className="h-full flex flex-col gap-4 animate-fade-in">
      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="待审批采购单" value={stats.pendingCount} icon={ShoppingCart} color="bg-amber-500" delay={0} />
        <StatCard label="本月采购总额" value={`¥${formatPrice(stats.monthlyPurchaseAmount)}`} icon={DollarSign} color="bg-blue-500" delay={50} />
        <StatCard label="活跃供应商" value={stats.activeSuppliers} icon={Truck} color="bg-cyan-500" delay={100} />
        <StatCard label="需补货商品" value={stats.needRestockCount} icon={AlertTriangle} color="bg-red-500" subtitle={stats.needRestockCount > 0 ? "请尽快处理" : "库存充足"} delay={150} />
      </div>

      {/* Main grid */}
      <div className="flex-1 grid grid-cols-1 xl:grid-cols-12 gap-4 min-h-0">
        {/* Restock table — 8 cols */}
        <div className="xl:col-span-8 bg-gradient-to-br from-white to-slate-50/80 dark:from-slate-900 dark:to-slate-900/80 rounded-xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm overflow-hidden flex flex-col min-h-0">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">智能补货建议</span>
            </div>
            {urgentItems.length > 0 && (
              <Badge variant="destructive" className="text-[10px]">{urgentItems.length} 项需关注</Badge>
            )}
          </div>
          {restockItems.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
              <Package className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm font-medium">所有商品库存充足</p>
              <p className="text-xs mt-1">暂无需要补货的商品</p>
            </div>
          ) : (
            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/80 z-10">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-slate-500 text-xs">商品</th>
                    <th className="text-right px-4 py-2 font-medium text-slate-500 text-xs">库存</th>
                    <th className="text-right px-4 py-2 font-medium text-slate-500 text-xs">日均销量</th>
                    <th className="text-right px-4 py-2 font-medium text-slate-500 text-xs">可售天数</th>
                    <th className="text-right px-4 py-2 font-medium text-slate-500 text-xs">建议采购</th>
                    <th className="text-center px-4 py-2 font-medium text-slate-500 text-xs">紧急程度</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {restockItems.slice(0, 15).map((item) => (
                    <tr key={item.productId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-1.5 h-6 rounded-full shrink-0 ${urgencyStyles[item.urgency]}`} />
                          <span className="font-medium text-slate-700 dark:text-slate-200 text-[13px] truncate">{item.productName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-[13px]">{item.currentStock} {item.unit}</td>
                      <td className="px-4 py-2 text-right font-mono text-slate-500 text-[13px]">{item.dailySales}</td>
                      <td className="px-4 py-2 text-right font-mono text-[13px]">
                        <span className={item.daysOfStock < 3 ? "text-red-600 font-semibold" : item.daysOfStock < 7 ? "text-orange-500" : "text-slate-500"}>
                          {item.daysOfStock >= 9999 ? "∞" : `${item.daysOfStock}天`}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right font-mono font-semibold text-[13px]">
                        {item.suggestedQty > 0 ? `${item.suggestedQty} ${item.unit}` : "-"}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <span className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium ${item.urgency === "critical" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : item.urgency === "urgent" ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" : item.urgency === "watch" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"}`}>
                          {item.urgencyLabel}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right side panels — 4 cols */}
        <div className="xl:col-span-4 flex flex-col gap-4 min-h-0">
          {/* Quick actions */}
          <Link
            to="/purchases/new"
            className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-medium hover:shadow-md transition-all"
          >
            <Zap className="w-4 h-4" />
            新建采购单
          </Link>

          {/* Supplier spend chart */}
          {supplierSpend && supplierSpend.length > 0 && (
            <div className="bg-gradient-to-br from-white to-slate-50/80 dark:from-slate-900 dark:to-slate-900/80 rounded-xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <DollarSign className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">供应商支出</span>
              </div>
              <Suspense fallback={<div className="h-[200px] bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />}>
                <BarChartCard data={supplierSpend.map((s) => ({ name: s.name, value: s.amount }))} title="" />
              </Suspense>
            </div>
          )}

          {/* Suppliers */}
          {suppliers.length > 0 && (
            <div className="bg-gradient-to-br from-white to-slate-50/80 dark:from-slate-900 dark:to-slate-900/80 rounded-xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm p-4 flex-1 min-h-0">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-cyan-500" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">供应商速联</span>
                </div>
                <Link to="/suppliers" className="text-xs text-blue-500 hover:text-blue-600">管理</Link>
              </div>
              <div className="space-y-2">
                {suppliers.slice(0, 5).map((s) => (
                  <div key={s.id} className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-slate-700 dark:text-slate-200 truncate">{s.name}</p>
                      <p className="text-[10px] text-slate-400">{s.contact}</p>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-slate-500 shrink-0">
                      <Phone className="w-3 h-3" /> {s.phone}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent purchases */}
          {recentPurchases.length > 0 && (
            <div className="bg-gradient-to-br from-white to-slate-50/80 dark:from-slate-900 dark:to-slate-900/80 rounded-xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm p-4 flex-1 min-h-0">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">最近采购单</span>
                </div>
                <Link to="/purchases" className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-0.5">
                  全部 <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="space-y-2">
                {recentPurchases.slice(0, 5).map((p) => (
                  <Link
                    key={p.id}
                    to={`/purchases/${p.id}`}
                    className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-slate-700 dark:text-slate-200">PO-{String(p.id).padStart(4, "0")}</p>
                      <p className="text-[10px] text-slate-400 truncate">{p.supplier}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">¥{formatPrice(p.amount)}</p>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${statusColors[p.status]}`}>
                        {statusLabels[p.status]}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
