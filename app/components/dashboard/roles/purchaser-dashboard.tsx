import { lazy, Suspense } from "react";
import { Link } from "react-router";
import {
  ShoppingCart, DollarSign, Truck, AlertTriangle,
  ArrowRight, Phone, TrendingUp, Package, Zap,
} from "lucide-react";
import { Skeleton } from "~/components/ui/skeleton";
import { Badge } from "~/components/ui/badge";
import { formatPrice } from "~/lib/utils";
import type { RestockItem } from "~/lib/recommendation.server";

const Charts = lazy(() => import("../charts").then((m) => ({ default: m.Charts })));

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

function MiniStat({ label, value, icon: Icon, color, subtitle }: {
  label: string; value: string | number; icon: React.ComponentType<{ className?: string }>; color: string; subtitle?: string;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{label}</p>
        <span className="text-lg font-bold text-slate-900 dark:text-white">{value}</span>
        {subtitle && <p className="text-[10px] text-slate-400">{subtitle}</p>}
      </div>
    </div>
  );
}

export function PurchaserDashboard({
  stats, restockItems, purchaseTrend, supplierSpend, recentPurchases, suppliers,
}: PurchaserDashboardProps) {
  const urgentItems = restockItems.filter((r) => r.urgency !== "sufficient");
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "早上好";
    if (h < 18) return "下午好";
    return "晚上好";
  })();

  return (
    <div className="animate-fade-in space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{greeting}，采购</h2>
          <span className="text-xs text-slate-400">
            {new Date().toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" })}
          </span>
        </div>
        <Link
          to="/purchases/new"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-md text-xs font-medium hover:shadow-md transition-all"
        >
          <Zap className="w-3 h-3" />
          新建采购
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniStat label="待审批采购单" value={stats.pendingCount} icon={ShoppingCart} color="bg-amber-500" />
        <MiniStat label="本月采购总额" value={`¥${formatPrice(stats.monthlyPurchaseAmount)}`} icon={DollarSign} color="bg-blue-500" />
        <MiniStat label="活跃供应商" value={stats.activeSuppliers} icon={Truck} color="bg-cyan-500" />
        <MiniStat label="需补货商品" value={stats.needRestockCount} icon={AlertTriangle} color="bg-red-500" subtitle={stats.needRestockCount > 0 ? "请尽快处理" : "库存充足"} />
      </div>

      {/* Main content: restock table + side panels */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Restock recommendation table */}
        <div className="xl:col-span-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">智能补货建议</span>
            </div>
            {urgentItems.length > 0 && (
              <Badge variant="destructive" className="text-[10px]">{urgentItems.length} 项需关注</Badge>
            )}
          </div>
          <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/80">
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
                {restockItems.slice(0, 12).map((item) => (
                  <tr key={item.productId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-6 rounded-full ${urgencyStyles[item.urgency]}`} />
                        <span className="font-medium text-slate-700 dark:text-slate-200 text-[13px]">{item.productName}</span>
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
        </div>

        {/* Right side: suppliers + recent purchases */}
        <div className="space-y-4">
          {/* Supplier quick contact */}
          <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-cyan-500" />
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">供应商速联</span>
              </div>
              <Link to="/suppliers" className="text-[11px] text-blue-500 hover:text-blue-600">管理</Link>
            </div>
            <div className="space-y-2">
              {suppliers.slice(0, 4).map((s) => (
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

          {/* Recent purchases */}
          <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">最近采购单</span>
              </div>
              <Link to="/purchases" className="text-[11px] text-blue-500 hover:text-blue-600 flex items-center gap-0.5">
                全部 <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="space-y-2">
              {recentPurchases.slice(0, 4).map((p) => (
                <Link
                  key={p.id}
                  to={`/purchases/${p.id}`}
                  className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
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
        </div>
      </div>
    </div>
  );
}
