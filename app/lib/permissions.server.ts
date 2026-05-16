import { db } from "./db.server";

export interface RouteConfig {
  route: string;
  label: string;
  group: string;
  defaultRoles: string[];
  icon: string;
  sortOrder: number;
}

/** Master list of all permission-managed routes */
export const ROUTE_CONFIGS: RouteConfig[] = [
  { route: "/dashboard", label: "经营总览", group: "", defaultRoles: ["admin", "purchaser", "inventory_keeper", "cashier"], icon: "LayoutDashboard", sortOrder: 0 },
  { route: "/products", label: "商品管理", group: "运营管理", defaultRoles: ["admin", "purchaser", "inventory_keeper"], icon: "Package", sortOrder: 10 },
  { route: "/categories", label: "分类管理", group: "运营管理", defaultRoles: ["admin"], icon: "Tags", sortOrder: 20 },
  { route: "/suppliers", label: "供应商管理", group: "运营管理", defaultRoles: ["admin", "purchaser"], icon: "Truck", sortOrder: 30 },
  { route: "/purchases", label: "采购管理", group: "供应链", defaultRoles: ["admin", "purchaser", "inventory_keeper"], icon: "ShoppingCart", sortOrder: 40 },
  { route: "/inventory", label: "库存管理", group: "供应链", defaultRoles: ["admin", "inventory_keeper", "cashier"], icon: "Warehouse", sortOrder: 50 },
  { route: "/sales", label: "销售管理", group: "销售", defaultRoles: ["admin", "cashier"], icon: "Receipt", sortOrder: 60 },
  { route: "/sales/new", label: "收银台", group: "销售", defaultRoles: ["admin", "cashier"], icon: "Store", sortOrder: 70 },
  { route: "/users", label: "用户管理", group: "系统", defaultRoles: ["admin"], icon: "Users", sortOrder: 80 },
  { route: "/notifications", label: "通知管理", group: "系统", defaultRoles: ["admin", "purchaser", "inventory_keeper", "cashier"], icon: "Bell", sortOrder: 90 },
  { route: "/settings/ai", label: "API Key", group: "系统", defaultRoles: ["admin"], icon: "KeyRound", sortOrder: 100 },
  { route: "/settings/payment", label: "支付配置", group: "系统", defaultRoles: ["admin"], icon: "CreditCard", sortOrder: 110 },
  { route: "/settings/permissions", label: "权限配置", group: "系统", defaultRoles: ["admin"], icon: "ShieldCheck", sortOrder: 120 },
];

/** Load route permissions from DB, returning a map of route -> allowed roles */
export async function loadRoutePermissions(): Promise<Record<string, string[]>> {
  const rows = await db.routePermission.findMany();
  const map: Record<string, string[]> = {};

  for (const row of rows) {
    map[row.route] = row.roles ? row.roles.split(",").filter(Boolean) : [];
  }

  // Fill in defaults for any routes not yet in DB
  for (const cfg of ROUTE_CONFIGS) {
    if (!(cfg.route in map)) {
      map[cfg.route] = cfg.defaultRoles;
    }
  }

  return map;
}

/** Check if a role can access a specific route */
export async function canAccessRoute(route: string, role: string): Promise<boolean> {
  const row = await db.routePermission.findUnique({ where: { route } });
  if (!row) {
    const cfg = ROUTE_CONFIGS.find((c) => c.route === route);
    return cfg ? cfg.defaultRoles.includes(role) : false;
  }
  if (!row.roles) return false;
  return row.roles.split(",").includes(role);
}

/** Sync route configs to DB — ensures all defined routes exist. Call from admin page. */
export async function syncRoutePermissions(): Promise<void> {
  const existing = await db.routePermission.findMany({ select: { route: true } });
  const existingSet = new Set(existing.map((r) => r.route));

  const missing = ROUTE_CONFIGS.filter((cfg) => !existingSet.has(cfg.route));
  if (missing.length === 0) return;

  await db.$transaction(
    missing.map((cfg) =>
      db.routePermission.create({
        data: {
          route: cfg.route,
          label: cfg.label,
          group: cfg.group,
          roles: cfg.defaultRoles.join(","),
          sortOrder: cfg.sortOrder,
        },
      })
    )
  );
}
