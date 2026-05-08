import { db } from "./db.server";

export interface AssistantResponse {
  type: "text" | "list" | "table";
  title: string;
  content: string;
  data?: any[];
}

/**
 * AI导购助手 - 基于关键词匹配的智能问答
 */
export async function processQuery(input: string): Promise<AssistantResponse> {
  const q = input.trim().toLowerCase();

  // 缺货查询
  if (q.includes("缺货") || q.includes("没货") || q.includes("无货")) {
    const items = await db.inventory.findMany({
      where: { quantity: 0 },
      include: { product: { include: { category: true } } },
    });
    if (items.length === 0) {
      return { type: "text", title: "库存查询", content: "目前没有缺货商品，库存充足！" };
    }
    return {
      type: "table",
      title: "缺货商品",
      content: `共有 ${items.length} 个商品缺货：`,
      data: items.map((i) => ({ 商品: i.product.name, 分类: i.product.category.name, 库存: 0 })),
    };
  }

  // 低库存查询
  if (q.includes("低库存") || q.includes("库存不足") || q.includes("库存偏低")) {
    const items = await db.inventory.findMany({
      where: { quantity: { gt: 0, lt: 10 } },
      include: { product: { include: { category: true } } },
      orderBy: { quantity: "asc" },
    });
    if (items.length === 0) {
      return { type: "text", title: "库存查询", content: "目前没有低库存商品。" };
    }
    return {
      type: "table",
      title: "低库存商品",
      content: `共有 ${items.length} 个商品库存偏低（<10）：`,
      data: items.map((i) => ({ 商品: i.product.name, 库存: `${i.quantity} ${i.product.unit}` })),
    };
  }

  // 今日销售
  if (q.includes("今天") || q.includes("今日")) {
    if (q.includes("销售") || q.includes("卖") || q.includes("营收") || q.includes("收入")) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const [sales, orderCount] = await Promise.all([
        db.saleOrder.aggregate({ _sum: { totalAmount: true }, where: { createdAt: { gte: today } } }),
        db.saleOrder.count({ where: { createdAt: { gte: today } } }),
      ]);
      const amount = Number(sales._sum.totalAmount || 0);
      return {
        type: "text",
        title: "今日销售",
        content: `今日销售额：¥${amount.toFixed(2)}\n今日订单数：${orderCount} 笔\n${orderCount > 0 ? `客单价：¥${(amount / orderCount).toFixed(2)}` : ""}`,
      };
    }
  }

  // 热销查询
  if (q.includes("热销") || q.includes("畅销") || q.includes("卖得好") || q.includes("什么火")) {
    const days = 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const topItems = await db.saleOrderItem.groupBy({
      by: ["productId"],
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 10,
      where: { saleOrder: { createdAt: { gte: startDate } } },
    });

    const details = await Promise.all(
      topItems.map(async (item, i) => {
        const product = await db.product.findUnique({ where: { id: item.productId }, select: { name: true } });
        return { 排名: i + 1, 商品: product?.name || "未知", 销量: item._sum.quantity || 0 };
      })
    );

    return {
      type: "table",
      title: "近7天热销排行",
      content: "近7天热销商品 Top 10：",
      data: details,
    };
  }

  // 采购查询
  if (q.includes("采购") || q.includes("进货")) {
    if (q.includes("多少") || q.includes("金额") || q.includes("总额") || q.includes("花了")) {
      const today = new Date();
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const result = await db.purchaseOrder.aggregate({
        _sum: { totalAmount: true },
        where: { createdAt: { gte: monthStart }, status: { not: "cancelled" } },
      });
      const amount = Number(result._sum.totalAmount || 0);
      return {
        type: "text",
        title: "采购查询",
        content: `本月采购总额：¥${amount.toFixed(2)}`,
      };
    }
    // 待审批
    if (q.includes("待审批") || q.includes("待处理") || q.includes("未审批")) {
      const count = await db.purchaseOrder.count({ where: { status: "pending" } });
      return {
        type: "text",
        title: "采购查询",
        content: `当前有 ${count} 笔采购单待审批。`,
      };
    }
  }

  // 供应商查询
  if (q.includes("供应商") || q.includes("供货商")) {
    // 查特定供应商
    const supplierNameMatch = q.match(/供应商(.+?)(电话|联系|地址|$)/);
    if (supplierNameMatch) {
      const name = supplierNameMatch[1].trim();
      const supplier = await db.supplier.findFirst({
        where: { name: { contains: name } },
      });
      if (supplier) {
        return {
          type: "text",
          title: "供应商信息",
          content: `${supplier.name}\n联系人：${supplier.contact}\n电话：${supplier.phone}\n地址：${supplier.address || "未填写"}`,
        };
      }
    }
    // 列出所有
    const suppliers = await db.supplier.findMany({ where: { status: "active" } });
    return {
      type: "table",
      title: "供应商列表",
      content: `共有 ${suppliers.length} 个活跃供应商：`,
      data: suppliers.map((s) => ({ 名称: s.name, 联系人: s.contact, 电话: s.phone })),
    };
  }

  // 商品数量查询
  if (q.includes("商品") && (q.includes("多少") || q.includes("几个") || q.includes("数量"))) {
    const count = await db.product.count({ where: { status: "active" } });
    const catCount = await db.category.count();
    return {
      type: "text",
      title: "商品查询",
      content: `当前共有 ${count} 个活跃商品，分布在 ${catCount} 个分类中。`,
    };
  }

  // 特定商品库存查询
  if (q.includes("库存") || q.includes("还有多少") || q.includes("剩")) {
    // 尝试提取商品名
    const allProducts = await db.product.findMany({
      where: { status: "active" },
      include: { inventory: true },
    });
    const matched = allProducts.find((p) => q.includes(p.name.toLowerCase()));
    if (matched) {
      const stock = matched.inventory?.quantity ?? 0;
      const status = stock === 0 ? "（缺货）" : stock < 10 ? "（库存偏低）" : "（库存充足）";
      return {
        type: "text",
        title: "商品库存",
        content: `${matched.name}：库存 ${stock} ${matched.unit} ${status}`,
      };
    }
    return {
      type: "text",
      title: "库存查询",
      content: '请输入具体商品名称查询库存，例如"可口可乐还有多少？"',
    };
  }

  // 帮助
  if (q.includes("帮助") || q.includes("help") || q.includes("功能") || q.includes("能做什么")) {
    return {
      type: "text",
      title: "帮助",
      content: `我是超市智能助手，可以帮你查询：

· "XX商品还有多少？" — 查询库存
· "哪些商品缺货了？" — 缺货列表
· "今天卖了多少？" — 今日销售
· "什么卖得好？" — 热销排行
· "采购花了多少？" — 采购金额
· "供应商电话" — 供应商信息
· "商品有多少个？" — 商品统计

试试问我吧！`,
    };
  }

  return {
    type: "text",
    title: "未理解",
    content: '抱歉，我没有理解你的问题。输入"帮助"可以查看我能回答的问题列表。',
  };
}
