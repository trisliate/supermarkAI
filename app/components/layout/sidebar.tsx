import { Link, useLocation } from "react-router";
import type { AuthUser } from "~/lib/auth";
import {
  LayoutDashboard, Users, Package, Tags, Truck,
  ShoppingCart, Warehouse, Receipt, Store,
  AlertTriangle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface NavGroup {
  label?: string;
  items: NavItem[];
}

interface NavItem {
  label: string;
  href: string;
  roles: string[];
  icon: LucideIcon;
  badge?: string;
}

const navGroups: NavGroup[] = [
  {
    items: [
      { label: "仪表盘", href: "/dashboard", roles: ["admin", "purchaser", "inventory_keeper", "cashier"], icon: LayoutDashboard },
    ],
  },
  {
    label: "运营管理",
    items: [
      { label: "商品管理", href: "/products", roles: ["admin"], icon: Package },
      { label: "分类管理", href: "/categories", roles: ["admin"], icon: Tags },
      { label: "供应商管理", href: "/suppliers", roles: ["admin", "purchaser"], icon: Truck },
    ],
  },
  {
    label: "供应链",
    items: [
      { label: "采购管理", href: "/purchases", roles: ["admin", "purchaser"], icon: ShoppingCart },
      { label: "库存管理", href: "/inventory", roles: ["admin", "inventory_keeper"], icon: Warehouse },
      { label: "库存预警", href: "/inventory", roles: ["inventory_keeper"], icon: AlertTriangle },
    ],
  },
  {
    label: "销售",
    items: [
      { label: "销售管理", href: "/sales", roles: ["admin", "cashier"], icon: Receipt },
      { label: "收银台", href: "/sales/new", roles: ["admin", "cashier"], icon: Store },
    ],
  },
  {
    label: "系统",
    items: [
      { label: "用户管理", href: "/users", roles: ["admin"], icon: Users },
    ],
  },
];

// Role-specific dashboard labels
const dashboardLabels: Record<string, string> = {
  admin: "仪表盘",
  purchaser: "采购工作台",
  inventory_keeper: "库存工作台",
  cashier: "销售工作台",
};

const roleColors: Record<string, string> = {
  admin: "bg-red-500",
  purchaser: "bg-blue-500",
  inventory_keeper: "bg-emerald-500",
  cashier: "bg-purple-500",
};

export function Sidebar({ user }: { user: AuthUser }) {
  const location = useLocation();

  return (
    <aside className="w-64 min-h-screen flex flex-col" style={{ background: "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)" }}>
      {/* Logo */}
      <div className="p-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
            <Store className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight">超市管理系统</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <div className={`w-2 h-2 rounded-full ${roleColors[user.role]}`} />
              <span className="text-xs text-slate-400">{user.name}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
        {navGroups.map((group, gi) => {
          const filteredItems = group.items.filter((item) => item.roles.includes(user.role));
          if (filteredItems.length === 0) return null;

          return (
            <div key={gi}>
              {group.label && (
                <div className="px-3 mb-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    {group.label}
                  </span>
                </div>
              )}
              <div className="space-y-0.5">
                {filteredItems.map((item) => {
                  const isActive =
                    location.pathname === item.href ||
                    (item.href !== "/dashboard" && location.pathname.startsWith(item.href + "/"));
                  const Icon = item.icon;
                  const label = item.href === "/dashboard" ? dashboardLabels[user.role] : item.label;

                  return (
                    <Link
                      key={item.href + item.label}
                      to={item.href}
                      className={`
                        flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 group relative
                        ${isActive
                          ? "bg-white/15 text-white shadow-sm"
                          : "text-slate-400 hover:bg-white/8 hover:text-white"
                        }
                      `}
                    >
                      {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-blue-400 rounded-r-full" />
                      )}
                      <Icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? "text-blue-400" : "text-slate-500 group-hover:text-slate-300"}`} />
                      <span className="truncate">{label}</span>
                      {item.badge && (
                        <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-red-500 text-white font-medium">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-white/10">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-slate-600">v1.0.0</span>
          <span className="text-[11px] text-slate-600">SuperMarket</span>
        </div>
      </div>
    </aside>
  );
}
