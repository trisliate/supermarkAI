import type { Route } from "./+types/dashboard";
import { requireUser } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { AppLayout } from "~/components/layout/app-layout";

import { AdminDashboard } from "~/components/dashboard/roles/admin-dashboard";
import { PurchaserDashboard } from "~/components/dashboard/roles/purchaser-dashboard";
import { InventoryDashboard } from "~/components/dashboard/roles/inventory-dashboard";
import { CashierDashboard } from "~/components/dashboard/roles/cashier-dashboard";
import { getRecommendations } from "~/lib/recommendation.server";
import { roleLabels } from "~/lib/auth";

function getDateRange(days: number) {
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const days = 7;
  const dateRange = getDateRange(days);
  const startDate = new Date(dateRange[0] + "T00:00:00");

  // Base data needed by all roles
  const [productCount, todaySales, dailySales] = await Promise.all([
    db.product.count({ where: { status: "active" } }),
    db.saleOrder.aggregate({ _sum: { totalAmount: true }, where: { createdAt: { gte: today } } }),
    db.saleOrder.findMany({ where: { createdAt: { gte: startDate } }, select: { totalAmount: true, createdAt: true, userId: true } }),
  ]);

  const todaySalesAmount = Number(todaySales._sum.totalAmount || 0);

  // Yesterday sales for trend
  const yesterdaySales = await db.saleOrder.aggregate({ _sum: { totalAmount: true }, where: { createdAt: { gte: yesterday, lt: today } } });
  const yesterdaySalesAmount = Number(yesterdaySales._sum.totalAmount || 0);

  // Build daily trend
  const salesByDate: Record<string, number> = {};
  dailySales.forEach((s) => {
    const date = s.createdAt.toISOString().slice(0, 10);
    salesByDate[date] = (salesByDate[date] || 0) + Number(s.totalAmount);
  });

  // ==================== Admin Data ====================
  if (user.role === "admin") {
    const [
      supplierCount, userCount, lowStockCount, pendingPurchaseCount,
      dailyPurchases, categoryDistribution, topProductsGroupBy,
      staffSalesData, pendingPurchasesList,
    ] = await Promise.all([
      db.supplier.count({ where: { status: "active" } }),
      db.user.count(),
      db.inventory.count({ where: { quantity: { lt: 10 } } }),
      db.purchaseOrder.count({ where: { status: "pending" } }),
      db.purchaseOrder.findMany({ where: { createdAt: { gte: startDate }, status: { not: "cancelled" } }, select: { totalAmount: true, createdAt: true } }),
      db.category.findMany({ select: { name: true, _count: { select: { products: true } } } }),
      db.saleOrderItem.groupBy({ by: ["productId"], _sum: { quantity: true, unitPrice: true }, orderBy: { _sum: { quantity: "desc" } }, take: 5, where: { saleOrder: { createdAt: { gte: today } } } }),
      db.saleOrder.findMany({ where: { createdAt: { gte: today } }, include: { user: { select: { name: true, role: true } } } }),
      db.purchaseOrder.findMany({ where: { status: "pending" }, include: { supplier: { select: { name: true } } }, orderBy: { createdAt: "asc" }, take: 5 }),
    ]);

    const purchasesByDate: Record<string, number> = {};
    dailyPurchases.forEach((p) => {
      const date = p.createdAt.toISOString().slice(0, 10);
      purchasesByDate[date] = (purchasesByDate[date] || 0) + Number(p.totalAmount);
    });

    const trendData = dateRange.map((date) => ({
      date: date.slice(5),
      销售额: salesByDate[date] || 0,
      采购额: purchasesByDate[date] || 0,
    }));

    const pieData = categoryDistribution.map((c) => ({ name: c.name, value: c._count.products }));

    const topProductDetails = await Promise.all(
      topProductsGroupBy.map(async (item) => {
        const product = await db.product.findUnique({ where: { id: item.productId }, select: { name: true } });
        return { name: product?.name || "未知", quantity: item._sum.quantity || 0, amount: Number(item._sum.unitPrice || 0) * (item._sum.quantity || 0) };
      })
    );

    // Staff performance
    const staffMap = new Map<string, { name: string; role: string; salesCount: number; salesAmount: number }>();
    staffSalesData.forEach((s) => {
      const key = `user-${s.userId}`;
      const existing = staffMap.get(key) || { name: s.user.name, role: roleLabels[s.user.role as keyof typeof roleLabels], salesCount: 0, salesAmount: 0 };
      existing.salesCount++;
      existing.salesAmount += Number(s.totalAmount);
      staffMap.set(key, existing);
    });

    const outOfStock = await db.inventory.count({ where: { quantity: 0 } });
    const lowStock = await db.inventory.count({ where: { quantity: { gt: 0, lt: 10 } } });
    const normalStock = await db.inventory.count({ where: { quantity: { gte: 10, lt: 50 } } });
    const abundantStock = await db.inventory.count({ where: { quantity: { gte: 50 } } });

    // Expiry warnings: items expiring within 30 days
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const expiryItems = await db.purchaseOrderItem.findMany({
      where: { expiryDate: { not: null, lte: thirtyDaysFromNow } },
      include: { product: { select: { name: true } } },
      orderBy: { expiryDate: "asc" },
      take: 10,
    });

    return {
      user,
      role: "admin" as const,
      adminData: {
        stats: { productCount, supplierCount, userCount, lowStockCount, pendingPurchaseCount, todaySalesAmount, yesterdaySalesAmount },
        trendData,
        pieData,
        inventoryStatus: { "缺货": outOfStock, "偏低": lowStock, "正常": normalStock, "充足": abundantStock },
        topProducts: topProductDetails,
        staffPerformance: Array.from(staffMap.values()).sort((a, b) => b.salesAmount - a.salesAmount),
        pendingPurchases: pendingPurchasesList.map((p) => ({ id: p.id, supplier: p.supplier.name, amount: Number(p.totalAmount), createdAt: p.createdAt.toISOString() })),
        expiryItems: expiryItems.map((item) => ({
          productName: item.product.name,
          expiryDate: item.expiryDate!.toISOString(),
          daysLeft: Math.ceil((item.expiryDate!.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
        })),
      },
    };
  }

  // ==================== Purchaser Data ====================
  if (user.role === "purchaser") {
    const [pendingCount, monthlyPurchases, activeSuppliers, recentPurchasesList, supplierSpendData, supplierList] = await Promise.all([
      db.purchaseOrder.count({ where: { status: "pending" } }),
      db.purchaseOrder.aggregate({ _sum: { totalAmount: true }, where: { createdAt: { gte: new Date(today.getFullYear(), today.getMonth(), 1) }, status: { not: "cancelled" } } }),
      db.supplier.count({ where: { status: "active" } }),
      db.purchaseOrder.findMany({ include: { supplier: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 5 }),
      db.purchaseOrder.findMany({ where: { status: "received", createdAt: { gte: startDate } }, include: { supplier: { select: { name: true } } } }),
      db.supplier.findMany({ where: { status: "active" }, select: { id: true, name: true, contact: true, phone: true, address: true }, take: 6 }),
    ]);

    const recommendations = await getRecommendations();

    // Purchase trend by day
    const purchaseByDay: Record<string, number> = {};
    recentPurchasesList.forEach((p) => {
      const date = p.createdAt.toISOString().slice(0, 10);
      purchaseByDay[date] = (purchaseByDay[date] || 0) + Number(p.totalAmount);
    });
    // Also include from monthly data
    const allPurchases = await db.purchaseOrder.findMany({ where: { createdAt: { gte: startDate }, status: { not: "cancelled" } }, select: { totalAmount: true, createdAt: true } });
    allPurchases.forEach((p) => {
      const date = p.createdAt.toISOString().slice(0, 10);
      purchaseByDay[date] = (purchaseByDay[date] || 0) + Number(p.totalAmount);
    });

    const purchaseTrend = dateRange.map((date) => ({ date: date.slice(5), amount: purchaseByDay[date] || 0 }));

    // Supplier spend
    const supplierSpendMap = new Map<string, number>();
    supplierSpendData.forEach((p) => {
      const name = p.supplier.name;
      supplierSpendMap.set(name, (supplierSpendMap.get(name) || 0) + Number(p.totalAmount));
    });
    const supplierSpend = Array.from(supplierSpendMap.entries()).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);

    return {
      user,
      role: "purchaser" as const,
      purchaserData: {
        stats: {
          pendingCount,
          monthlyPurchaseAmount: Number(monthlyPurchases._sum.totalAmount || 0),
          activeSuppliers,
          needRestockCount: recommendations.restockItems.filter((r) => r.urgency !== "sufficient").length,
        },
        restockItems: recommendations.restockItems,
        purchaseTrend,
        supplierSpend,
        recentPurchases: recentPurchasesList.map((p) => ({
          id: p.id,
          supplier: p.supplier.name,
          status: p.status,
          amount: Number(p.totalAmount),
          createdAt: p.createdAt.toISOString(),
        })),
        suppliers: supplierList,
      },
    };
  }

  // ==================== Inventory Keeper Data ====================
  if (user.role === "inventory_keeper") {
    const recommendations = await getRecommendations();

    const [outOfStockCount, lowStockCount, recentLogsRaw] = await Promise.all([
      db.inventory.count({ where: { quantity: 0 } }),
      db.inventory.count({ where: { quantity: { gt: 0, lt: 10 } } }),
      db.inventoryLog.findMany({ include: { product: { select: { name: true } }, user: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 10 }),
    ]);

    const outOfStock2 = await db.inventory.count({ where: { quantity: 0 } });
    const lowStock2 = await db.inventory.count({ where: { quantity: { gt: 0, lt: 10 } } });
    const normalStock = await db.inventory.count({ where: { quantity: { gte: 10, lt: 50 } } });
    const abundantStock = await db.inventory.count({ where: { quantity: { gte: 50 } } });

    // Alert items
    const alertInventories = await db.inventory.findMany({
      where: { quantity: { lt: 10 } },
      include: { product: { include: { category: true } } },
      orderBy: { quantity: "asc" },
    });

    // Expiry warnings for inventory keeper
    const thirtyDaysFromNowInv = new Date();
    thirtyDaysFromNowInv.setDate(thirtyDaysFromNowInv.getDate() + 30);
    const expiryItemsInv = await db.purchaseOrderItem.findMany({
      where: { expiryDate: { not: null, lte: thirtyDaysFromNowInv } },
      include: { product: { select: { name: true } } },
      orderBy: { expiryDate: "asc" },
      take: 10,
    });

    return {
      user,
      role: "inventory_keeper" as const,
      inventoryData: {
        stats: {
          totalProducts: productCount,
          outOfStock: outOfStockCount,
          lowStock: lowStockCount,
          totalValue: recommendations.totalStockValue,
        },
        inventoryStatus: { "缺货": outOfStock2, "偏低": lowStock2, "正常": normalStock, "充足": abundantStock },
        alertItems: alertInventories.map((inv) => ({
          id: inv.id,
          productName: inv.product.name,
          categoryName: inv.product.category.name,
          quantity: inv.quantity,
          unit: inv.product.unit,
          price: Number(inv.product.price),
        })),
        recentLogs: recentLogsRaw.map((log) => ({
          id: log.id,
          productName: log.product.name,
          type: log.type,
          quantity: log.quantity,
          reason: log.reason || "",
          userName: log.user.name,
          createdAt: log.createdAt.toISOString(),
        })),
        slowMoving: recommendations.slowMoving,
        expiryItems: expiryItemsInv.map((item) => ({
          productName: item.product.name,
          expiryDate: item.expiryDate!.toISOString(),
          daysLeft: Math.ceil((item.expiryDate!.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
        })),
      },
    };
  }

  // ==================== Cashier Data ====================
  const [todayOrderCount, myTodayOrders, hotProductsGroupBy, recentSalesList, hourlySalesData, allCashierSales, lowStockInventories] = await Promise.all([
    db.saleOrder.count({ where: { createdAt: { gte: today } } }),
    db.saleOrder.count({ where: { createdAt: { gte: today }, userId: user.id } }),
    db.saleOrderItem.groupBy({ by: ["productId"], _sum: { quantity: true }, orderBy: { _sum: { quantity: "desc" } }, take: 10, where: { saleOrder: { createdAt: { gte: today } } } }),
    db.saleOrder.findMany({ where: { createdAt: { gte: today } }, include: { items: true }, orderBy: { createdAt: "desc" }, take: 5 }),
    db.saleOrder.findMany({ where: { createdAt: { gte: today } }, select: { totalAmount: true, createdAt: true } }),
    db.saleOrder.findMany({ where: { createdAt: { gte: today } }, include: { user: { select: { name: true } } } }),
    db.inventory.findMany({ where: { quantity: { lt: 10 } }, include: { product: { select: { name: true, unit: true } } }, orderBy: { quantity: "asc" }, take: 10 }),
  ]);

  const hotProductsDetails = await Promise.all(
    hotProductsGroupBy.map(async (item) => {
      const product = await db.product.findUnique({ where: { id: item.productId }, include: { inventory: true } });
      return {
        name: product?.name || "未知",
        price: Number(product?.price || 0),
        stock: product?.inventory?.quantity ?? 0,
        unit: product?.unit || "个",
        sold: item._sum.quantity || 0,
      };
    })
  );

  // Hourly sales
  const hourMap = new Map<string, number>();
  for (let h = 8; h <= 22; h++) {
    hourMap.set(`${h}:00`, 0);
  }
  hourlySalesData.forEach((s) => {
    const hour = s.createdAt.getHours();
    const key = `${hour}:00`;
    hourMap.set(key, (hourMap.get(key) || 0) + Number(s.totalAmount));
  });

  const avgOrderValue = todayOrderCount > 0 ? todaySalesAmount / todayOrderCount : 0;

  // Cashier leaderboard
  const cashierMap = new Map<string, { name: string; salesCount: number; salesAmount: number }>();
  allCashierSales.forEach((s) => {
    const name = s.user.name;
    const existing = cashierMap.get(name) || { name, salesCount: 0, salesAmount: 0 };
    existing.salesCount++;
    existing.salesAmount += Number(s.totalAmount);
    cashierMap.set(name, existing);
  });

  return {
    user,
    role: "cashier" as const,
    cashierData: {
      stats: {
        todaySales: todaySalesAmount,
        todayOrders: todayOrderCount,
        avgOrderValue,
        myOrders: myTodayOrders,
      },
      hourlySales: Array.from(hourMap.entries()).map(([hour, amount]) => ({ hour, amount })),
      hotProducts: hotProductsDetails,
      recentSales: recentSalesList.map((s) => ({
        id: s.id,
        amount: Number(s.totalAmount),
        itemCount: s.items.length,
        createdAt: s.createdAt.toISOString(),
      })),
      cashierName: user.name,
      allCashierStats: Array.from(cashierMap.values()).sort((a, b) => b.salesAmount - a.salesAmount),
      lowStockProducts: lowStockInventories.map((inv) => ({
        name: inv.product.name,
        stock: inv.quantity,
        unit: inv.product.unit,
      })),
    },
  };
}

export default function DashboardPage({ loaderData }: Route.ComponentProps) {
  const { user } = loaderData;

  return (
    <AppLayout user={user} description={`${roleLabels[user.role]}工作台`}>
      {loaderData.role === "admin" && <AdminDashboard {...loaderData.adminData} />}
      {loaderData.role === "purchaser" && <PurchaserDashboard {...loaderData.purchaserData} />}
      {loaderData.role === "inventory_keeper" && <InventoryDashboard {...loaderData.inventoryData} />}
      {loaderData.role === "cashier" && <CashierDashboard {...loaderData.cashierData} />}
    </AppLayout>
  );
}
