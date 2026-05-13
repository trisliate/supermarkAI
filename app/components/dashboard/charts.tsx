import { useMemo } from "react";
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell,
} from "recharts";
import { TrendingUp, ShoppingCart, Package, AlertTriangle } from "lucide-react";
import { formatPrice } from "~/lib/utils";

interface ChartsProps {
  trendData: Array<{ date: string; 销售额: number; 采购额: number }>;
  pieData: Array<{ name: string; value: number }>;
  inventoryStatus: Record<string, number>;
}

const muted = "#94a3b8";

const PIE_COLORS = ["#3b82f6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#6366f1", "#14b8a6"];

const STATUS_COLORS: Record<string, string> = {
  "缺货": "#ef4444",
  "偏低": "#f59e0b",
  "正常": "#10b981",
  "充足": "#3b82f6",
};

function MiniTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ color?: string; value?: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 shadow-lg">
      <p className="text-[11px] text-slate-400 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-sm font-semibold" style={{ color: p.color }}>
          ¥{formatPrice(p.value ?? 0)}
        </p>
      ))}
    </div>
  );
}

function PieTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name?: string; value?: number; payload?: { percent?: number } }> }) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const pct = item.payload?.percent;
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 shadow-lg">
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{item.name}</p>
      <p className="text-xs text-slate-500">{item.value} 个{pct != null ? ` · ${(pct * 100).toFixed(1)}%` : ""}</p>
    </div>
  );
}

function ChartCard({ title, icon: Icon, children, value, subtitle, className }: {
  title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode; value?: string; subtitle?: string; className?: string;
}) {
  return (
    <div className={`bg-gradient-to-br from-white to-slate-50/80 dark:from-slate-900 dark:to-slate-900/80 rounded-xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm p-5 ${className || ""}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="w-4 h-4 text-primary" />
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</span>
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
            <Tooltip content={<PieTooltip />} />
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

function StatusDonut({ data }: { data: Record<string, number> }) {
  const entries = useMemo(() => Object.entries(data).filter(([_, v]) => v > 0), [data]);
  const total = useMemo(() => entries.reduce((s, [_, v]) => s + v, 0), [entries]);
  const chartData = entries.map(([name, value]) => ({ name, value }));

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: 160, height: 160 }}>
        <ResponsiveContainer width={160} height={160}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={75}
              paddingAngle={3}
              dataKey="value"
              stroke="none"
            >
              {chartData.map((entry) => (
                <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || muted} />
              ))}
            </Pie>
            <Tooltip content={<PieTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-bold text-slate-900 dark:text-white">{total}</span>
          <span className="text-[10px] text-slate-400">SKU</span>
        </div>
      </div>
      <div className="flex-1 space-y-1.5 min-w-0">
        {entries.map(([name, value]) => (
          <div key={name} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: STATUS_COLORS[name] || muted }} />
            <span className="text-xs text-slate-600 dark:text-slate-400 flex-1">{name}</span>
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 tabular-nums">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Charts({ trendData, pieData, inventoryStatus }: ChartsProps) {
  const totalSales = useMemo(
    () => trendData.reduce((s, d) => s + d.销售额, 0),
    [trendData],
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Sales trend - Area chart */}
      <ChartCard title="销售趋势" icon={TrendingUp} value={`¥${formatPrice(totalSales)}`} subtitle="近7天累计">
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: muted }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: muted }} axisLine={false} tickLine={false} width={50} />
              <Tooltip content={<MiniTooltip />} />
              <Area type="monotone" dataKey="销售额" stroke="#3b82f6" strokeWidth={2} fill="url(#salesGrad)" dot={false} activeDot={{ r: 4, fill: "#3b82f6", stroke: "#fff", strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {/* Purchase vs Sales - thin lines */}
      <ChartCard title="采购 vs 销售" icon={ShoppingCart}>
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: muted }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: muted }} axisLine={false} tickLine={false} width={50} />
              <Tooltip content={<MiniTooltip />} />
              <Line type="monotone" dataKey="销售额" stroke="#3b82f6" strokeWidth={1.5} dot={false} activeDot={{ r: 3, fill: "#3b82f6", stroke: "#fff", strokeWidth: 2 }} />
              <Line type="monotone" dataKey="采购额" stroke="#8b5cf6" strokeWidth={1.5} dot={false} activeDot={{ r: 3, fill: "#8b5cf6", stroke: "#fff", strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center gap-4 mt-2 px-1">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-[2px] rounded-full bg-primary" />
            <span className="text-[11px] text-slate-400">销售额</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-[2px] rounded-full" style={{ backgroundColor: "#8b5cf6" }} />
            <span className="text-[11px] text-slate-400">采购额</span>
          </div>
        </div>
      </ChartCard>

      {/* Category distribution - donut chart */}
      <ChartCard title="分类分布" icon={Package}>
        <CategoryDonut data={pieData} />
      </ChartCard>

      {/* Inventory status - donut chart */}
      <ChartCard title="库存状态" icon={AlertTriangle}>
        <StatusDonut data={inventoryStatus} />
      </ChartCard>
    </div>
  );
}
