import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  trend?: { value: number; isUp: boolean };
  subtitle?: string;
  sparkline?: number[];
}

function SparklineSVG({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 80;
  const h = 28;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  });
  const lineColor = color.includes("emerald") || color.includes("green")
    ? "#10b981" : color.includes("blue")
    ? "#3b82f6" : color.includes("amber") || color.includes("yellow")
    ? "#f59e0b" : color.includes("purple") || color.includes("violet")
    ? "#8b5cf6" : color.includes("cyan") || color.includes("teal")
    ? "#06b6d4" : "#6366f1";

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="opacity-60">
      <polyline
        fill="none"
        stroke={lineColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points.join(" ")}
      />
    </svg>
  );
}

export function StatCard({ label, value, icon: Icon, color, trend, subtitle, sparkline }: StatCardProps) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 hover:shadow-md transition-shadow group">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{label}</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1.5 tracking-tight">{value}</p>
          {trend && (
            <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trend.isUp ? "text-emerald-600" : "text-red-500"}`}>
              <span>{trend.isUp ? "↑" : "↓"}</span>
              <span>{Math.abs(trend.value)}%</span>
              <span className="text-slate-400 dark:text-slate-500">vs 昨日</span>
            </div>
          )}
          {subtitle && (
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">{subtitle}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-sm ${color} group-hover:scale-105 transition-transform`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          {sparkline && <SparklineSVG data={sparkline} color={color} />}
        </div>
      </div>
    </div>
  );
}
