import { useState, useEffect, useCallback } from "react";
import { Bell, ShoppingCart, Package, AlertTriangle, TrendingUp, Clock, X } from "lucide-react";
import { ScrollArea } from "~/components/ui/scroll-area";

interface Notification {
  id: string;
  type: "sale" | "purchase" | "stock" | "system";
  title: string;
  description: string;
  time: string;
  read: boolean;
}

const typeIcons = {
  sale: TrendingUp,
  purchase: ShoppingCart,
  stock: AlertTriangle,
  system: Package,
};

const typeColors = {
  sale: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30",
  purchase: "text-blue-500 bg-blue-50 dark:bg-blue-950/30",
  stock: "text-red-500 bg-red-50 dark:bg-red-950/30",
  system: "text-slate-500 bg-slate-50 dark:bg-slate-800",
};

export function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const unreadCount = notifications.filter((n) => !n.read).length;

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications || []);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const formatTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "刚刚";
    if (minutes < 60) return `${minutes}分钟前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}小时前`;
    return `${Math.floor(hours / 24)}天前`;
  };

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen(!open); if (!open) fetchNotifications(); }}
        className="relative w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:text-slate-500 dark:hover:text-slate-300 dark:hover:bg-slate-800 transition-colors"
        title="通知"
      >
        <Bell className="w-[18px] h-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] text-white font-bold flex items-center justify-center ring-2 ring-white dark:ring-slate-900">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">通知</h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-blue-500 hover:text-blue-600"
                >
                  全部已读
                </button>
              )}
            </div>

            {/* Notification list */}
            <ScrollArea className="max-h-80">
              {notifications.length === 0 ? (
                <div className="py-12 text-center">
                  <Bell className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">暂无通知</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                  {notifications.map((n) => {
                    const Icon = typeIcons[n.type];
                    return (
                      <div
                        key={n.id}
                        className={`relative px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${!n.read ? "bg-blue-50/30 dark:bg-blue-950/10" : ""}`}
                      >
                        <button
                          onClick={() => removeNotification(n.id)}
                          className="absolute top-2 right-2 w-5 h-5 rounded flex items-center justify-center text-slate-300 hover:text-slate-500 dark:text-slate-600 dark:hover:text-slate-400"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        <div className="flex gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${typeColors[n.type]}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1 pr-4">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{n.title}</p>
                              {!n.read && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full shrink-0" />}
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{n.description}</p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" />
                              {formatTime(n.time)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-700 text-center">
                <button
                  onClick={() => { setNotifications([]); setOpen(false); }}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  清空所有通知
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
