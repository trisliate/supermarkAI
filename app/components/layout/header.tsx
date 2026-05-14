import { Form, Link, useLocation } from "react-router";
import { useState, useEffect, useRef } from "react";
import type { AuthUser } from "~/lib/auth";
import { roleLabels } from "~/lib/auth";
import { Cat, Palette, LogOut, Sun, Moon, Monitor, PanelLeft, Sparkles, ArrowLeft, ArrowRight, LayoutDashboard, Users, Package, Tags, Truck, ShoppingCart, Warehouse, Receipt, Store, Bell, History, KeyRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NotificationDropdown } from "~/components/notification-dropdown";
import { AvatarWithFallback } from "~/components/ui/avatar-with-fallback";
import { useTheme, type AccentColor } from "~/components/theme-provider";
import { Switch } from "~/components/ui/switch";
import { useSidebar } from "~/components/ui/sidebar";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { useNavigationHistory } from "~/hooks/use-navigation-history";

const pageTitles: Record<string, { title: string; icon: LucideIcon }> = {
  "/dashboard": { title: "仪表盘", icon: LayoutDashboard },
  "/users/new": { title: "新增用户", icon: Users },
  "/users/*/edit": { title: "编辑用户", icon: Users },
  "/users": { title: "用户管理", icon: Users },
  "/products/new": { title: "新增商品", icon: Package },
  "/products/*/edit": { title: "编辑商品", icon: Package },
  "/products": { title: "商品管理", icon: Package },
  "/categories": { title: "分类管理", icon: Tags },
  "/suppliers/new": { title: "新增供应商", icon: Truck },
  "/suppliers/*/edit": { title: "编辑供应商", icon: Truck },
  "/suppliers": { title: "供应商管理", icon: Truck },
  "/purchases/new": { title: "新建采购单", icon: ShoppingCart },
  "/purchases/*": { title: "采购详情", icon: ShoppingCart },
  "/purchases": { title: "采购管理", icon: ShoppingCart },
  "/inventory/log": { title: "出入库记录", icon: History },
  "/inventory/*": { title: "库存详情", icon: Warehouse },
  "/inventory": { title: "库存管理", icon: Warehouse },
  "/sales/new": { title: "收银台", icon: Store },
  "/sales": { title: "销售管理", icon: Receipt },
  "/profile": { title: "个人信息", icon: Users },
  "/settings/ai": { title: "API Key 配置", icon: KeyRound },
  "/notifications": { title: "通知管理", icon: Bell },
};

function matchPageTitle(pathname: string): { title: string; icon: LucideIcon } | undefined {
  const sorted = Object.entries(pageTitles).sort(([a], [b]) => b.length - a.length);
  for (const [pattern, value] of sorted) {
    if (!pattern.includes("*")) {
      if (pathname === pattern || pathname.startsWith(pattern + "/")) return value;
    } else {
      const prefix = pattern.slice(0, pattern.indexOf("*"));
      if (pathname.startsWith(prefix)) {
        const rest = pathname.slice(prefix.length);
        if (pattern.endsWith("*")) {
          if (rest.length > 0 && !rest.includes("/")) return value;
        } else {
          const suffix = pattern.slice(pattern.indexOf("*") + 1);
          if (rest.endsWith(suffix) && rest.length > suffix.length) return value;
        }
      }
    }
  }
  return undefined;
}

const roleColors: Record<string, string> = {
  admin: "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800",
  purchaser: "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800",
  inventory_keeper: "bg-teal-50 text-teal-600 border-teal-200 dark:bg-teal-950/30 dark:text-teal-400 dark:border-teal-800",
  cashier: "bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-800",
};

const accentColors = [
  { name: "蓝色", value: "blue", class: "bg-blue-500" },
  { name: "靛蓝", value: "indigo", class: "bg-indigo-500" },
  { name: "紫色", value: "violet", class: "bg-violet-500" },
  { name: "青色", value: "cyan", class: "bg-cyan-500" },
  { name: "翡翠", value: "emerald", class: "bg-emerald-500" },
  { name: "琥珀", value: "amber", class: "bg-amber-500" },
  { name: "玫瑰", value: "rose", class: "bg-rose-500" },
  { name: "黑色", value: "black", class: "bg-black dark:bg-white" },
];

interface HeaderProps {
  user: AuthUser;
  catEnabled: boolean;
  onToggleCat: () => void;
  onOpenChat: () => void;
  description?: string;
  backTo?: string;
  backLabel?: string;
  actions?: React.ReactNode;
}

