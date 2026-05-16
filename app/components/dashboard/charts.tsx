import { useMemo } from "react";
import {
  AreaChart, Area, BarChart, Bar,
  RadialBarChart, RadialBar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell,
} from "recharts";
import { TrendingUp, Package, AlertTriangle, BarChart3, Gauge } from "lucide-react";
import { formatPrice } from "~/lib/utils";

interface ChartsProps {
  trendData: Array<{ date: string; 销售额: number; 采购额: number }>;
  pieData: Array<{ name: string; value: number }>;
  inventoryStatus: Record<string, number>;
}

const muted = "#94a3b8";
const gridStroke = "#e2e8f0";

const PIE_COLORS = ["#60a5fa", "#22d3ee", "#34d399", "#fbbf24", "#f87171", "#f472b6", "#818cf8", "#2dd4bf"];

const STATUS_COLORS: Record<string, string> = {
  "缺货": "#f87171",
  "偏低": "#fbbf24",
  "正常": "#34d399",
  "充足": "#60a5fa",
};

function MiniTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ color?: string; value?: number; dataKey?: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 shadow-lg">
      <p className="text-[11px] text-slate-400 mb-1">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-[11px] text-slate-500">{p.dataKey}</span>
          <span className="text-sm font-semibold" style={{ color: p.color }}>
            ¥{formatPrice(p.value ?? 0)}
          </span>
        </div>
      ))}
    </div>
  );
}

