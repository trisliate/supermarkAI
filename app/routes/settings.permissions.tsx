import { useFetcher } from "react-router";
import { useState } from "react";
import type { Route } from "./+types/settings.permissions";
import { requireRole } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { AppLayout } from "~/components/layout/app-layout";
import { ROUTE_CONFIGS, syncRoutePermissions, loadRoutePermissions } from "~/lib/permissions.server";
import { roleLabels } from "~/lib/auth";

import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import { Shield, Save, RotateCcw, LayoutDashboard, Package, Tags, Truck, ShoppingCart, Warehouse, Receipt, Store, Users, Bell, KeyRound, CreditCard, ShieldCheck } from "lucide-react";

const ROLES = ["admin", "purchaser", "inventory_keeper", "cashier"] as const;

const roleColors: Record<string, { bg: string; text: string; border: string; dot: string; headerBg: string }> = {
  admin: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", border: "border-amber-500/30", dot: "bg-amber-500", headerBg: "bg-amber-50 dark:bg-amber-950/20" },
  purchaser: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", border: "border-blue-500/30", dot: "bg-blue-500", headerBg: "bg-blue-50 dark:bg-blue-950/20" },
  inventory_keeper: { bg: "bg-teal-500/10", text: "text-teal-600 dark:text-teal-400", border: "border-teal-500/30", dot: "bg-teal-500", headerBg: "bg-teal-50 dark:bg-teal-950/20" },
  cashier: { bg: "bg-purple-500/10", text: "text-purple-600 dark:text-purple-400", border: "border-purple-500/30", dot: "bg-purple-500", headerBg: "bg-purple-50 dark:bg-purple-950/20" },
};

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, Package, Tags, Truck, ShoppingCart, Warehouse,
  Receipt, Store, Users, Bell, KeyRound, CreditCard, ShieldCheck,
};

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireRole(request, ["admin"]);
  await syncRoutePermissions();

  const permissions = await db.routePermission.findMany({ orderBy: { sortOrder: "asc" } });
  const permMap: Record<string, string[]> = {};
  for (const p of permissions) {
    permMap[p.route] = p.roles ? p.roles.split(",").filter(Boolean) : [];
  }

  const routePermissions = await loadRoutePermissions();
  return { user, permissions: permMap, routeConfigs: ROUTE_CONFIGS, routePermissions };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireRole(request, ["admin"]);
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "save") {
    const updates: { route: string; roles: string }[] = [];
    for (const cfg of ROUTE_CONFIGS) {
      const roles = form.getAll(`roles_${cfg.route.replace(/\//g, "_")}`);
      updates.push({ route: cfg.route, roles: roles.join(",") });
    }

    await db.$transaction(
      updates.map((u) =>
        db.routePermission.upsert({
          where: { route: u.route },
          update: { roles: u.roles },
          create: {
            route: u.route,
            label: ROUTE_CONFIGS.find((c) => c.route === u.route)?.label || u.route,
            group: ROUTE_CONFIGS.find((c) => c.route === u.route)?.group || "",
            roles: u.roles,
            sortOrder: ROUTE_CONFIGS.find((c) => c.route === u.route)?.sortOrder || 0,
          },
        })
      )
    );

    return { ok: true, message: "权限配置已保存" };
  }

  if (intent === "reset") {
    await db.$transaction(
      ROUTE_CONFIGS.map((cfg) =>
        db.routePermission.upsert({
          where: { route: cfg.route },
          update: { roles: cfg.defaultRoles.join(",") },
          create: {
            route: cfg.route,
            label: cfg.label,
            group: cfg.group,
            roles: cfg.defaultRoles.join(","),
            sortOrder: cfg.sortOrder,
          },
        })
      )
    );
    return { ok: true, message: "已恢复默认权限" };
  }

  return { ok: false, message: "未知操作" };
}

