import { Link } from "react-router";
import {
  DollarSign, Receipt, ShoppingCart, User,
  ArrowRight, Zap, TrendingUp, Clock,
} from "lucide-react";
import { StatCard } from "../stat-card";

interface CashierDashboardProps {
  stats: {
    todaySales: number;
    todayOrders: number;
    avgOrderValue: number;
    myOrders: number;
  };
  hourlySales: Array<{ hour: string; amount: number }>;
  hotProducts: Array<{ name: string; price: number; stock: number; unit: string; sold: number }>;
  recentSales: Array<{ id: number; amount: number; itemCount: number; createdAt: string }>;
  cashierName: string;
}

export function CashierDashboard({
  stats, hourlySales, hotProducts, recentSales, cashierName,
}: CashierDashboardProps) {
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "早上好";
    if (h < 18) return "下午好";
    return "晚上好";
  })();

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{greeting}，{cashierName}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}
          </p>
        </div>
        <Link
          to="/sales/new"
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl text-base font-semibold hover:shadow-lg hover:shadow-emerald-500/25 transition-all active:scale-95"
        >
          <Zap className="w-5 h-5" />
          开始收银
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="今日销售额" value={`¥${stats.todaySales.toFixed(0)}`} icon={DollarSign} color="bg-emerald-500" />
        <StatCard label="今日订单数" value={stats.todayOrders} icon={Receipt} color="bg-blue-500" />
        <StatCard label="客单价" value={`¥${stats.avgOrderValue.toFixed(0)}`} icon={ShoppingCart} color="bg-violet-500" />
        <StatCard label="我的订单" value={stats.myOrders} icon={User} color="bg-amber-500" subtitle="今日完成" />
      </div>

      {/* Hourly Sales Chart */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-emerald-500" />
          <h3 className="font-semibold text-slate-900 dark:text-white">今日时段销售</h3>
        </div>
        <div className="flex items-end gap-1.5 h-40">
          {hourlySales.map((h, i) => {
            const maxAmount = Math.max(...hourlySales.map((s) => s.amount), 1);
            const heightPct = (h.amount / maxAmount) * 100;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                {h.amount > 0 && (
                  <span className="text-[9px] text-slate-400 font-mono">¥{h.amount.toFixed(0)}</span>
                )}
                <div className="w-full relative" style={{ height: `${Math.max(4, heightPct)}%` }}>
                  <div
                    className={`absolute inset-0 rounded-t-md transition-all ${
                      h.amount > 0
                        ? "bg-gradient-to-t from-emerald-500 to-emerald-400"
                        : "bg-slate-100 dark:bg-slate-800"
                    }`}
                  />
                </div>
                <span className="text-[9px] text-slate-400">{h.hour}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom: Hot products + Recent */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hot Products Quick Lookup */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              <h3 className="font-semibold text-slate-900 dark:text-white">热销速查</h3>
            </div>
            <span className="text-xs text-slate-400">方便快速结账</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-2 font-medium text-slate-500">商品</th>
                  <th className="text-right py-2 font-medium text-slate-500">价格</th>
                  <th className="text-right py-2 font-medium text-slate-500">库存</th>
                  <th className="text-right py-2 font-medium text-slate-500">今日售出</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {hotProducts.map((p, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-2.5 font-medium text-slate-700 dark:text-slate-200">{p.name}</td>
                    <td className="py-2.5 text-right font-mono text-slate-700 dark:text-slate-200">¥{p.price.toFixed(2)}</td>
                    <td className="py-2.5 text-right font-mono">
                      <span className={p.stock < 10 ? "text-red-500 font-semibold" : "text-slate-500 dark:text-slate-400"}>
                        {p.stock} {p.unit}
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-mono text-emerald-600 font-semibold">{p.sold}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Sales */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-500" />
              <h3 className="font-semibold text-slate-900 dark:text-white">最近交易</h3>
            </div>
            <Link to="/sales" className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1">
              全部 <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {recentSales.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">暂无交易</p>
            ) : (
              recentSales.map((s) => (
                <div key={s.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      SO-{String(s.id).padStart(4, "0")}
                    </p>
                    <p className="text-xs text-slate-400">{s.itemCount} 件商品</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-emerald-600">¥{s.amount.toFixed(2)}</p>
                    <p className="text-[10px] text-slate-400">{new Date(s.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
