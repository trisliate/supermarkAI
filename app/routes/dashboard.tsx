import { useState } from "react";
import type { Route } from "./+types/dashboard";
import { requireUser } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { AppLayout } from "~/components/layout/app-layout";
import { StatCard } from "~/components/dashboard/stat-card";
import { Charts, BarChartCard } from "~/components/dashboard/charts";
import { formatPrice } from "~/lib/utils";
import { roleLabels } from "~/lib/auth";
import { TrendingUp, ShoppingCart, Package, AlertTriangle, DollarSign, Clock, Users, Receipt } from "lucide-react";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const { loadRoutePermissions } = await import("~/lib/permissions.server");
  const routePermissions = await loadRoutePermissions();

  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const weekAgo = new Date(todayStart); weekAgo.setDate(weekAgo.getDate() - 6);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Today vs yesterday KPIs
  const [todaySales, yesterdaySales, todayOrders, yesterdayOrders] = await Promise.all([
    db.saleOrder.aggregate({ _sum: { totalAmount: true }, where: { createdAt: { gte: todayStart }, paymentStatus: "paid" } }),
    db.saleOrder.aggregate({ _sum: { totalAmount: true }, where: { createdAt: { gte: yesterdayStart, lt: todayStart }, paymentStatus: "paid" } }),
    db.saleOrder.count({ where: { createdAt: { gte: todayStart }, paymentStatus: "paid" } }),
    db.saleOrder.count({ where: { createdAt: { gte: yesterdayStart, lt: todayStart }, paymentStatus: "paid" } }),
  ]);

  const todayAmount = Number(todaySales._sum.totalAmount || 0);
  const yesterdayAmount = Number(yesterdaySales._sum.totalAmount || 0);
  const salesTrend = yesterdayAmount > 0 ? Math.round(((todayAmount - yesterdayAmount) / yesterdayAmount) * 100) : 0;
  const ordersTrend = yesterdayOrders > 0 ? Math.round(((todayOrders - yesterdayOrders) / yesterdayOrders) * 100) : 0;

  // 7-day trend (raw SQL for date grouping)
  const dailyTrend = await db.$queryRawUnsafe<Array<{ date: string; sales: number; purchases: number }>>(
    `SELECT d.date,
      COALESCE(s.total, 0) as sales,
      COALESCE(p.total, 0) as purchases
    FROM (
      SELECT DATE(DATE_SUB(CURDATE(), INTERVAL seq DAY)) as date
      FROM (SELECT 0 as seq UNION SELECT 1 UNION SELECT 2 UNION SELECT 3
            UNION SELECT 4 UNION SELECT 5 UNION SELECT 6) nums
    ) d
    LEFT JOIN (
      SELECT DATE(createdAt) as date, SUM(totalAmount) as total
      FROM SaleOrder WHERE createdAt >= ? AND paymentStatus = 'paid'
      GROUP BY DATE(createdAt)
    ) s ON d.date = s.date
    LEFT JOIN (
      SELECT DATE(createdAt) as date, SUM(totalAmount) as total
      FROM PurchaseOrder WHERE createdAt >= ? AND status != 'cancelled'
      GROUP BY DATE(createdAt)
    ) p ON d.date = p.date
    ORDER BY d.date`,
    weekAgo, weekAgo
  );

  const trendData = dailyTrend.map((d) => ({
    date: new Date(d.date).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" }),
    销售额: Number(d.sales) || 0,
    采购额: Number(d.purchases) || 0,
  }));

  // Category distribution
  const categories = await db.category.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: { name: "asc" },
  });
  const pieData = categories.filter((c) => c._count.products > 0).map((c) => ({ name: c.name, value: c._count.products }));

  // Inventory status
  const inventoryItems = await db.inventory.findMany({
    include: { product: { select: { status: true } } },
  });
  const inventoryStatus: Record<string, number> = { "缺货": 0, "偏低": 0, "正常": 0, "充足": 0 };
  for (const inv of inventoryItems) {
    if (inv.product.status !== "active") continue;
    if (inv.quantity === 0) inventoryStatus["缺货"]++;
    else if (inv.quantity < 10) inventoryStatus["偏低"]++;
    else if (inv.quantity < 50) inventoryStatus["正常"]++;
    else inventoryStatus["充足"]++;
  }

  // Top selling products (7 days)
  const topSelling = await db.$queryRawUnsafe<Array<{ name: string; totalQty: number }>>(
    `SELECT p.name, SUM(si.quantity) as totalQty
     FROM SaleOrderItem si
     JOIN Product p ON p.id = si.productId
     JOIN SaleOrder so ON so.id = si.saleOrderId
     WHERE so.createdAt >= ? AND so.paymentStatus = 'paid'
     GROUP BY si.productId, p.name
     ORDER BY totalQty DESC
     LIMIT 10`,
    weekAgo
  );
  const hotSellingData = topSelling.map((d) => ({ name: d.name, value: Number(d.totalQty) }));

  // Other KPIs
  const [productCount, lowStockCount, outOfStockCount, pendingPurchases, monthlyPurchases] = await Promise.all([
    db.product.count({ where: { status: "active" } }),
    db.inventory.count({ where: { quantity: { gt: 0, lt: 10 } } }),
    db.inventory.count({ where: { quantity: 0 } }),
    db.purchaseOrder.count({ where: { status: "pending" } }),
    db.purchaseOrder.aggregate({ _sum: { totalAmount: true }, where: { createdAt: { gte: monthStart }, status: { not: "cancelled" } } }),
  ]);

  // Current hour orders (for hourly distribution)
  const hourlyData = await db.$queryRawUnsafe<Array<{ hour: number; count: number; amount: number }>>(
    `SELECT HOUR(createdAt) as hour, COUNT(*) as count, SUM(totalAmount) as amount
     FROM SaleOrder
     WHERE createdAt >= ? AND paymentStatus = 'paid'
     GROUP BY HOUR(createdAt)
     ORDER BY hour`,
    todayStart
  );
  const hourDistribution = Array.from({ length: 24 }, (_, h) => {
    const found = hourlyData.find((d) => Number(d.hour) === h);
    return { name: `${h}:00`, value: found ? Number(found.amount) : 0 };
  }).filter((d) => d.value > 0);

  return {
    user,
    routePermissions,
    stats: {
      todayAmount,
      todayOrders,
      salesTrend,
      ordersTrend,
      productCount,
      lowStockCount,
      outOfStockCount,
      pendingPurchases,
      monthlyPurchaseAmount: Number(monthlyPurchases._sum.totalAmount || 0),
    },
    trendData,
    pieData,
    inventoryStatus,
    hotSellingData,
    hourDistribution,
    yesterdayAmount,
  };
}

