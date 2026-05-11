import { lazy, Suspense } from "react";
import { Link } from "react-router";
import {
  Package, Truck, ShoppingCart, AlertTriangle, DollarSign, Users,
  TrendingUp, Clock, CheckCircle, ArrowRight, UserCheck, Zap,
} from "lucide-react";
import { Skeleton } from "~/components/ui/skeleton";
import { Badge } from "~/components/ui/badge";
import { ScrollArea } from "~/components/ui/scroll-area";
import { formatPrice } from "~/lib/utils";

const Charts = lazy(() => import("../charts").then((m) => ({ default: m.Charts })));

interface AdminDashboardProps {
  stats: {
    productCount: number;
    supplierCount: number;
    userCount: number;
    lowStockCount: number;
    pendingPurchaseCount: number;
    todaySalesAmount: number;
    yesterdaySalesAmount: number;
  };
  trendData: Array<{ date: string; 销售额: number; 采购额: number }>;
  pieData: Array<{ name: string; value: number }>;
  inventoryStatus: Record<string, number>;
  topProducts: Array<{ name: string; quantity: number; amount: number }>;
  staffPerformance: Array<{ name: string; role: string; salesCount: number; salesAmount: number }>;
  pendingPurchases: Array<{ id: number; supplier: string; amount: number; createdAt: string }>;
}

function MiniStat({ label, value, icon: Icon, color, trend }: {
  label: string; value: string | number; icon: React.ComponentType<{ className?: string }>; color: string; trend?: { value: number; isUp: boolean };
}) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{label}</p>
        <div className="flex items-baseline gap-1.5">
          <span className="text-lg font-bold text-slate-900 dark:text-white">{value}</span>
          {trend && (
            <span className={`text-[10px] font-medium ${trend.isUp ? "text-emerald-500" : "text-red-500"}`}>
              {trend.isUp ? "↑" : "↓"}{Math.abs(trend.value)}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function AdminDashboard({
  stats, trendData, pieData, inventoryStatus, topProducts, staffPerformance, pendingPurchases,
}: AdminDashboardProps) {
  const salesTrend = stats.yesterdaySalesAmount > 0
    ? Math.round(((stats.todaySalesAmount - stats.yesterdaySalesAmount) / stats.yesterdaySalesAmount) * 100)
    : 0;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "早上好";
    if (h < 18) return "下午好";
    return "晚上好";
  })();

  return (
    <div className="animate-fade-in space-y-4">
      {/* Top bar: greeting + stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{greeting}，店长</h2>
          <span className="text-xs text-slate-400">
            {new Date().toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" })}
          </span>
        </div>
        <Link
          to="/sales/new"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-md text-xs font-medium hover:shadow-md transition-all"
        >
          <Zap className="w-3 h-3" />
          收银台
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <MiniStat label="商品数量" value={stats.productCount} icon={Package} color="bg-blue-500" />
        <MiniStat label="今日营收" value={`¥${formatPrice(stats.todaySalesAmount)}`} icon={DollarSign} color="bg-emerald-500" trend={{ value: Math.abs(salesTrend), isUp: salesTrend >= 0 }} />
        <MiniStat label="待审批" value={stats.pendingPurchaseCount} icon={ShoppingCart} color="bg-amber-500" />
        <MiniStat label="库存预警" value={stats.lowStockCount} icon={AlertTriangle} color="bg-red-500" />
        <MiniStat label="供应商" value={stats.supplierCount} icon={Truck} color="bg-cyan-500" />
        <MiniStat label="员工" value={stats.userCount} icon={Users} color="bg-violet-500" />
      </div>

      {/* Main content: charts + side panels */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4" style={{ minHeight: 0 }}>
        {/* Charts - takes 2 columns */}
        <div className="xl:col-span-2">
          <Suspense
            fallback={
              <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4">
                <Skeleton className="h-[260px] w-full rounded-lg" />
              </div>
            }
          >
            <Charts trendData={trendData} pieData={pieData} inventoryStatus={inventoryStatus} />
          </Suspense>
        </div>

        {/* Right side: top products + staff */}
        <div className="space-y-4">
          {/* Top products */}
          <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">热销 Top 5</span>
            </div>
            <div className="space-y-2">
              {topProducts.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">暂无数据</p>
              ) : (
                topProducts.map((item, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${i === 0 ? "bg-amber-500" : i === 1 ? "bg-slate-400" : "bg-slate-300 dark:bg-slate-600"}`}>
                      {i + 1}
                    </span>
                    <span className="text-[13px] text-slate-700 dark:text-slate-200 truncate flex-1">{item.name}</span>
                    <span className="text-[11px] text-slate-400">{item.quantity}件</span>
                    <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">¥{formatPrice(item.amount)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Staff performance */}
          <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4">
            <div className="flex items-center gap-2 mb-3">
              <UserCheck className="w-4 h-4 text-blue-500" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">员工绩效</span>
            </div>
            <div className="space-y-2">
              {staffPerformance.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">暂无数据</p>
              ) : (
                staffPerformance.slice(0, 5).map((s, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-[10px] text-white font-medium shrink-0">
                        {s.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-slate-700 dark:text-slate-200 truncate">{s.name}</p>
                        <p className="text-[10px] text-slate-400">{s.role} · {s.salesCount}单</p>
                      </div>
                    </div>
                    <span className="text-[13px] font-semibold text-emerald-600 shrink-0">¥{formatPrice(s.salesAmount)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom: pending purchases (horizontal scroll) */}
      {pendingPurchases.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-500" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">待审批采购</span>
            </div>
            <Link to="/purchases" className="text-[11px] text-blue-500 hover:text-blue-600 flex items-center gap-0.5">
              全部 <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {pendingPurchases.map((p) => (
              <Link
                key={p.id}
                to={`/purchases/${p.id}`}
                className="flex-shrink-0 w-48 px-3 py-2 rounded-md border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono text-slate-500">PO-{String(p.id).padStart(4, "0")}</span>
                  <Badge variant="outline" className="text-[9px] px-1 py-0">待审批</Badge>
                </div>
                <p className="text-[13px] font-medium text-slate-700 dark:text-slate-200 truncate">{p.supplier}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">¥{formatPrice(p.amount)}</span>
                  <span className="text-[10px] text-slate-400">{new Date(p.createdAt).toLocaleDateString("zh-CN", { month: "short", day: "numeric" })}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
