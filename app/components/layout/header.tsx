import { Form, useLocation } from "react-router";
import { useState, useEffect } from "react";
import type { AuthUser } from "~/lib/auth";
import { roleLabels } from "~/lib/auth";
import { LogOut, ChevronRight, Sun, Moon, Bell } from "lucide-react";

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
};

const roleColors: Record<string, string> = {
  admin: "bg-red-50 text-red-600 border-red-200",
  purchaser: "bg-blue-50 text-blue-600 border-blue-200",
  inventory_keeper: "bg-emerald-50 text-emerald-600 border-emerald-200",
  cashier: "bg-purple-50 text-purple-600 border-purple-200",
};

export function Header({ user }: { user: AuthUser }) {
  const location = useLocation();
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("theme-mode");
    if (saved === "dark" || (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      setIsDark(true);
      document.documentElement.classList.add("dark");
    }
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme-mode", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme-mode", "light");
    }
  };

  const currentPage = Object.entries(pageTitles).find(([path]) =>
    location.pathname === path || location.pathname.startsWith(path + "/")
  );

  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-6 shadow-sm backdrop-blur-sm">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-slate-400">首页</span>
        {currentPage && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" />
            <span className="font-medium text-slate-700 dark:text-slate-200">{currentPage[1]}</span>
          </>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
          title={isDark ? "切换到日间模式" : "切换到夜间模式"}
        >
          {isDark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
        </button>

        {/* Notifications */}
        <button className="relative w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors">
          <Bell className="w-[18px] h-[18px]" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        {/* Divider */}
        <div className="w-px h-8 bg-slate-200 dark:bg-slate-700" />

        {/* User info */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-sm font-medium shadow-sm">
            {user.name.charAt(0)}
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{user.name}</p>
            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border ${roleColors[user.role] || "bg-gray-50 text-gray-600 border-gray-200"}`}>
              {roleLabels[user.role]}
            </span>
          </div>
        </div>

        {/* Logout */}
        <Form method="post" action="/logout">
          <button
            type="submit"
            className="ml-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-slate-500 hover:text-red-600 hover:bg-red-50 dark:text-slate-400 dark:hover:text-red-400 dark:hover:bg-red-950/30 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>退出</span>
          </button>
        </Form>
      </div>
    </header>
  );
}
