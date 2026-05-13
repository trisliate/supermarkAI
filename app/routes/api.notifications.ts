import type { Route } from "./+types/api.notifications";
import { getUserSession } from "~/lib/auth.server";
import { db } from "~/lib/db.server";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getUserSession(request);
  if (!user) return Response.json({ notifications: [] }, { status: 401 });

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [lowStockCount, pendingPurchaseCount, todaySalesCount, recentLowStockItems, readRecords] = await Promise.all([
    db.inventory.count({ where: { quantity: { lt: 10 } } }),
    db.purchaseOrder.count({ where: { status: "pending" } }),
    db.saleOrder.count({ where: { createdAt: { gte: today } } }),
    db.inventory.findMany({
      where: { quantity: { lt: 5 } },
      include: { product: { select: { name: true } } },
      orderBy: { quantity: "asc" },
      take: 3,
    }),
    db.notificationRead.findMany({
      where: { userId: user.id },
      select: { notificationId: true },
    }),
  ]);

  const readIds = new Set(readRecords.map((r) => r.notificationId));

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
      read: readIds.has("stock-low"),
    });
  }

  if (pendingPurchaseCount > 0) {
    notifications.push({
      id: "purchase-pending",
      type: "purchase",
      title: "待审批采购单",
      description: `${pendingPurchaseCount} 个采购单等待审批`,
      time: new Date(now.getTime() - 1000 * 60 * 30).toISOString(),
      read: readIds.has("purchase-pending"),
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

  // Persistent notifications from DB
  const persistentNotifications = await db.notification.findMany({
    where: {
      OR: [
        { targetRole: null },
        { targetRole: user.role },
      ],
      createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  for (const n of persistentNotifications) {
    const nid = `notif-${n.id}`;
    notifications.push({
      id: nid,
      type: n.type === "stock_alert" ? "stock" : n.type === "purchase_status" ? "purchase" : n.type === "sale_milestone" ? "sale" : "system",
      title: n.title,
      description: n.content,
      time: n.createdAt.toISOString(),
      read: readIds.has(nid),
    });
  }

  return Response.json({ notifications });
}

export async function action({ request }: Route.ActionArgs) {
  const user = await getUserSession(request);
  if (!user) return Response.json({ error: "未登录" }, { status: 401 });

  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "markRead") {
    const notificationId = formData.get("notificationId") as string;
    if (!notificationId) return Response.json({ error: "缺少通知ID" }, { status: 400 });

    await db.notificationRead.upsert({
      where: { userId_notificationId: { userId: user.id, notificationId } },
      update: { readAt: new Date() },
      create: { userId: user.id, notificationId },
    });
    return Response.json({ ok: true });
  }

  if (intent === "markAllRead") {
    const ids = formData.getAll("ids") as string[];
    if (ids.length === 0) return Response.json({ ok: true });

    await Promise.all(
      ids.map((id) =>
        db.notificationRead.upsert({
          where: { userId_notificationId: { userId: user.id, notificationId: id } },
          update: { readAt: new Date() },
          create: { userId: user.id, notificationId: id },
        })
      )
    );
    return Response.json({ ok: true });
  }

  return Response.json({ error: "未知操作" }, { status: 400 });
}