function ChartCard({ title, icon: Icon, children, value, subtitle, className }: {
  title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode; value?: string; subtitle?: string; className?: string;
}) {
  return (
    <div className={`bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 ${className || ""}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="w-4 h-4 text-primary" />
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{title}</span>
        </div>
        {value && (
          <div className="text-right">
            <span className="text-xl font-bold text-slate-900 dark:text-white">{value}</span>
            {subtitle && <p className="text-[11px] text-slate-400">{subtitle}</p>}
          </div>
        )}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function CategoryDonut({ data }: { data: Array<{ name: string; value: number }> }) {
  const total = useMemo(() => data.reduce((s, d) => s + d.value, 0), [data]);

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: 160, height: 160 }}>
        <ResponsiveContainer width={160} height={160}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={75}
              paddingAngle={2}
              dataKey="value"
              stroke="none"
            >
              {data.map((_, i) => (
                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const item = payload[0];
                return (
                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 shadow-lg">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{item.name}</p>
                    <p className="text-xs text-slate-500">{item.value} 个</p>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-bold text-slate-900 dark:text-white">{total}</span>
          <span className="text-[10px] text-slate-400">商品</span>
        </div>
      </div>
      <div className="flex-1 space-y-1.5 min-w-0">
        {data.sort((a, b) => b.value - a.value).map((item, i) => (
          <div key={item.name} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
            <span className="text-xs text-slate-600 dark:text-slate-400 truncate flex-1">{item.name}</span>
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 tabular-nums">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Horizontal stacked bar showing inventory status distribution */
function HorizontalStatusBar({ data }: { data: Record<string, number> }) {
  const entries = useMemo(() => {
    const order = ["缺货", "偏低", "正常", "充足"];
    return order
      .map((name) => ({ name, value: data[name] || 0 }))
      .filter((e) => e.value > 0);
  }, [data]);
  const total = useMemo(() => entries.reduce((s, e) => s + e.value, 0), [entries]);

  if (total === 0) return null;

  return (
    <div className="space-y-3">
      {/* Stacked bar */}
      <div className="flex h-8 rounded-lg overflow-hidden shadow-inner">
        {entries.map((e) => (
          <div
            key={e.name}
            className="flex items-center justify-center transition-all duration-500"
            style={{
              width: `${(e.value / total) * 100}%`,
              backgroundColor: STATUS_COLORS[e.name] || muted,
              minWidth: e.value > 0 ? "2rem" : 0,
            }}
          >
            <span className="text-[10px] font-bold text-white drop-shadow-sm">{e.value}</span>
          </div>
        ))}
      </div>
      {/* Legend */}
      <div className="flex items-center justify-between">
        {entries.map((e) => (
          <div key={e.name} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[e.name] || muted }} />
            <span className="text-[11px] text-slate-500">{e.name}</span>
            <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">{e.value}</span>
            <span className="text-[10px] text-slate-400">({((e.value / total) * 100).toFixed(0)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Radial gauge showing today revenue vs target */
export function RadialGauge({ todayAmount, targetAmount }: { todayAmount: number; targetAmount: number }) {
  const pct = targetAmount > 0 ? Math.min(Math.round((todayAmount / targetAmount) * 100), 100) : 0;
  const gaugeData = [{ name: "达成率", value: pct, fill: pct >= 80 ? "#34d399" : pct >= 50 ? "#fbbf24" : "#f87171" }];

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: 120, height: 120 }}>
        <ResponsiveContainer width={120} height={120}>
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="70%"
            outerRadius="100%"
            barSize={10}
            data={gaugeData}
            startAngle={90}
            endAngle={-270}
          >
            <RadialBar
              background={{ fill: "#e2e8f0" }}
              dataKey="value"
              cornerRadius={5}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xl font-bold text-slate-900 dark:text-white">{pct}%</span>
          <span className="text-[9px] text-slate-400">达成率</span>
        </div>
      </div>
      <div className="flex-1 space-y-2 min-w-0">
        <div>
          <p className="text-[10px] text-slate-400 uppercase tracking-wider">今日营收</p>
          <p className="text-base font-bold text-emerald-600">¥{formatPrice(todayAmount)}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-400 uppercase tracking-wider">目标</p>
          <p className="text-sm font-semibold text-slate-500">¥{formatPrice(targetAmount)}</p>
        </div>
        <p className="text-[10px] text-slate-400">目标为昨日营收的 120%</p>
      </div>
    </div>
  );
}

export function BarChartCard({ data, title }: { data: Array<{ name: string; value: number; fill?: string }>; title: string }) {
  if (!data || data.length === 0) return null;
  const colors = ["#3b82f6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#6366f1"];
  return (
    <ChartCard title={title} icon={BarChart3}>
      <div style={{ width: "100%", height: 220 }}>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} barSize={28}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: muted }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: muted }} axisLine={false} tickLine={false} width={50} />
            <Tooltip
              cursor={{ fill: "rgba(148,163,184,0.08)" }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 shadow-lg">
                    <p className="text-[11px] text-slate-400 mb-1">{label}</p>
                    <p className="text-sm font-semibold text-primary">{payload[0].value}</p>
                  </div>
                );
              }}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.fill || colors[i % colors.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

export function Charts({ trendData, pieData, inventoryStatus, todayAmount, targetAmount }: ChartsProps & { todayAmount?: number; targetAmount?: number }) {
  const totalSales = useMemo(
    () => trendData.reduce((s, d) => s + d.销售额, 0),
    [trendData],
  );
  const totalPurchases = useMemo(
    () => trendData.reduce((s, d) => s + d.采购额, 0),
    [trendData],
  );

  // Aggregate trend data into weekly summaries
  const weeklyData = useMemo(() => {
    if (trendData.length === 0) return [];
    const weeks: Array<{ name: string; 销售额: number; 采购额: number }> = [];
    for (let i = 0; i < trendData.length; i += 7) {
      const chunk = trendData.slice(i, i + 7);
      const weekNum = Math.floor(i / 7) + 1;
      weeks.push({
        name: `第${weekNum}周`,
        销售额: chunk.reduce((s, d) => s + d.销售额, 0),
        采购额: chunk.reduce((s, d) => s + d.采购额, 0),
      });
    }
    return weeks;
  }, [trendData]);

  const hasTrend = trendData.some((d) => d.销售额 > 0 || d.采购额 > 0);
  const hasPie = pieData.length > 0;
  const hasStatus = Object.values(inventoryStatus).some((v) => v > 0);
  const hasGauge = todayAmount != null && targetAmount != null;
  const hasAnyData = hasTrend || hasPie || hasStatus;

  if (!hasAnyData) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        <BarChart3 className="w-12 h-12 mb-3 opacity-30" />
        <p className="text-sm font-medium">暂无数据</p>
        <p className="text-xs mt-1">开始录入销售和采购数据后，图表将自动展示</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Combined Sales & Purchase Trend - spans full width */}
      {hasTrend && (
        <ChartCard
          title="销售与采购趋势"
          icon={TrendingUp}
          className="lg:col-span-2"
        >
          {/* Summary stats */}
          <div className="flex items-center gap-6 mb-4">
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">总销售额</p>
              <p className="text-lg font-bold text-blue-600 dark:text-blue-400">¥{formatPrice(totalSales)}</p>
            </div>
            <div className="w-px h-8 bg-slate-200 dark:bg-slate-700" />
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">总采购额</p>
              <p className="text-lg font-bold text-violet-600 dark:text-violet-400">¥{formatPrice(totalPurchases)}</p>
            </div>
            <div className="w-px h-8 bg-slate-200 dark:bg-slate-700" />
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">毛利润</p>
              <p className={`text-lg font-bold ${totalSales - totalPurchases >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                ¥{formatPrice(totalSales - totalPurchases)}
              </p>
            </div>
          </div>
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="purchaseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: muted }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: muted }} axisLine={false} tickLine={false} width={50} />
                <Tooltip content={<MiniTooltip />} />
                <Area type="monotone" dataKey="销售额" stroke="#3b82f6" strokeWidth={2} fill="url(#salesGrad)" dot={false} activeDot={{ r: 4, fill: "#3b82f6", stroke: "#fff", strokeWidth: 2 }} />
                <Area type="monotone" dataKey="采购额" stroke="#8b5cf6" strokeWidth={2} fill="url(#purchaseGrad)" dot={false} activeDot={{ r: 4, fill: "#8b5cf6", stroke: "#fff", strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-4 mt-2 px-1">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-[2px] rounded-full bg-blue-500" />
              <span className="text-[11px] text-slate-400">销售额</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-[2px] rounded-full bg-violet-500" />
              <span className="text-[11px] text-slate-400">采购额</span>
            </div>
          </div>
        </ChartCard>
      )}

      {/* Category distribution - donut chart */}
      {hasPie && (
        <ChartCard title="分类分布" icon={Package}>
          <CategoryDonut data={pieData} />
        </ChartCard>
      )}

      {/* Revenue gauge + Inventory horizontal bar */}
      {(hasGauge || hasStatus) && (
        <>
          {hasGauge && (
            <ChartCard title="营收达成" icon={Gauge}>
              <RadialGauge todayAmount={todayAmount!} targetAmount={targetAmount!} />
            </ChartCard>
          )}
          {hasStatus && !hasGauge && (
            <ChartCard title="库存状态" icon={AlertTriangle}>
              <HorizontalStatusBar data={inventoryStatus} />
            </ChartCard>
          )}
        </>
      )}

      {/* Inventory status horizontal bar (when gauge exists too) */}
      {hasStatus && hasGauge && (
        <ChartCard title="库存状态" icon={AlertTriangle} className="lg:col-span-2">
          <HorizontalStatusBar data={inventoryStatus} />
        </ChartCard>
      )}

      {/* Weekly summary bar chart */}
      {hasTrend && weeklyData.length > 1 && (
        <ChartCard title="周度汇总" icon={BarChart3} className="lg:col-span-2">
          <div style={{ width: "100%", height: 200 }}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weeklyData} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: muted }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: muted }} axisLine={false} tickLine={false} width={50} />
                <Tooltip
                  cursor={{ fill: "rgba(148,163,184,0.08)" }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 shadow-lg">
                        <p className="text-[11px] text-slate-400 mb-1">{label}</p>
                        {payload.map((p, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                            <span className="text-[11px] text-slate-500">{String(p.dataKey ?? "")}</span>
                            <span className="text-sm font-semibold" style={{ color: p.color }}>
                              ¥{formatPrice(Number(p.value) || 0)}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  }}
                />
                <Bar dataKey="销售额" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="采购额" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-4 mt-2 px-1">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-blue-500" />
              <span className="text-[11px] text-slate-400">销售额</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-violet-500" />
              <span className="text-[11px] text-slate-400">采购额</span>
            </div>
          </div>
        </ChartCard>
      )}
    </div>
  );
}