export default function SettingsPermissions({ loaderData }: Route.ComponentProps) {
  const { user, permissions, routeConfigs } = loaderData;
  const fetcher = useFetcher<{ ok: boolean; message: string }>();
  const [localPerms, setLocalPerms] = useState<Record<string, string[]>>(() => {
    const m: Record<string, string[]> = {};
    for (const cfg of routeConfigs) {
      m[cfg.route] = permissions[cfg.route] || cfg.defaultRoles;
    }
    return m;
  });

  const saving = fetcher.state !== "idle";

  const toggleRole = (route: string, role: string) => {
    setLocalPerms((prev) => {
      const current = prev[route] || [];
      const next = current.includes(role) ? current.filter((r) => r !== role) : [...current, role];
      return { ...prev, [route]: next };
    });
  };

  const toggleAllForRole = (role: string) => {
    setLocalPerms((prev) => {
      const allHaveRole = routeConfigs.every((cfg) => (prev[cfg.route] || []).includes(role));
      const next = { ...prev };
      for (const cfg of routeConfigs) {
        const current = next[cfg.route] || [];
        if (allHaveRole) {
          next[cfg.route] = current.filter((r) => r !== role);
        } else if (!current.includes(role)) {
          next[cfg.route] = [...current, role];
        }
      }
      return next;
    });
  };

  const toggleAllForRoute = (route: string) => {
    setLocalPerms((prev) => {
      const current = prev[route] || [];
      if (current.length === ROLES.length) {
        return { ...prev, [route]: [] };
      }
      return { ...prev, [route]: [...ROLES] };
    });
  };

  const handleSave = () => {
    const formData = new FormData();
    formData.set("intent", "save");
    for (const [route, roles] of Object.entries(localPerms)) {
      const key = `roles_${route.replace(/\//g, "_")}`;
      for (const role of roles) {
        formData.append(key, role);
      }
    }
    fetcher.submit(formData, { method: "post" });
  };

  const handleReset = () => {
    fetcher.submit({ intent: "reset" }, { method: "post" });
  };

  // Group routes
  const groups: Record<string, typeof routeConfigs> = {};
  for (const cfg of routeConfigs) {
    const g = cfg.group || "总览";
    if (!groups[g]) groups[g] = [];
    groups[g].push(cfg);
  }

  const hasChanges = (() => {
    for (const cfg of routeConfigs) {
      const current = (localPerms[cfg.route] || []).sort().join(",");
      const original = (permissions[cfg.route] || cfg.defaultRoles).sort().join(",");
      if (current !== original) return true;
    }
    return false;
  })();

  // Per-role stats
  const roleStats = ROLES.map((role) => ({
    role,
    count: routeConfigs.filter((cfg) => (localPerms[cfg.route] || []).includes(role)).length,
    total: routeConfigs.length,
  }));

  return (
    <AppLayout user={user} routePermissions={loaderData.routePermissions} description="角色权限配置">
      <div className="space-y-4 pb-16">
        {/* Header with actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">角色权限配置</h1>
              <p className="text-xs text-slate-500">点击开关控制各角色可访问的页面</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleReset} disabled={saving}>
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              恢复默认
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !hasChanges}>
              <Save className="w-3.5 h-3.5 mr-1.5" />
              {saving ? "保存中..." : "保存更改"}
            </Button>
          </div>
        </div>

        {/* Matrix table */}
        <div className="bg-white dark:bg-slate-900/80 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          {/* Table header: route label + 4 role columns */}
          <div className="grid grid-cols-[1fr_repeat(4,120px)] border-b border-slate-200 dark:border-slate-800">
            <div className="px-4 py-3 text-xs font-semibold text-slate-500 bg-slate-50/80 dark:bg-slate-900/50">
              页面路由
            </div>
            {ROLES.map((role) => {
              const colors = roleColors[role];
              const stat = roleStats.find((s) => s.role === role)!;
              const allChecked = stat.count === stat.total;
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => toggleAllForRole(role)}
                  className={`px-3 py-3 text-center transition-colors ${colors.headerBg} hover:brightness-95 cursor-pointer border-l border-slate-200 dark:border-slate-800`}
                >
                  <p className={`text-xs font-semibold ${colors.text}`}>
                    {roleLabels[role as keyof typeof roleLabels]}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {stat.count}/{stat.total} · {allChecked ? "全取消" : "全选"}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Table body: grouped rows */}
          {Object.entries(groups).map(([groupName, items]) => (
            <div key={groupName}>
              {/* Group label row */}
              <div className="grid grid-cols-[1fr_repeat(4,120px)] border-b border-slate-100 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-900/30">
                <div className="px-4 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  {groupName}
                </div>
                <div className="col-span-4 border-l border-slate-200 dark:border-slate-800" />
              </div>

              {/* Route rows */}
              {items.map((cfg) => {
                const routeRoles = localPerms[cfg.route] || [];
                const Icon = iconMap[cfg.icon] || LayoutDashboard;
                return (
                  <div
                    key={cfg.route}
                    className="grid grid-cols-[1fr_repeat(4,120px)] border-b border-slate-50 dark:border-slate-800/30 last:border-b-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors"
                  >
                    {/* Route info */}
                    <div className="px-4 py-2.5 flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                        <Icon className="w-3.5 h-3.5 text-slate-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-tight">{cfg.label}</p>
                      </div>
                    </div>

                    {/* Role switches */}
                    {ROLES.map((role) => {
                      const active = routeRoles.includes(role);
                      const colors = roleColors[role];
                      return (
                        <div
                          key={role}
                          className={`flex items-center justify-center border-l border-slate-100 dark:border-slate-800/30 py-2.5 transition-colors ${
                            active ? colors.headerBg : ""
                          }`}
                        >
                          <Switch
                            size="sm"
                            checked={active}
                            onCheckedChange={() => toggleRole(cfg.route, role)}
                          />
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-[11px] text-slate-400">
          <span>点击表头角色名可一键全选/全取消</span>
          <span>·</span>
          <span>管理员默认拥有所有权限</span>
        </div>

        {/* Success message */}
        {(fetcher.data as any)?.ok && (
          <div className="text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400 px-4 py-2.5 rounded-lg">
            {(fetcher.data as any).message}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
