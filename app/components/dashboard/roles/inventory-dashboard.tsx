import { Link } from "react-router";
import {
  Package, AlertTriangle, XCircle, DollarSign,
  ArrowRight, Clock, TrendingDown, Settings,
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { formatPrice } from "~/lib/utils";
import type { SlowMovingItem } from "~/lib/recommendation.server";

interface InventoryDashboardProps {
  stats: {
    totalProducts: number;
    outOfStock: number;
    lowStock: number;
    totalValue: number;
  };
  inventoryStatus: Record<string, number>;
  alertItems: Array<{ id: number; productName: string; categoryName: string; quantity: number; unit: string; price: number }>;
  recentLogs: Array<{ id: number; productName: string; type: "IN" | "OUT"; quantity: number; reason: string; userName: string; createdAt: string }>;
  slowMoving: SlowMovingItem[];
}

const typeLabels: Record<string, string> = { IN: "入库", OUT: "出库" };
const typeColors: Record<string, string> = {
  IN: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  OUT: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

function StatCard({ label, value, icon: Icon, color, subtitle }: {
  label: string; value: string | number; icon: React.ComponentType<{ className?: string }>; color: string; subtitle?: string;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800/80 p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-400 dark:text-slate-500">{label}</p>
        <span className="text-xl font-bold text-slate-900 dark:text-white tabular-nums">{value}</span>
        {subtitle && <p className="text-[10px] text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

export function InventoryDashboard({
  stats, inventoryStatus, alertItems, recentLogs, slowMoving,
}: InventoryDashboardProps) {
  const statusEntries = Object.entries(inventoryStatus).filter(([_, v]) => v > 0);
  const total = statusEntries.reduce((sum, [_, v]) => sum + v, 0);
  const statusColors: Record<string, string> = {
    "缺货": "bg-red-500", "偏低": "bg-amber-500", "正常": "bg-emerald-500", "充足": "bg-blue-500",
  };

  return (
    <div className="h-full flex flex-col gap-4 animate-fade-in">
      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="商品总数" value={stats.totalProducts} icon={Package} color="bg-blue-500" />
        <StatCard label="缺货商品" value={stats.outOfStock} icon={XCircle} color="bg-red-500" subtitle={stats.outOfStock > 0 ? "需要立即补货" : "暂无缺货"} />
        <StatCard label="库存偏低" value={stats.lowStock} icon={AlertTriangle} color="bg-amber-500" subtitle={stats.lowStock > 0 ? "需要关注" : "库存充足"} />
        <StatCard label="库存总值" value={`¥${formatPrice(stats.totalValue)}`} icon={DollarSign} color="bg-emerald-500" />
      </div>

      {/* Main grid */}
      <div className="flex-1 grid grid-cols-1 xl:grid-cols-12 gap-4 min-h-0">
        {/* Left: status + alerts — 8 cols */}
        <div className="xl:col-span-8 flex flex-col gap-4 min-h-0">
          {/* Status bar */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800/80 p-4 shrink-0">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-3">库存状态分布</span>
            <div className="flex gap-1 h-3 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
              {statusEntries.map(([name, count]) => (
                <div
                  key={name}
                  className={`${statusColors[name] || "bg-slate-400"} transition-all`}
                  style={{ width: `${total > 0 ? (count / total) * 100 : 0}%` }}
                  title={`${name}: ${count}`}
                />
              ))}
            </div>
            <div className="flex gap-4 mt-2">
              {statusEntries.map(([name, count]) => (
                <div key={name} className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${statusColors[name] || "bg-slate-400"}`} />
                  <span className="text-[11px] text-slate-500">{name}</span>
                  <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Alert table */}
          <div className="flex-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800/80 overflow-hidden flex flex-col min-h-0">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">库存预警清单</span>
              </div>
              <span className="text-[10px] text-slate-400">{alertItems.length} 项</span>
            </div>
            {alertItems.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                <Package className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-xs">所有商品库存充足</p>
              </div>
            ) : (
              <div className="flex-1 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/80 z-10">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium text-slate-500 text-xs">商品</th>
                      <th className="text-left px-4 py-2 font-medium text-slate-500 text-xs">分类</th>
                      <th className="text-right px-4 py-2 font-medium text-slate-500 text-xs">库存</th>
                      <th className="text-center px-4 py-2 font-medium text-slate-500 text-xs">状态</th>
                      <th className="text-right px-4 py-2 font-medium text-slate-500 text-xs">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {alertItems.map((item) => (
                      <tr key={item.id} className={item.quantity === 0 ? "bg-red-50/50 dark:bg-red-950/10" : ""}>
                        <td className="px-4 py-2 font-medium text-slate-700 dark:text-slate-200 text-[13px]">{item.productName}</td>
                        <td className="px-4 py-2 text-slate-500 text-[13px]">{item.categoryName}</td>
                        <td className="px-4 py-2 text-right font-mono text-[13px]">
                          <span className={item.quantity === 0 ? "text-red-600 font-bold" : "text-amber-600 font-semibold"}>
                            {item.quantity} {item.unit}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-center">
                          <Badge variant={item.quantity === 0 ? "destructive" : "secondary"} className="text-[10px]">
                            {item.quantity === 0 ? "缺货" : "偏低"}
                          </Badge>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <Link to={`/inventory/${item.id}`} className="text-blue-500 hover:text-blue-600 text-xs flex items-center gap-1 justify-end">
                            <Settings className="w-3 h-3" /> 调整
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right side panels — 4 cols */}
        <div className="xl:col-span-4 flex flex-col gap-4 min-h-0">
          {/* Recent logs */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800/80 p-4 flex-1 min-h-0">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">最近出入库</span>
              </div>
              <Link to="/inventory/log" className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-0.5">
                全部 <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="space-y-2">
              {recentLogs.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">暂无记录</p>
              ) : (
                recentLogs.slice(0, 6).map((log) => (
                  <div key={log.id} className="flex items-center gap-2 py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${typeColors[log.type]}`}>
                      {typeLabels[log.type]}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-slate-700 dark:text-slate-200 truncate">{log.productName}</p>
                    </div>
                    <span className={`text-[13px] font-semibold shrink-0 ${log.type === "IN" ? "text-emerald-600" : "text-red-500"}`}>
                      {log.type === "IN" ? "+" : "-"}{log.quantity}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Slow moving */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800/80 p-4 flex-1 min-h-0">
            <div className="flex items-center gap-2 mb-3">
              <TrendingDown className="w-4 h-4 text-orange-500" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">滞销预警</span>
            </div>
            {slowMoving.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">暂无滞销商品</p>
            ) : (
              <div className="space-y-2">
                {slowMoving.slice(0, 6).map((item) => (
                  <div key={item.productId} className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-slate-700 dark:text-slate-200 truncate">{item.productName}</p>
                      <p className="text-[10px] text-slate-400">{item.categoryName} · 库存 {item.stock}</p>
                    </div>
                    <span className="text-[13px] font-semibold text-orange-600 shrink-0 tabular-nums">¥{formatPrice(item.stockValue)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
