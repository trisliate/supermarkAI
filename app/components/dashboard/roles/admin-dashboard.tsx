import { lazy, Suspense, useState, useEffect } from "react";
import { Link } from "react-router";
import {
  Package, ShoppingCart, AlertTriangle, DollarSign,
  TrendingUp, Clock, ArrowRight, UserCheck, ArrowUpRight, ArrowDownRight, CalendarClock,
} from "lucide-react";
import { Skeleton } from "~/components/ui/skeleton";
import { Badge } from "~/components/ui/badge";
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
    todayOrderCount: number;
  };
  trendData: Array<{ date: string; 销售额: number; 采购额: number }>;
  pieData: Array<{ name: string; value: number }>;
  inventoryStatus: Record<string, number>;
  topProducts: Array<{ name: string; quantity: number; amount: number }>;
  staffPerformance: Array<{ name: string; role: string; salesCount: number; salesAmount: number }>;
  pendingPurchases: Array<{ id: number; supplier: string; amount: number; createdAt: string }>;
  expiryItems?: Array<{ productName: string; expiryDate: string; daysLeft: number }>;
}

function AnimatedNumber({ value, prefix = "", suffix = "" }: { value: number; prefix?: string; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const duration = 800;
    const start = Date.now();
    const from = 0;
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value]);
  return <>{prefix}{display.toLocaleString()}{suffix}</>;
}

