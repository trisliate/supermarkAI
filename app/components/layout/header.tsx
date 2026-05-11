import { Form, Link, useLocation } from "react-router";
import { useState, useEffect, useRef } from "react";
import type { AuthUser } from "~/lib/auth";
import { roleLabels } from "~/lib/auth";
import { Cat, Palette, LogOut, Sun, Moon, Monitor, PanelLeft } from "lucide-react";
import { NotificationDropdown } from "~/components/notification-dropdown";
import { useTheme, type AccentColor } from "~/components/theme-provider";
import { Switch } from "~/components/ui/switch";
import { useSidebar } from "~/components/ui/sidebar";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";

const pageTitles: Record<string, string> = {
  "/dashboard": "仪表盘",
  "/users": "用户管理",
  "/products": "商品管理",
  "/categories": "分类管理",
  "/suppliers": "供应商管理",
  "/purchases": "采购管理",
  "/inventory": "库存管理",
  "/inventory/log": "出入库记录",
  "/sales": "销售管理",
  "/sales/new": "收银台",
  "/profile": "个人信息",
  "/settings/ai": "AI 设置",
};

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
}

export function Header({ user, catEnabled, onToggleCat }: HeaderProps) {
  const location = useLocation();
  const [showSettings, setShowSettings] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const logoutFormRef = useRef<HTMLFormElement>(null);
  const { theme, setTheme, accentColor, setAccentColor, resolvedTheme } = useTheme();
  const { toggleSidebar } = useSidebar();

  useEffect(() => {
    if (!showSettings) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowSettings(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [showSettings]);

  const currentPage = Object.entries(pageTitles).find(([path]) =>
    location.pathname === path || location.pathname.startsWith(path + "/")
  );

  return (
    <header className="h-14 bg-white/80 dark:bg-slate-900/80 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between px-5 backdrop-blur-md sticky top-0 z-20">
      {/* Left: sidebar toggle + page title */}
      <div className="flex items-center gap-2">
        <button
          onClick={toggleSidebar}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:text-slate-500 dark:hover:text-slate-300 dark:hover:bg-slate-800 transition-colors"
          title="切换侧边栏 (⌘B)"
        >
          <PanelLeft className="w-4 h-4" />
        </button>
        <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          {currentPage?.[1] || ""}
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-1">
        <NotificationDropdown />

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
          <div className="w-7 h-7 bg-slate-900 dark:bg-white rounded-full flex items-center justify-center text-white dark:text-slate-900 text-xs font-bold">
            {user.name.charAt(0)}
          </div>
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
          className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:text-slate-500 dark:hover:text-red-400 dark:hover:bg-red-950/20 transition-colors"
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
