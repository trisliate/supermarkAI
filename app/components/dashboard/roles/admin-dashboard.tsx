import { lazy, Suspense } from "react";
import { Link } from "react-router";
import {
  Package, Truck, ShoppingCart, AlertTriangle, DollarSign, Users,
  TrendingUp, Clock, ArrowRight, UserCheck, Activity, ArrowUpRight, ArrowDownRight, CalendarClock,
} from "lucide-react";
import { Skeleton } from "~/components/ui/skeleton";
import { Badge } from "~/components/ui/badge";
import { formatPrice } from "~/lib/utils";
import { StatCard } from "../stat-card";

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
  expiryItems?: Array<{ productName: string; expiryDate: string; daysLeft: number }>;
}

export function AdminDashboard({
  stats, trendData, pieData, inventoryStatus, topProducts, staffPerformance, pendingPurchases, expiryItems,
}: AdminDashboardProps) {
  const salesTrend = stats.yesterdaySalesAmount > 0
    ? Math.round(((stats.todaySalesAmount - stats.yesterdaySalesAmount) / stats.yesterdaySalesAmount) * 100)
    : 0;

  const revenueTarget = Math.round(stats.yesterdaySalesAmount * 1.2);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* 今日营收 - 全宽 Hero 横幅 */}
      <div className="bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 rounded-2xl p-6 text-white shadow-lg shadow-emerald-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-white/80">今日营收</p>
              <p className="text-4xl font-bold tracking-tight">¥{formatPrice(stats.todaySalesAmount)}</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-xs text-white/60">昨日营收</p>
              <p className="text-lg font-semibold">¥{formatPrice(stats.yesterdaySalesAmount)}</p>
            </div>
            <div className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium ${salesTrend >= 0 ? "bg-white/20" : "bg-red-500/30"}`}>
              {salesTrend >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
              {Math.abs(salesTrend)}%
            </div>
            <div className="text-right">
              <p className="text-xs text-white/60">目标</p>
              <p className="text-lg font-semibold">¥{formatPrice(revenueTarget)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 待审批采购 + 库存预警 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link to="/purchases" className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 hover:shadow-lg hover:border-amber-300 dark:hover:border-amber-700 transition-all group">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-amber-50 dark:bg-amber-950/30 rounded-xl flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-amber-500 group-hover:translate-x-1 transition-all" />
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">待审批采购</p>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">{stats.pendingPurchaseCount}</p>
          <p className="text-xs text-slate-400 mt-2">点击查看详情</p>
        </Link>

        <Link to="/inventory" className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 hover:shadow-lg hover:border-red-300 dark:hover:border-red-700 transition-all group">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-red-50 dark:bg-red-950/30 rounded-xl flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-red-500 group-hover:translate-x-1 transition-all" />
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">库存预警</p>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">{stats.lowStockCount}</p>
          <p className="text-xs text-slate-400 mt-2">商品库存不足</p>
        </Link>
      </div>

      {/* 次要指标 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="商品总数" value={stats.productCount} icon={Package} color="bg-blue-500" delay={0} />
        <StatCard label="供应商" value={stats.supplierCount} icon={Truck} color="bg-cyan-500" delay={50} />
        <StatCard label="员工" value={stats.userCount} icon={Users} color="bg-violet-500" delay={100} />
        <StatCard label="今日趋势" value={`${salesTrend >= 0 ? "+" : ""}${salesTrend}%`} icon={Activity} color={salesTrend >= 0 ? "bg-emerald-500" : "bg-red-500"} delay={150} />
      </div>

      {/* 图表区域 */}
      <Suspense
        fallback={
          <div className="h-[300px]">
            <Skeleton className="h-full w-full rounded-xl" />
          </div>
        }
      >
        <Charts
          trendData={trendData}
          pieData={pieData}
          inventoryStatus={inventoryStatus}
          todayAmount={stats.todaySalesAmount}
          targetAmount={revenueTarget}
        />
      </Suspense>

      {/* 底部数据面板 - 三列 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 热销商品 Top 5 */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-amber-50 dark:bg-amber-950/30 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">热销商品 Top 5</h3>
          </div>
          {topProducts.length > 0 ? (
            <div className="space-y-3">
              {topProducts.map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${i === 0 ? "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400" : i === 1 ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" : "bg-slate-50 text-slate-500 dark:bg-slate-800/50 dark:text-slate-500"}`}>
                    {i + 1}
                  </span>
                  <span className="text-sm text-slate-700 dark:text-slate-200 truncate flex-1">{item.name}</span>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">¥{formatPrice(item.amount)}</p>
                    <p className="text-[10px] text-slate-400">{item.quantity}件</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 text-center py-8">暂无销售数据</p>
          )}
        </div>

        {/* 员工绩效 */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-blue-50 dark:bg-blue-950/30 rounded-lg flex items-center justify-center">
              <UserCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">员工绩效</h3>
          </div>
          {staffPerformance.length > 0 ? (
            <div className="space-y-3">
              {staffPerformance.slice(0, 5).map((s, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-sm text-white font-medium shrink-0">
                    {s.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{s.name}</p>
                    <p className="text-[10px] text-slate-400">{s.role} · {s.salesCount}单</p>
                  </div>
                  <span className="text-sm font-semibold text-emerald-600 shrink-0">¥{formatPrice(s.salesAmount)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 text-center py-8">暂无绩效数据</p>
          )}
        </div>

        {/* 待审批采购 */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-orange-50 dark:bg-orange-950/30 rounded-lg flex items-center justify-center">
                <Clock className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              </div>
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">待审批采购</h3>
            </div>
            <Link to="/purchases" className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-0.5">
              全部 <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {pendingPurchases.length > 0 ? (
            <div className="space-y-2">
              {pendingPurchases.map((p) => (
                <Link
                  key={p.id}
                  to={`/purchases/${p.id}`}
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-amber-200 dark:hover:border-amber-800 transition-all"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-slate-500">PO-{String(p.id).padStart(4, "0")}</span>
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800">待审批</Badge>
                    </div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{p.supplier}</p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">¥{formatPrice(p.amount)}</p>
                    <p className="text-[10px] text-slate-400">{new Date(p.createdAt).toLocaleDateString("zh-CN", { month: "short", day: "numeric" })}</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 text-center py-8">暂无待审批采购单</p>
          )}
        </div>
      </div>

      {/* 临期商品预警 */}
      {expiryItems && expiryItems.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-amber-200 dark:border-amber-800/50 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-amber-50 dark:bg-amber-950/30 rounded-lg flex items-center justify-center">
              <CalendarClock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">临期商品预警</h3>
              <p className="text-xs text-slate-400">30天内到期的采购商品</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {expiryItems.map((item, i) => (
              <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border ${item.daysLeft <= 7 ? "border-red-200 dark:border-red-800/50 bg-red-50/50 dark:bg-red-950/20" : item.daysLeft <= 14 ? "border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/20" : "border-slate-200 dark:border-slate-800"}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white ${item.daysLeft <= 7 ? "bg-red-500" : item.daysLeft <= 14 ? "bg-amber-500" : "bg-slate-400"}`}>
                  {item.daysLeft}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{item.productName}</p>
                  <p className="text-[10px] text-slate-400">{item.daysLeft <= 0 ? "已过期" : `${item.daysLeft}天后到期`}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