export default function DashboardPage({ loaderData }: Route.ComponentProps) {
  const { user, stats, trendData, pieData, inventoryStatus, hotSellingData, hourDistribution, yesterdayAmount } = loaderData;
  const targetAmount = Math.round(yesterdayAmount * 1.2);

  return (
    <AppLayout user={user} routePermissions={loaderData.routePermissions} description={`${roleLabels[user.role]}工作台`}>
      <div className="space-y-6 animate-fade-in">
        {/* KPI Cards Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="今日营收"
            value={`¥${formatPrice(stats.todayAmount)}`}
            icon={DollarSign}
            color="bg-emerald-500"
            trend={{ value: Math.abs(stats.salesTrend), isUp: stats.salesTrend >= 0 }}
            delay={0}
          />
          <StatCard
            label="今日订单"
            value={stats.todayOrders}
            icon={Receipt}
            color="bg-blue-500"
            trend={{ value: Math.abs(stats.ordersTrend), isUp: stats.ordersTrend >= 0 }}
            delay={100}
          />
          <StatCard
            label="活跃商品"
            value={stats.productCount}
            icon={Package}
            color="bg-violet-500"
            subtitle={`${stats.lowStockCount} 低库存`}
            delay={200}
          />
          <StatCard
            label="待审批采购"
            value={stats.pendingPurchases}
            icon={Clock}
            color="bg-amber-500"
            subtitle={stats.pendingPurchases > 0 ? "需要处理" : "暂无待办"}
            delay={300}
          />
        </div>

        {/* Charts */}
        <Charts
          trendData={trendData}
          pieData={pieData}
          inventoryStatus={inventoryStatus}
          todayAmount={stats.todayAmount}
          targetAmount={targetAmount}
        />

        {/* Bottom row: Hot selling + Hour distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {hotSellingData.length > 0 && (
            <BarChartCard data={hotSellingData} title="热销商品 TOP 10（近7天销量）" />
          )}
          {hourDistribution.length > 0 && (
            <BarChartCard
              data={hourDistribution}
              title="今日时段分布"
            />
          )}
        </div>
      </div>
    </AppLayout>
  );
}
