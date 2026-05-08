import { Link } from "react-router";
import {
  Package, AlertTriangle, XCircle, DollarSign,
  ArrowRight, Clock, TrendingDown, Settings,
} from "lucide-react";
import { StatCard } from "../stat-card";
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

export function InventoryDashboard({
  stats, inventoryStatus, alertItems, recentLogs, slowMoving,
}: InventoryDashboardProps) {
  const statusEntries = Object.entries(inventoryStatus).filter(([_, v]) => v > 0);
  const total = statusEntries.reduce((sum, [_, v]) => sum + v, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">库存工作台</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="商品总数" value={stats.totalProducts} icon={Package} color="bg-blue-500" />
        <StatCard label="缺货商品" value={stats.outOfStock} icon={XCircle} color="bg-red-500" subtitle={stats.outOfStock > 0 ? "需要立即补货" : "暂无缺货"} />
        <StatCard label="库存偏低" value={stats.lowStock} icon={AlertTriangle} color="bg-amber-500" subtitle={stats.lowStock > 0 ? "需要关注" : "库存充足"} />
        <StatCard label="库存总值" value={`¥${stats.totalValue.toFixed(0)}`} icon={DollarSign} color="bg-emerald-500" />
      </div>

      {/* Status overview + Alert list */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Inventory Status Pie (simple) */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-4">库存状态分布</h3>
          <div className="space-y-4">
            {statusEntries.map(([name, count]) => {
              const pct = total > 0 ? (count / total) * 100 : 0;
              const colors: Record<string, string> = {
                "缺货": "bg-red-500",
                "偏低": "bg-amber-500",
                "正常": "bg-emerald-500",
                "充足": "bg-blue-500",
              };
              return (
                <div key={name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${colors[name] || "bg-slate-400"}`} />
                      <span className="text-sm text-slate-700 dark:text-slate-200">{name}</span>
                    </div>
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{count}</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5">
                    <div
                      className={`h-full rounded-full ${colors[name] || "bg-slate-400"} transition-all`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Link to="/inventory" className="text-sm text-blue-500 hover:text-blue-600 flex items-center gap-1">
              查看全部库存 <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Alert List */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <h3 className="font-semibold text-slate-900 dark:text-white">库存预警清单</h3>
            </div>
            <span className="text-xs text-slate-400">{alertItems.length} 项</span>
          </div>
          {alertItems.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-slate-400">
              <Package className="w-10 h-10 mb-3 opacity-50" />
              <p className="text-sm">所有商品库存充足</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left py-2 font-medium text-slate-500">商品</th>
                    <th className="text-left py-2 font-medium text-slate-500">分类</th>
                    <th className="text-right py-2 font-medium text-slate-500">库存</th>
                    <th className="text-right py-2 font-medium text-slate-500">状态</th>
                    <th className="text-right py-2 font-medium text-slate-500">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {alertItems.map((item) => (
                    <tr key={item.id} className={item.quantity === 0 ? "bg-red-50/50 dark:bg-red-950/10" : ""}>
                      <td className="py-2.5 font-medium text-slate-700 dark:text-slate-200">{item.productName}</td>
                      <td className="py-2.5 text-slate-500 dark:text-slate-400">{item.categoryName}</td>
                      <td className="py-2.5 text-right font-mono">
                        <span className={item.quantity === 0 ? "text-red-600 font-bold" : "text-amber-600 font-semibold"}>
                          {item.quantity} {item.unit}
                        </span>
                      </td>
                      <td className="py-2.5 text-right">
                        {item.quantity === 0 ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800 font-medium">缺货</span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800 font-medium">偏低</span>
                        )}
                      </td>
                      <td className="py-2.5 text-right">
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

      {/* Bottom: Recent logs + Slow moving */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Logs */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-500" />
              <h3 className="font-semibold text-slate-900 dark:text-white">最近出入库</h3>
            </div>
            <Link to="/inventory/log" className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1">
              全部 <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {recentLogs.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">暂无记录</p>
            ) : (
              recentLogs.map((log) => (
                <div key={log.id} className="flex items-center gap-3 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${typeColors[log.type]}`}>
                    {typeLabels[log.type]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700 dark:text-slate-200 truncate">{log.productName}</p>
                    <p className="text-xs text-slate-400 truncate">{log.reason}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-semibold ${log.type === "IN" ? "text-emerald-600" : "text-red-500"}`}>
                      {log.type === "IN" ? "+" : "-"}{log.quantity}
                    </p>
                    <p className="text-[10px] text-slate-400">{new Date(log.createdAt).toLocaleDateString("zh-CN")}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Slow Moving */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown className="w-5 h-5 text-orange-500" />
            <h3 className="font-semibold text-slate-900 dark:text-white">滞销预警</h3>
            <span className="text-xs text-slate-400">（7天零销量且库存充足）</span>
          </div>
          {slowMoving.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">暂无滞销商品</p>
          ) : (
            <div className="space-y-3">
              {slowMoving.map((item) => (
                <div key={item.productId} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{item.productName}</p>
                    <p className="text-xs text-slate-400">{item.categoryName} · 库存 {item.stock}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-orange-600">¥{item.stockValue.toFixed(0)}</p>
                    <p className="text-[10px] text-slate-400">库存价值</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
