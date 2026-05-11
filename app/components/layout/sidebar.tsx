import { Link, useLocation } from "react-router";
import { useSidebar } from "~/components/ui/sidebar";
import type { AuthUser } from "~/lib/auth";
import { roleLabels } from "~/lib/auth";
import {
  LayoutDashboard, Users, Package, Tags, Truck,
  ShoppingCart, Warehouse, Receipt, Store,
  AlertTriangle, Bot, ChevronRight,
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "~/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";

interface NavItem {
  label: string;
  href: string;
  roles: string[];
  icon: LucideIcon;
  children?: NavItem[];
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
      { label: "库存预警", href: "/inventory", roles: ["inventory_keeper"], icon: AlertTriangle },
    ],
  },
  {
    label: "销售",
    items: [
      {
        label: "销售管理", href: "/sales", roles: ["admin", "cashier"], icon: Receipt,
        children: [
          { label: "收银台", href: "/sales/new", roles: ["admin", "cashier"], icon: Store },
        ],
      },
    ],
  },
  {
    label: "系统",
    items: [
      { label: "用户管理", href: "/users", roles: ["admin"], icon: Users },
      { label: "AI 设置", href: "/settings/ai", roles: ["admin"], icon: Bot },
    ],
  },
];

const roleDotColors: Record<string, string> = {
  admin: "bg-amber-500",
  purchaser: "bg-blue-500",
  inventory_keeper: "bg-teal-500",
  cashier: "bg-purple-500",
};

export function AppSidebar({ user }: { user: AuthUser }) {
  const location = useLocation();
  const { state } = useSidebar();

  const isActive = (href: string) =>
    location.pathname === href ||
    (href !== "/dashboard" && location.pathname.startsWith(href + "/"));

  return (
    <ShadSidebar
      variant="sidebar"
      collapsible="icon"
      className="bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800"
    >
      <SidebarHeader className="border-b border-slate-200/60 dark:border-slate-700/60 p-4">
        <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
          <div className="w-10 h-10 bg-slate-900 dark:bg-white rounded-xl flex items-center justify-center shrink-0 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:h-8">
            <Store className="w-5 h-5 text-white dark:text-slate-900" />
          </div>
          <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <h2 className="text-sm font-bold text-slate-800 dark:text-white tracking-tight truncate">超市管理系统</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className={`w-1.5 h-1.5 rounded-full ${roleDotColors[user.role]}`} />
              <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{user.name} · {roleLabels[user.role]}</span>
            </div>
          </div>
        </div>
      </SidebarHeader>

      <ShadSidebarContent className="py-2">
        {navGroups.map((group, gi) => {
          const filteredItems = group.items.filter((item) => item.roles.includes(user.role));
          if (filteredItems.length === 0) return null;

          return (
            <SidebarGroup key={gi}>
              {group.label && (
                <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-2 mb-1">
                  {group.label}
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  {filteredItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    const hasChildren = item.children && item.children.length > 0;

                    if (hasChildren) {
                      if (state === "collapsed") {
                        return (
                          <SidebarMenuItem key={item.href + item.label}>
                            <SidebarMenuButton
                              render={<Link to={item.href} />}
                              isActive={active}
                              tooltip={item.label}
                              className="gap-3 h-9 rounded-xl text-[13px] hover:bg-slate-100/80 dark:hover:bg-slate-800/60 data-[active=true]:bg-blue-50 data-[active=true]:text-blue-700 dark:data-[active=true]:bg-blue-950/40 dark:data-[active=true]:text-blue-400"
                            >
                              <Icon className="w-4 h-4 shrink-0" />
                              <span className="truncate">{item.label}</span>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      }
                      return (
                        <Collapsible key={item.href + item.label} defaultOpen className="group/collapsible">
                          <SidebarMenuItem>
                            <CollapsibleTrigger
                              className="flex w-full items-center gap-3 h-9 rounded-xl px-2 text-[13px] text-left transition-colors hover:bg-slate-100/80 dark:hover:bg-slate-800/60 data-[active=true]:bg-blue-50 data-[active=true]:text-blue-700 dark:data-[active=true]:bg-blue-950/40 dark:data-[active=true]:text-blue-400"
                              data-active={active || undefined}
                            >
                              <Icon className="w-4 h-4 shrink-0" />
                              <span className="truncate flex-1">{item.label}</span>
                              <ChevronRight className="w-3.5 h-3.5 shrink-0 text-slate-400 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <SidebarMenuSub>
                                {item.children!.filter((c) => c.roles.includes(user.role)).map((child) => {
                                  const ChildIcon = child.icon;
                                  return (
                                    <SidebarMenuSubItem key={child.href}>
                                      <SidebarMenuSubButton
                                        render={<Link to={child.href} />}
                                        isActive={isActive(child.href)}
                                        className="h-8 rounded-lg text-[12px] hover:bg-slate-100/80 dark:hover:bg-slate-800/60 data-[active=true]:bg-blue-50 data-[active=true]:text-blue-700 dark:data-[active=true]:bg-blue-950/40 dark:data-[active=true]:text-blue-400"
                                      >
                                        <ChildIcon className="w-3.5 h-3.5 shrink-0" />
                                        <span>{child.label}</span>
                                      </SidebarMenuSubButton>
                                    </SidebarMenuSubItem>
                                  );
                                })}
                              </SidebarMenuSub>
                            </CollapsibleContent>
                          </SidebarMenuItem>
                        </Collapsible>
                      );
                    }

                    return (
                      <SidebarMenuItem key={item.href + item.label}>
                        <SidebarMenuButton
                          render={<Link to={item.href} />}
                          isActive={active}
                          tooltip={item.label}
                          className="gap-3 h-9 rounded-xl text-[13px] hover:bg-slate-100/80 dark:hover:bg-slate-800/60 data-[active=true]:bg-blue-50 data-[active=true]:text-blue-700 dark:data-[active=true]:bg-blue-950/40 dark:data-[active=true]:text-blue-400"
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
