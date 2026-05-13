import { useLocation, useNavigate } from "react-router";
import type { AuthUser } from "~/lib/auth";
import {
  LayoutDashboard, Users, Package, Tags, Truck,
  ShoppingCart, Warehouse, Receipt, Store, Sparkles, Bell,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Sidebar as ShadSidebar,
  SidebarContent as ShadSidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "~/components/ui/sidebar";

interface NavItem {
  label: string;
  href: string;
  roles: string[];
  icon: LucideIcon;
}

interface NavGroup {
  label?: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    items: [
      { label: "经营总览", href: "/dashboard", roles: ["admin", "purchaser", "inventory_keeper", "cashier"], icon: LayoutDashboard },
    ],
  },
  {
    label: "运营管理",
    items: [
      { label: "商品管理", href: "/products", roles: ["admin", "purchaser", "inventory_keeper"], icon: Package },
      { label: "分类管理", href: "/categories", roles: ["admin"], icon: Tags },
      { label: "供应商管理", href: "/suppliers", roles: ["admin", "purchaser"], icon: Truck },
    ],
  },
  {
    label: "供应链",
    items: [
      { label: "采购管理", href: "/purchases", roles: ["admin", "purchaser"], icon: ShoppingCart },
      { label: "库存管理", href: "/inventory", roles: ["admin", "inventory_keeper"], icon: Warehouse },
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
      { label: "通知管理", href: "/notifications", roles: ["admin"], icon: Bell },
      { label: "AI 设置", href: "/settings/ai", roles: ["admin"], icon: Sparkles },
    ],
  },
];

export function AppSidebar({ user }: { user: AuthUser }) {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (href: string) => location.pathname === href;

  return (
    <ShadSidebar
      variant="sidebar"
      collapsible="icon"
      className="bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800"
    >
      {/* Header: logo stays fixed, text fades out */}
      <SidebarHeader className="border-b border-slate-200/60 dark:border-slate-700/60 p-3">
        <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-600 flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/20 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:h-8">
            <Store className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0 flex-1 overflow-hidden transition-opacity duration-200 group-data-[collapsible=icon]:opacity-0">
            <h2 className="text-sm font-bold text-slate-800 dark:text-white tracking-tight truncate whitespace-nowrap">SuperMarket</h2>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate whitespace-nowrap">智慧运营管理系统</p>
          </div>
        </div>
      </SidebarHeader>

      <ShadSidebarContent className="py-2">
        {navGroups.map((group, gi) => {
          const filteredItems = group.items.filter((item) => item.roles.includes(user.role));
          if (filteredItems.length === 0) return null;

          return (
            <SidebarGroup key={gi} className="group-data-[collapsible=icon]:p-0">
              {group.label && (
                <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-2 mb-1">
                  {group.label}
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu className="group-data-[collapsible=icon]:px-1">
                  {filteredItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);

                    return (
                      <SidebarMenuItem key={item.href + item.label}>
                        <SidebarMenuButton
                          render={<button type="button" onClick={(e) => { e.stopPropagation(); navigate(item.href); }} />}
                          isActive={active}
                          tooltip={item.label}
                          className="gap-3 h-9 rounded-xl text-[13px] cursor-pointer hover:bg-slate-100/80 dark:hover:bg-slate-800/60 data-[active=true]:bg-blue-50 data-[active=true]:text-blue-700 dark:data-[active=true]:bg-blue-950/40 dark:data-[active=true]:text-blue-400 group-data-[collapsible=icon]:after:absolute group-data-[collapsible=icon]:after:-inset-y-1.5 group-data-[collapsible=icon]:after:-inset-x-1 group-data-[collapsible=icon]:after:rounded-lg group-data-[collapsible=icon]:after:z-10"
                        >
                          <Icon className="w-4 h-4 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </ShadSidebarContent>
    </ShadSidebar>
  );
}