export function Header({ user, catEnabled, onToggleCat, onOpenChat, description, backTo, backLabel, actions }: HeaderProps) {
  const location = useLocation();
  const [showSettings, setShowSettings] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const logoutFormRef = useRef<HTMLFormElement>(null);
  const { theme, setTheme, accentColor, setAccentColor, resolvedTheme } = useTheme();
  const { toggleSidebar } = useSidebar();
  const { goBack, goForward, canBack, canForward } = useNavigationHistory();

  useEffect(() => {
    if (!showSettings) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowSettings(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [showSettings]);

  const currentPage = matchPageTitle(location.pathname);
  const PageIcon = currentPage?.icon;

  return (
    <header className="h-14 bg-white/80 dark:bg-slate-900/80 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between px-5 backdrop-blur-md sticky top-0 z-20">
      {/* Left: sidebar toggle + page title + nav arrows */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <button
          onClick={toggleSidebar}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:text-slate-500 dark:hover:text-slate-300 dark:hover:bg-slate-800 transition-colors shrink-0"
          title="切换侧边栏 (⌘B)"
        >
          <PanelLeft className="w-4 h-4" />
        </button>
        {currentPage && PageIcon && (
          <div className="flex items-center gap-2 min-w-0">
            {backTo && (
              <Link to={backTo} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:text-slate-500 dark:hover:text-slate-300 dark:hover:bg-slate-800 transition-colors shrink-0" title={backLabel || "返回"}>
                <ArrowLeft className="w-3.5 h-3.5" />
              </Link>
            )}
            <div className="w-6 h-6 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
              <PageIcon className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
              {currentPage.title}
            </span>
            {description && (
              <span className="text-xs text-slate-400 dark:text-slate-500 truncate hidden sm:inline">
                {description}
              </span>
            )}
          </div>
        )}
        {!backTo && (
          <div className="flex items-center gap-0.5 ml-1">
            <button
              onClick={goBack}
              disabled={!canBack}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:text-slate-500 dark:hover:text-slate-300 dark:hover:bg-slate-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="后退"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={goForward}
              disabled={!canForward}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:text-slate-500 dark:hover:text-slate-300 dark:hover:bg-slate-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="前进"
            >
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-1">
        {actions && (
          <div className="flex items-center gap-1 mr-1">
            {actions}
          </div>
        )}
        <NotificationDropdown />

        {/* AI assistant */}
        <button
          onClick={onOpenChat}
          className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-primary hover:bg-primary/10 dark:text-slate-500 dark:hover:text-primary dark:hover:bg-primary/10 transition-colors"
          title="AI 助手"
        >
          <Sparkles className="w-[18px] h-[18px]" />
        </button>

        {/* Settings dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:text-slate-500 dark:hover:text-slate-300 dark:hover:bg-slate-800 transition-colors"
            title="设置"
          >
            <Palette className="w-[18px] h-[18px]" />
          </button>

          {showSettings && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowSettings(false)} />
              <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-3 z-50">
                {/* Theme mode */}
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  外观模式
                </div>
                <div className="px-3 py-2 flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-slate-400" />
                  <span className="flex-1 text-sm text-slate-700 dark:text-slate-200">跟随系统</span>
                  <Switch
                    checked={theme === "system"}
                    onCheckedChange={(checked) => setTheme(checked ? "system" : resolvedTheme)}
                  />
                </div>
                <div className="px-3 pb-2 flex gap-1">
                  <button
                    onClick={() => setTheme("light")}
                    disabled={theme === "system"}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs transition-colors ${
                      theme === "system" ? "opacity-40 cursor-not-allowed" : ""
                    } ${resolvedTheme === "light" && theme !== "system" ? "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700/50"}`}
                  >
                    <Sun className="w-4 h-4" />
                    浅色
                  </button>
                  <button
                    onClick={() => setTheme("dark")}
                    disabled={theme === "system"}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs transition-colors ${
                      theme === "system" ? "opacity-40 cursor-not-allowed" : ""
                    } ${resolvedTheme === "dark" && theme !== "system" ? "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700/50"}`}
                  >
                    <Moon className="w-4 h-4" />
                    深色
                  </button>
                </div>

                {/* Display */}
                <div className="px-3 pt-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  显示
                </div>
                <button
                  onClick={onToggleCat}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                >
                  <Cat className="w-4 h-4 text-slate-400" />
                  <span className="flex-1 text-left">桌面宠物</span>
                  <div className={`w-9 h-5 rounded-full transition-colors relative ${catEnabled ? "bg-blue-500" : "bg-slate-300 dark:bg-slate-600"}`}>
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${catEnabled ? "left-[18px]" : "left-0.5"}`} />
                  </div>
                </button>

                {/* Accent color */}
                <div className="px-3 pt-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  主题色
                </div>
                <div className="px-3 pb-2 flex gap-2 flex-wrap">
                  {accentColors.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => setAccentColor(c.value as AccentColor)}
                      className={`w-7 h-7 rounded-full ${c.class} transition-all ${accentColor === c.value ? "ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-800 scale-110" : "opacity-60 hover:opacity-100"}`}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Divider */}
        <div className="w-px h-7 bg-slate-200 dark:bg-slate-700 mx-1" />

        {/* User avatar - goes to profile */}
        <Link
          to="/profile"
          className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="个人信息"
        >
          <AvatarWithFallback user={user} size="sm" />
          <div className="hidden sm:flex items-center gap-1.5">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{user.name}</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${roleColors[user.role] || "bg-gray-50 text-gray-600"}`}>
              {roleLabels[user.role]}
            </span>
          </div>
        </Link>

        {/* Logout */}
        <button
          onClick={() => setShowLogoutConfirm(true)}
          className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:text-slate-500 dark:hover:text-red-400 dark:hover:bg-red-950/20 transition-colors focus:outline-none focus:ring-2 focus:ring-red-300 dark:focus:ring-red-700"
          title="退出登录"
        >
          <LogOut className="w-[18px] h-[18px]" />
        </button>
        <Form ref={logoutFormRef} method="post" action="/logout" className="hidden" />
        <ConfirmDialog
          open={showLogoutConfirm}
          onOpenChange={setShowLogoutConfirm}
          title="退出登录"
          description="确定要退出当前账号吗？"
          confirmText="退出"
          onConfirm={() => logoutFormRef.current?.requestSubmit()}
        />
      </div>
    </header>
  );
}
