import type { Route } from "./+types/api.notifications";
import { getUserSession } from "~/lib/auth.server";
import { db } from "~/lib/db.server";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getUserSession(request);
  if (!user) return Response.json({ notifications: [] }, { status: 401 });

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [lowStockCount, pendingPurchaseCount, todaySalesCount, recentLowStockItems] = await Promise.all([
    db.inventory.count({ where: { quantity: { lt: 10 } } }),
    db.purchaseOrder.count({ where: { status: "pending" } }),
    db.saleOrder.count({ where: { createdAt: { gte: today } } }),
    db.inventory.findMany({
      where: { quantity: { lt: 5 } },
      include: { product: { select: { name: true } } },
      orderBy: { quantity: "asc" },
      take: 3,
    }),
  ]);

  type Notification = {
    id: string;
    type: "stock" | "purchase" | "sale" | "system";
    title: string;
    description: string;
    time: string;
    read: boolean;
  };

  const notifications: Notification[] = [];

  if (lowStockCount > 0) {
    const names = recentLowStockItems.map((i) => i.product.name).join("、");
    notifications.push({
      id: "stock-low",
      type: "stock",
      title: "库存预警",
      description: `${lowStockCount} 件商品库存不足${names ? `：${names}等` : ""}`,
      time: new Date(now.getTime() - 1000 * 60 * 15).toISOString(),
      read: false,
    });
  }

  if (pendingPurchaseCount > 0) {
    notifications.push({
      id: "purchase-pending",
      type: "purchase",
      title: "待审批采购单",
      description: `${pendingPurchaseCount} 个采购单等待审批`,
      time: new Date(now.getTime() - 1000 * 60 * 30).toISOString(),
      read: false,
    });
  }

  if (todaySalesCount > 0) {
    notifications.push({
      id: "sales-today",
      type: "sale",
      title: "今日销售",
      description: `今日已完成 ${todaySalesCount} 笔订单`,
      time: today.toISOString(),
      read: true,
    });
  }

  return Response.json({ notifications });
}
