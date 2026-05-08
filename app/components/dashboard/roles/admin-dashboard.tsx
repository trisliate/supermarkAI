import { lazy, Suspense } from "react";
import { Link } from "react-router";
import {
  Package, Truck, ShoppingCart, AlertTriangle, DollarSign, Users,
  TrendingUp, Clock, CheckCircle, ArrowRight, BarChart3, UserCheck,
} from "lucide-react";
import { StatCard } from "../stat-card";
import { Skeleton } from "~/components/ui/skeleton";

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
    <div className="space-y-6 animate-fade-in">
      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{greeting}，管理员</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}
          </p>
        </div>
        <Link
          to="/sales/new"
          className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg text-sm font-medium hover:shadow-lg hover:shadow-blue-500/25 transition-all"
        >
          进入收银台
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard label="商品数量" value={stats.productCount} icon={Package} color="bg-blue-500" />
        <StatCard label="今日营收" value={`¥${stats.todaySalesAmount.toFixed(0)}`} icon={DollarSign} color="bg-emerald-500" trend={{ value: Math.abs(salesTrend), isUp: salesTrend >= 0 }} />
        <StatCard label="待审批采购" value={stats.pendingPurchaseCount} icon={ShoppingCart} color="bg-amber-500" />
        <StatCard label="库存预警" value={stats.lowStockCount} icon={AlertTriangle} color="bg-red-500" subtitle={stats.lowStockCount > 0 ? "需要关注" : "库存正常"} />
        <StatCard label="活跃供应商" value={stats.supplierCount} icon={Truck} color="bg-cyan-500" />
        <StatCard label="员工数" value={stats.userCount} icon={Users} color="bg-violet-500" />
      </div>

      {/* Charts */}
      <Suspense
        fallback={
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
                <Skeleton className="h-5 w-32 mb-4" />
                <Skeleton className="h-[280px] w-full rounded-lg" />
              </div>
            ))}
          </div>
        }
      >
        <Charts trendData={trendData} pieData={pieData} inventoryStatus={inventoryStatus} />
      </Suspense>

      {/* Bottom section: Hot products + Staff performance + Pending */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hot Products */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-amber-500" />
            <h3 className="font-semibold text-slate-900 dark:text-white">热销 Top 5</h3>
          </div>
          <div className="space-y-3">
            {topProducts.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">暂无销售数据</p>
            ) : (
              topProducts.map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0
                      ${i === 0 ? "bg-amber-500" : i === 1 ? "bg-slate-400" : i === 2 ? "bg-amber-700" : "bg-slate-300 dark:bg-slate-600"}`}
                  >
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{item.name}</p>
                    <p className="text-xs text-slate-400">售出 {item.quantity} 件</p>
                  </div>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">¥{item.amount.toFixed(0)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Staff Performance */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            <UserCheck className="w-5 h-5 text-blue-500" />
            <h3 className="font-semibold text-slate-900 dark:text-white">员工绩效（今日）</h3>
          </div>
          <div className="space-y-3">
            {staffPerformance.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">暂无数据</p>
            ) : (
              staffPerformance.map((s, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{s.name}</p>
                    <p className="text-xs text-slate-400">{s.role} · {s.salesCount} 单</p>
                  </div>
                  <span className="text-sm font-semibold text-emerald-600">¥{s.salesAmount.toFixed(0)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pending Purchases */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-500" />
              <h3 className="font-semibold text-slate-900 dark:text-white">待办事项</h3>
            </div>
            <Link to="/purchases" className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1">
              查看全部 <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {pendingPurchases.length === 0 ? (
              <div className="flex flex-col items-center py-6 text-slate-400">
                <CheckCircle className="w-8 h-8 mb-2" />
                <p className="text-sm">暂无待办</p>
              </div>
            ) : (
              pendingPurchases.map((p) => (
                <Link
                  key={p.id}
                  to={`/purchases/${p.id}`}
                  className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      PO-{String(p.id).padStart(4, "0")}
                    </p>
                    <p className="text-xs text-slate-400">{p.supplier}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">¥{p.amount.toFixed(0)}</p>
                    <p className="text-xs text-slate-400">{new Date(p.createdAt).toLocaleDateString("zh-CN")}</p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
