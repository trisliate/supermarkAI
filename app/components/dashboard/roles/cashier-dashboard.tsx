import { Link } from "react-router";
import {
  DollarSign, Receipt, ShoppingCart, User,
  ArrowRight, Zap, TrendingUp, Clock,
  Award, AlertTriangle,
} from "lucide-react";
import { formatPrice } from "~/lib/utils";

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
  allCashierStats?: Array<{ name: string; salesCount: number; salesAmount: number }>;
  lowStockProducts?: Array<{ name: string; stock: number; unit: string }>;
}

function MiniStat({ label, value, icon: Icon, color, subtitle }: {
  label: string; value: string | number; icon: any; color: string; subtitle?: string;
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

export function CashierDashboard({
  stats, hourlySales, hotProducts, recentSales, cashierName, allCashierStats, lowStockProducts,
}: CashierDashboardProps) {
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "早上好";
    if (h < 18) return "下午好";
    return "晚上好";
  })();

  const peakHour = hourlySales.reduce((max, h) => h.amount > max.amount ? h : max, hourlySales[0]);

  return (
    <div className="animate-fade-in space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{greeting}，{cashierName}</h2>
          <span className="text-xs text-slate-400">
            {new Date().toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" })}
          </span>
        </div>
        <Link
          to="/sales/new"
          className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-md text-sm font-bold hover:shadow-lg hover:shadow-emerald-500/30 transition-all active:scale-95"
        >
          <Zap className="w-4 h-4" />
          开始收银
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniStat label="今日销售额" value={`¥${formatPrice(stats.todaySales)}`} icon={DollarSign} color="bg-emerald-500" />
        <MiniStat label="今日订单数" value={stats.todayOrders} icon={Receipt} color="bg-blue-500" />
        <MiniStat label="客单价" value={`¥${formatPrice(stats.avgOrderValue)}`} icon={ShoppingCart} color="bg-violet-500" />
        <MiniStat label="我的订单" value={stats.myOrders} icon={User} color="bg-amber-500" subtitle="今日完成" />
      </div>

      {/* Main content: hourly chart + hot products + side panels */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Hourly sales + hot products */}
        <div className="xl:col-span-2 space-y-4">
          {/* Hourly sales bar chart */}
          <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">今日时段销售</span>
              </div>
              {peakHour && peakHour.amount > 0 && (
                <span className="text-[10px] text-slate-400">
                  高峰：<span className="font-medium text-emerald-600">{peakHour.hour}</span>
                </span>
              )}
            </div>
            <div className="flex items-end gap-1 h-32">
              {hourlySales.map((h, i) => {
                const maxAmount = Math.max(...hourlySales.map((s) => s.amount), 1);
                const heightPct = (h.amount / maxAmount) * 100;
                const isPeak = h === peakHour && h.amount > 0;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group">
                    {h.amount > 0 && (
                      <span className={`text-[8px] font-mono opacity-0 group-hover:opacity-100 transition-opacity ${isPeak ? "text-emerald-600 font-bold" : "text-slate-400"}`}>
                        ¥{formatPrice(h.amount)}
                      </span>
                    )}
                    <div className="w-full relative" style={{ height: `${Math.max(4, heightPct)}%` }}>
                      <div
                        className={`absolute inset-0 rounded-t-sm transition-all ${
                          isPeak
                            ? "bg-gradient-to-t from-emerald-600 to-emerald-400"
                            : h.amount > 0
                              ? "bg-gradient-to-t from-emerald-500 to-emerald-400"
                              : "bg-slate-100 dark:bg-slate-800"
                        }`}
                      />
                    </div>
                    <span className={`text-[8px] ${isPeak ? "text-emerald-600 font-semibold" : "text-slate-400"}`}>{h.hour}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Hot products */}
          <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">热销速查</span>
              </div>
              <span className="text-[10px] text-slate-400">方便快速结账</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {hotProducts.slice(0, 8).map((p, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-default">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-4 h-4 rounded flex items-center justify-center text-[9px] font-bold text-white shrink-0 ${i < 3 ? "bg-amber-500" : "bg-slate-300 dark:bg-slate-600"}`}>
                      {i + 1}
                    </span>
                    <span className="text-[13px] font-medium text-slate-700 dark:text-slate-200 truncate">{p.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-mono text-slate-500">¥{formatPrice(p.price)}</span>
                    <span className={`text-[11px] font-mono ${p.stock < 10 ? "text-red-500 font-semibold" : "text-slate-400"}`}>
                      余{p.stock}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right side: recent sales + ranking + low stock */}
        <div className="space-y-4">
          {/* Recent sales */}
          <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">最近交易</span>
              </div>
              <Link to="/sales" className="text-[11px] text-blue-500 hover:text-blue-600 flex items-center gap-0.5">
                全部 <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="space-y-2">
              {recentSales.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">暂无交易</p>
              ) : (
                recentSales.map((s) => (
                  <div key={s.id} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <div>
                      <p className="text-[13px] font-medium text-slate-700 dark:text-slate-200">SO-{String(s.id).padStart(4, "0")}</p>
                      <p className="text-[10px] text-slate-400">{s.itemCount} 件</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[13px] font-semibold text-emerald-600">¥{formatPrice(s.amount)}</p>
                      <p className="text-[9px] text-slate-400">{new Date(s.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Cashier ranking */}
          {allCashierStats && allCashierStats.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Award className="w-4 h-4 text-purple-500" />
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">收银员排行</span>
              </div>
              <div className="space-y-2">
                {allCashierStats.map((c, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white ${i === 0 ? "bg-amber-500" : i === 1 ? "bg-slate-400" : "bg-slate-300 dark:bg-slate-600"}`}>
                        {i + 1}
                      </span>
                      <span className="text-[13px] font-medium text-slate-700 dark:text-slate-200">{c.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[13px] font-semibold text-emerald-600">¥{formatPrice(c.salesAmount)}</span>
                      <span className="text-[10px] text-slate-400 ml-1">{c.salesCount}单</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Low stock warning */}
          {lowStockProducts && lowStockProducts.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-amber-200 dark:border-amber-900/50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">库存不足</span>
              </div>
              <div className="space-y-1.5">
                {lowStockProducts.map((p, i) => (
                  <div key={i} className="flex items-center justify-between py-1">
                    <span className="text-[13px] text-slate-700 dark:text-slate-200 truncate">{p.name}</span>
                    <span className="text-[12px] font-semibold text-red-500 shrink-0">余 {p.stock} {p.unit}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
