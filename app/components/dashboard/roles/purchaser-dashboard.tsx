import { Link } from "react-router";
import {
  ShoppingCart, DollarSign, Truck, AlertTriangle,
  ArrowRight, Phone, MapPin, TrendingUp, Package,
} from "lucide-react";
import { StatCard } from "../stat-card";
import type { RestockItem } from "~/lib/recommendation.server";

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
  pending: "待审批",
  approved: "已审批",
  received: "已入库",
  cancelled: "已取消",
};

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  approved: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  received: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  cancelled: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};

const urgencyStyles: Record<string, string> = {
  critical: "bg-red-500",
  urgent: "bg-orange-500",
  watch: "bg-yellow-500",
  sufficient: "bg-emerald-500",
};

const urgencyBadge: Record<string, string> = {
  critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800",
  urgent: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800",
  watch: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800",
  sufficient: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
};

export function PurchaserDashboard({
  stats, restockItems, purchaseTrend, supplierSpend, recentPurchases, suppliers,
}: PurchaserDashboardProps) {
  // 只显示需要关注的商品（非充足）
  const urgentItems = restockItems.filter((r) => r.urgency !== "sufficient");

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">采购工作台</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="待审批采购单" value={stats.pendingCount} icon={ShoppingCart} color="bg-amber-500" subtitle="需要处理" />
        <StatCard label="本月采购总额" value={`¥${stats.monthlyPurchaseAmount.toFixed(0)}`} icon={DollarSign} color="bg-blue-500" />
        <StatCard label="活跃供应商" value={stats.activeSuppliers} icon={Truck} color="bg-cyan-500" />
        <StatCard label="需补货商品" value={stats.needRestockCount} icon={AlertTriangle} color="bg-red-500" subtitle={stats.needRestockCount > 0 ? "请尽快处理" : "库存充足"} />
      </div>

      {/* Smart Restock Recommendation */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">智能补货建议</h3>
              <p className="text-xs text-slate-400">基于库存量和近7天销量自动计算</p>
            </div>
          </div>
          {urgentItems.length > 0 && (
            <span className="px-2.5 py-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-medium rounded-full">
              {urgentItems.length} 项需关注
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50">
                <th className="text-left px-5 py-3 font-medium text-slate-500 dark:text-slate-400">商品</th>
                <th className="text-left px-5 py-3 font-medium text-slate-500 dark:text-slate-400">分类</th>
                <th className="text-right px-5 py-3 font-medium text-slate-500 dark:text-slate-400">当前库存</th>
                <th className="text-right px-5 py-3 font-medium text-slate-500 dark:text-slate-400">日均销量</th>
                <th className="text-right px-5 py-3 font-medium text-slate-500 dark:text-slate-400">可售天数</th>
                <th className="text-right px-5 py-3 font-medium text-slate-500 dark:text-slate-400">建议采购</th>
                <th className="text-center px-5 py-3 font-medium text-slate-500 dark:text-slate-400">紧急程度</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {restockItems.slice(0, 15).map((item) => (
                <tr key={item.productId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-8 rounded-full ${urgencyStyles[item.urgency]}`} />
                      <span className="font-medium text-slate-700 dark:text-slate-200">{item.productName}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{item.categoryName}</td>
                  <td className="px-5 py-3 text-right font-mono text-slate-700 dark:text-slate-200">
                    {item.currentStock} {item.unit}
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-slate-500 dark:text-slate-400">
                    {item.dailySales}
                  </td>
                  <td className="px-5 py-3 text-right font-mono">
                    <span className={item.daysOfStock < 3 ? "text-red-600 font-semibold" : item.daysOfStock < 7 ? "text-orange-500" : "text-slate-500 dark:text-slate-400"}>
                      {item.daysOfStock >= 9999 ? "∞" : `${item.daysOfStock}天`}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-mono font-semibold text-slate-700 dark:text-slate-200">
                    {item.suggestedQty > 0 ? `${item.suggestedQty} ${item.unit}` : "-"}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${urgencyBadge[item.urgency]}`}>
                      {item.urgencyLabel}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom: Purchase trend + Suppliers + Recent */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Purchase Trend */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-blue-500" />
            <h3 className="font-semibold text-slate-900 dark:text-white">近7天采购趋势</h3>
          </div>
          <div className="space-y-2">
            {purchaseTrend.map((d, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs text-slate-400 w-10">{d.date}</span>
                <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-5 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-end pr-2"
                    style={{ width: `${Math.min(100, (d.amount / Math.max(...purchaseTrend.map((t) => t.amount || 1))) * 100)}%` }}
                  >
                    {d.amount > 0 && <span className="text-[10px] text-white font-medium">¥{d.amount.toFixed(0)}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Supplier Quick Contact */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-cyan-500" />
              <h3 className="font-semibold text-slate-900 dark:text-white">供应商速联</h3>
            </div>
            <Link to="/suppliers" className="text-xs text-blue-500 hover:text-blue-600">管理</Link>
          </div>
          <div className="space-y-3">
            {suppliers.slice(0, 5).map((s) => (
              <div key={s.id} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{s.name}</p>
                  <p className="text-xs text-slate-400">{s.contact}</p>
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                  <Phone className="w-3 h-3" />
                  {s.phone}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Purchases */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-amber-500" />
              <h3 className="font-semibold text-slate-900 dark:text-white">最近采购单</h3>
            </div>
            <Link to="/purchases" className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1">
              全部 <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {recentPurchases.map((p) => (
              <Link
                key={p.id}
                to={`/purchases/${p.id}`}
                className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">PO-{String(p.id).padStart(4, "0")}</p>
                  <p className="text-xs text-slate-400">{p.supplier}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">¥{p.amount.toFixed(0)}</p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${statusColors[p.status]}`}>
                    {statusLabels[p.status]}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
