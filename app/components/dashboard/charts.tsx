import { useMemo } from "react";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { TrendingUp, ShoppingCart, Package, AlertTriangle } from "lucide-react";
import { formatPrice } from "~/lib/utils";

interface ChartsProps {
  trendData: Array<{ date: string; 销售额: number; 采购额: number }>;
  pieData: Array<{ name: string; value: number }>;
  inventoryStatus: Record<string, number>;
}

const accent = "#3b82f6";
const accent2 = "#8b5cf6";
const muted = "#94a3b8";

function MiniTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 shadow-lg">
      <p className="text-[11px] text-slate-400 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-sm font-semibold" style={{ color: p.color }}>
          ¥{formatPrice(p.value)}
        </p>
      ))}
    </div>
  );
}

function ChartCard({ title, icon: Icon, children, value, subtitle }: {
  title: string; icon: any; children: React.ReactNode; value?: string; subtitle?: string;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{title}</span>
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

function StatusBars({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data).filter(([_, v]) => v > 0);
  const total = entries.reduce((sum, [_, v]) => sum + v, 0);
  const colors: Record<string, string> = {
    "缺货": "#ef4444", "偏低": "#f59e0b", "正常": "#22c55e", "充足": "#3b82f6",
  };

  return (
    <div className="space-y-3">
      {/* Bar */}
      <div className="flex h-2 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
        {entries.map(([name, value]) => (
          <div
            key={name}
            className="transition-all duration-500"
            style={{ width: `${(value / total) * 100}%`, backgroundColor: colors[name] || muted }}
          />
        ))}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {entries.map(([name, value]) => (
          <div key={name} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors[name] || muted }} />
            <span className="text-xs text-slate-500">{name}</span>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CategoryBars({ data }: { data: Array<{ name: string; value: number }> }) {
  const sorted = useMemo(() => [...data].sort((a, b) => b.value - a.value), [data]);
  const max = sorted[0]?.value || 1;

  return (
    <div className="space-y-2">
      {sorted.map((item, i) => (
        <div key={item.name} className="flex items-center gap-3">
          <span className="text-xs text-slate-400 w-16 text-right truncate">{item.name}</span>
          <div className="flex-1 h-5 bg-slate-50 dark:bg-slate-800 rounded overflow-hidden">
            <div
              className="h-full rounded transition-all duration-700"
              style={{
                width: `${(item.value / max) * 100}%`,
                backgroundColor: i === 0 ? accent : `${accent}${Math.max(30, 99 - i * 15).toString(16)}`,
              }}
            />
          </div>
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 w-8 text-right">{item.value}</span>
        </div>
      ))}
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
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={trendData}>
            <defs>
              <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accent} stopOpacity={0.15} />
                <stop offset="100%" stopColor={accent} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: muted }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: muted }} axisLine={false} tickLine={false} width={50} />
            <Tooltip content={<MiniTooltip />} />
            <Area type="monotone" dataKey="销售额" stroke={accent} strokeWidth={2} fill="url(#salesGrad)" dot={false} activeDot={{ r: 4, fill: accent, stroke: "#fff", strokeWidth: 2 }} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Purchase vs Sales - thin lines */}
      <ChartCard title="采购 vs 销售" icon={ShoppingCart}>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: muted }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: muted }} axisLine={false} tickLine={false} width={50} />
            <Tooltip content={<MiniTooltip />} />
            <Line type="monotone" dataKey="销售额" stroke={accent} strokeWidth={1.5} dot={false} activeDot={{ r: 3, fill: accent, stroke: "#fff", strokeWidth: 2 }} />
            <Line type="monotone" dataKey="采购额" stroke={accent2} strokeWidth={1.5} dot={false} activeDot={{ r: 3, fill: accent2, stroke: "#fff", strokeWidth: 2 }} />
          </LineChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-4 mt-2 px-1">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-[2px] rounded-full" style={{ backgroundColor: accent }} />
            <span className="text-[11px] text-slate-400">销售额</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-[2px] rounded-full" style={{ backgroundColor: accent2 }} />
            <span className="text-[11px] text-slate-400">采购额</span>
          </div>
        </div>
      </ChartCard>

      {/* Category distribution - horizontal bars */}
      <ChartCard title="分类分布" icon={Package}>
        <CategoryBars data={pieData} />
      </ChartCard>

      {/* Inventory status - segmented bar */}
      <ChartCard title="库存状态" icon={AlertTriangle}>
        <StatusBars data={inventoryStatus} />
      </ChartCard>
    </div>
  );
}
