import { db } from "./db.server";

export interface RestockItem {
  productId: number;
  productName: string;
  categoryName: string;
  unit: string;
  price: number;
  currentStock: number;
  dailySales: number;
  daysOfStock: number; // 可售天数，Infinity 表示充足
  suggestedQty: number; // 建议采购量
  urgency: "critical" | "urgent" | "watch" | "sufficient"; // 紧急程度
  urgencyLabel: string;
  urgencyColor: string;
}

export interface SlowMovingItem {
  productId: number;
  productName: string;
  categoryName: string;
  stock: number;
  price: number;
  stockValue: number;
  salesLast7Days: number;
}

export interface HotProduct {
  productId: number;
  productName: string;
  categoryName: string;
  totalSold: number;
  totalRevenue: number;
}

export interface RecommendationResult {
  restockItems: RestockItem[];
  slowMoving: SlowMovingItem[];
  hotProducts: HotProduct[];
  totalStockValue: number;
  outOfStockCount: number;
  lowStockCount: number;
}

/**
 * 综合推荐算法：基于库存 + 销量计算补货建议、滞销预警、热销排行
 */
export async function getRecommendations(): Promise<RecommendationResult> {
  const days = 7;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  // 获取所有商品及其库存
  const products = await db.product.findMany({
    where: { status: "active" },
    include: {
      category: true,
      inventory: true,
    },
  });

  // 获取近7天各商品销量
  const salesData = await db.saleOrderItem.groupBy({
    by: ["productId"],
    _sum: { quantity: true },
    where: {
      saleOrder: { createdAt: { gte: startDate } },
    },
  });

  const salesMap = new Map<number, number>();
  salesData.forEach((s) => {
    salesMap.set(s.productId, s._sum.quantity || 0);
  });

  // 计算补货建议
  const restockItems: RestockItem[] = products
    .map((p) => {
      const stock = p.inventory?.quantity ?? 0;
      const totalSold = salesMap.get(p.id) || 0;
      const dailySales = totalSold / days;
      const daysOfStock = dailySales > 0 ? stock / dailySales : Infinity;
      const targetDays = 14;
      const suggestedQty = Math.max(0, Math.ceil(targetDays * dailySales - stock));

      let urgency: RestockItem["urgency"];
      let urgencyLabel: string;
      let urgencyColor: string;

      if (stock === 0) {
        urgency = "critical";
        urgencyLabel = "缺货";
        urgencyColor = "red";
      } else if (daysOfStock < 3) {
        urgency = "urgent";
        urgencyLabel = "紧急";
        urgencyColor = "orange";
      } else if (daysOfStock < 7) {
        urgency = "watch";
        urgencyLabel = "关注";
        urgencyColor = "yellow";
      } else {
        urgency = "sufficient";
        urgencyLabel = "充足";
        urgencyColor = "green";
      }

      return {
        productId: p.id,
        productName: p.name,
        categoryName: p.category.name,
        unit: p.unit,
        price: Number(p.price),
        currentStock: stock,
        dailySales: Math.round(dailySales * 100) / 100,
        daysOfStock: daysOfStock === Infinity ? 9999 : Math.round(daysOfStock * 10) / 10,
        suggestedQty,
        urgency,
        urgencyLabel,
        urgencyColor,
      };
    })
    .sort((a, b) => {
      // 按紧急程度排序：critical > urgent > watch > sufficient
      const order = { critical: 0, urgent: 1, watch: 2, sufficient: 3 };
      return order[a.urgency] - order[b.urgency] || a.daysOfStock - b.daysOfStock;
    });

  // 滞销商品：近7天零销量且库存>50
  const slowMoving: SlowMovingItem[] = products
    .filter((p) => {
      const stock = p.inventory?.quantity ?? 0;
      const sold = salesMap.get(p.id) || 0;
      return sold === 0 && stock > 50;
    })
    .map((p) => ({
      productId: p.id,
      productName: p.name,
      categoryName: p.category.name,
      stock: p.inventory?.quantity ?? 0,
      price: Number(p.price),
      stockValue: (p.inventory?.quantity ?? 0) * Number(p.price),
      salesLast7Days: 0,
    }))
    .sort((a, b) => b.stockValue - a.stockValue);

  // 热销排行
  const hotProducts: HotProduct[] = await db.saleOrderItem
    .groupBy({
      by: ["productId"],
      _sum: { quantity: true, unitPrice: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 10,
      where: {
        saleOrder: { createdAt: { gte: startDate } },
      },
    })
    .then(async (items) => {
      return Promise.all(
        items.map(async (item) => {
          const product = products.find((p) => p.id === item.productId);
          return {
            productId: item.productId,
            productName: product?.name || "未知",
            categoryName: product?.category.name || "未知",
            totalSold: item._sum.quantity || 0,
            totalRevenue: Number(item._sum.unitPrice || 0) * (item._sum.quantity || 0),
          };
        })
      );
    });

  // 库存总值
  const totalStockValue = products.reduce(
    (sum, p) => sum + (p.inventory?.quantity ?? 0) * Number(p.price),
    0
  );

  const outOfStockCount = restockItems.filter((r) => r.urgency === "critical").length;
  const lowStockCount = restockItems.filter((r) => r.urgency === "urgent" || r.urgency === "watch").length;

  return {
    restockItems,
    slowMoving,
    hotProducts,
    totalStockValue,
    outOfStockCount,
    lowStockCount,
  };
}