export function AdminDashboard({
  stats, trendData, pieData, inventoryStatus, topProducts, staffPerformance, pendingPurchases, expiryItems,
}: AdminDashboardProps) {
  const salesTrend = stats.yesterdaySalesAmount > 0
    ? Math.round(((stats.todaySalesAmount - stats.yesterdaySalesAmount) / stats.yesterdaySalesAmount) * 100)
    : 0;
  const revenueTarget = Math.round(stats.yesterdaySalesAmount * 1.2);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {[
          {
            label: "今日营收", value: stats.todaySalesAmount, icon: DollarSign,
            color: "emerald", borderColor: "border-emerald-500/30",
            glow: "shadow-emerald-500/10", iconBg: "bg-emerald-500/15", iconColor: "text-emerald-400",
            trend: salesTrend, trendUp: salesTrend >= 0,
          },
          {
            label: "今日订单", value: stats.todayOrderCount, icon: ShoppingCart,
            color: "cyan", borderColor: "border-cyan-500/30",
            glow: "shadow-cyan-500/10", iconBg: "bg-cyan-500/15", iconColor: "text-cyan-400",
          },
          {
            label: "商品总数", value: stats.productCount, icon: Package,
            color: "blue", borderColor: "border-blue-500/30",
            glow: "shadow-blue-500/10", iconBg: "bg-blue-500/15", iconColor: "text-blue-400",
          },
          {
            label: "活跃供应商", value: stats.supplierCount, icon: UserCheck,
            color: "violet", borderColor: "border-violet-500/30",
            glow: "shadow-violet-500/10", iconBg: "bg-violet-500/15", iconColor: "text-violet-400",
          },
          {
            label: "库存预警", value: stats.lowStockCount, icon: AlertTriangle,
            color: "red", borderColor: "border-red-500/30",
            glow: "shadow-red-500/10", iconBg: "bg-red-500/15", iconColor: "text-red-400",
          },
          {
            label: "待审批采购", value: stats.pendingPurchaseCount, icon: Clock,
            color: "amber", borderColor: "border-amber-500/30",
            glow: "shadow-amber-500/10", iconBg: "bg-amber-500/15", iconColor: "text-amber-400",
          },
        ].map((card, i) => {
          const Icon = card.icon;
          return (
            <div
              key={i}
              className={`bg-slate-900/80 backdrop-blur rounded-2xl border ${card.borderColor} shadow-lg ${card.glow} p-5`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-slate-400 font-medium">{card.label}</span>
                <div className={`w-9 h-9 rounded-xl ${card.iconBg} flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${card.iconColor}`} />
                </div>
              </div>
              <p className="text-3xl font-bold text-white tracking-tight">
                <AnimatedNumber value={card.value} prefix={card.label === "今日营收" ? "¥" : ""} />
              </p>
              {card.trend !== undefined && (
                <div className={`flex items-center gap-1 mt-2 text-xs ${card.trendUp ? "text-emerald-400" : "text-red-400"}`}>
                  {card.trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {Math.abs(card.trend)}% 较昨日
                </div>
              )}
              {card.label === "今日营收" && (
                <div className="mt-3">
                  <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                    <span>目标进度</span>
                    <span>{Math.min(100, Math.round((stats.todaySalesAmount / revenueTarget) * 100))}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-1000"
                      style={{ width: `${Math.min(100, (stats.todaySalesAmount / revenueTarget) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Charts */}
      <Suspense
        fallback={
          <div className="h-[300px]">
            <Skeleton className="h-full w-full rounded-xl bg-slate-800" />
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

      {/* Top Products - Full Width with Horizontal Bars */}
      <div className="bg-slate-900/60 backdrop-blur rounded-2xl border border-slate-800 p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-amber-400" />
          </div>
          <h3 className="text-sm font-semibold text-white">今日热销 Top 10</h3>
        </div>
        {topProducts.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-2">
            {topProducts.map((item, i) => {
              const maxAmount = topProducts[0]?.amount || 1;
              const pct = (item.amount / maxAmount) * 100;
              return (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800/50 transition-colors">
                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                    i === 0 ? "bg-amber-500/20 text-amber-400 shadow-sm shadow-amber-500/20" :
                    i === 1 ? "bg-slate-700 text-slate-300" :
                    i === 2 ? "bg-orange-500/20 text-orange-400" :
                    "bg-slate-800 text-slate-500"
                  }`}>
                    {i + 1}
                  </span>
                  <span className="text-sm text-slate-300 truncate w-28">{item.name}</span>
                  <div className="flex-1 flex items-center gap-2">
                    <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-700"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-400 w-12 text-right">{item.quantity}件</span>
                  </div>
                  <span className="text-sm font-semibold text-white shrink-0 w-20 text-right">¥{formatPrice(item.amount)}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-slate-500 text-center py-8">暂无销售数据</p>
        )}
      </div>

      {/* Bottom panels: Staff + Pending Purchases */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Staff Performance */}
        <div className="bg-slate-900/60 backdrop-blur rounded-2xl border border-slate-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center">
              <UserCheck className="w-4 h-4 text-blue-400" />
            </div>
            <h3 className="text-sm font-semibold text-white">员工绩效排行</h3>
          </div>
          {staffPerformance.length > 0 ? (
            <div className="space-y-2">
              {staffPerformance.slice(0, 5).map((s, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800/50 transition-colors">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-sm text-white font-medium shrink-0 shadow-lg shadow-blue-500/20">
                    {s.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-200 truncate">{s.name}</p>
                    <p className="text-[10px] text-slate-500">{s.role} · {s.salesCount}单</p>
                  </div>
                  <span className="text-sm font-semibold text-emerald-400 shrink-0">¥{formatPrice(s.salesAmount)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 text-center py-8">暂无绩效数据</p>
          )}
        </div>

        {/* Pending Purchases + Expiry Combined */}
        <div className="bg-slate-900/60 backdrop-blur rounded-2xl border border-slate-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-orange-500/10 rounded-lg flex items-center justify-center">
                <Clock className="w-4 h-4 text-orange-400" />
              </div>
              <h3 className="text-sm font-semibold text-white">待审批采购</h3>
            </div>
            <Link to="/purchases" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-0.5">
              全部 <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {pendingPurchases.length > 0 ? (
            <div className="space-y-2">
              {pendingPurchases.map((p) => (
                <Link
                  key={p.id}
                  to={`/purchases/${p.id}`}
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-800 hover:bg-slate-800/50 hover:border-amber-500/30 transition-all"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-slate-500">PO-{String(p.id).padStart(4, "0")}</span>
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-amber-500/10 text-amber-400 border-amber-500/30">待审批</Badge>
                    </div>
                    <p className="text-sm font-medium text-slate-200 truncate">{p.supplier}</p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-sm font-semibold text-white">¥{formatPrice(p.amount)}</p>
                    <p className="text-[10px] text-slate-500">{new Date(p.createdAt).toLocaleDateString("zh-CN", { month: "short", day: "numeric" })}</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 text-center py-8">暂无待审批采购单</p>
          )}

          {/* Expiry warnings mini section */}
          {expiryItems && expiryItems.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-800">
              <div className="flex items-center gap-2 mb-3">
                <CalendarClock className="w-4 h-4 text-amber-400" />
                <h4 className="text-xs font-semibold text-slate-300">临期预警</h4>
              </div>
              <div className="space-y-1.5">
                {expiryItems.slice(0, 3).map((item, i) => (
                  <div key={i} className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-slate-800/50">
                    <span className="text-xs text-slate-300 truncate">{item.productName}</span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                      item.daysLeft <= 7 ? "bg-red-500/20 text-red-400" :
                      item.daysLeft <= 14 ? "bg-amber-500/20 text-amber-400" :
                      "bg-slate-700 text-slate-400"
                    }`}>
                      {item.daysLeft <= 0 ? "已过期" : `${item.daysLeft}天`}
                    </span>
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
