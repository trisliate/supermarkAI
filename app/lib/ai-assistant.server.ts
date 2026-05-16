import { db } from "./db.server";
import { decrypt } from "./crypto.server";
import { formatPrice } from "./utils";
import type { AIConfig, Role } from "@prisma/client";
import type { AuthUser } from "./auth";

export interface AssistantResponse {
  type: "text" | "list" | "table" | "navigate" | "confirm";
  title: string;
  content: string;
  data?: Record<string, unknown>[];
  navigateTo?: string;
  needsConfirmation?: boolean;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  fields?: Array<{ key: string; label: string; type: string; options?: string[]; required?: boolean }>;
}

interface LLMToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

interface ChatMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string | null;
  tool_calls?: LLMToolCall[];
  tool_call_id?: string;
  reasoning_content?: string;
}

const providerBaseUrls: Record<string, string> = {
  dashscope: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
  deepseek: "https://api.deepseek.com/v1/chat/completions",
  mimo: "https://token-plan-sgp.xiaomimimo.com/anthropic/v1/messages",
  glm: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
  moonshot: "https://api.moonshot.cn/v1/chat/completions",
  ernie: "https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat",
  doubao: "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
  hunyuan: "https://api.hunyuan.cloud.tencent.com/v1/chat/completions",
  yi: "https://api.lingyiwanwu.com/v1/chat/completions",
  minimax: "https://api.minimax.chat/v1/chat/completions",
  spark: "https://spark-api-open.xf-yun.com/v1/chat/completions",
};

// Tool metadata for permission control
const toolMeta: Record<string, { requiredRoles?: Role[]; writeOperation?: boolean; fields?: AssistantResponse["fields"] }> = {
  navigate: {},
  search_products: {},
  get_low_stock_products: {},
  get_sales_report: {},
  get_supplier_info: {},
  get_purchase_orders: {},
  get_categories: {},
  get_dashboard_stats: {},
  create_product: {
    requiredRoles: ["admin", "purchaser"],
    writeOperation: true,
    fields: [
      { key: "name", label: "商品名称", type: "text", required: true },
      { key: "categoryName", label: "分类名称", type: "text", required: true },
      { key: "price", label: "售价", type: "number", required: true },
      { key: "unit", label: "单位", type: "text", required: true },
      { key: "description", label: "描述", type: "text" },
    ],
  },
  create_supplier: {
    requiredRoles: ["admin", "purchaser"],
    writeOperation: true,
    fields: [
      { key: "name", label: "供应商名称", type: "text", required: true },
      { key: "contact", label: "联系人", type: "text", required: true },
      { key: "phone", label: "电话", type: "text", required: true },
      { key: "address", label: "地址", type: "text" },
    ],
  },
  create_category: {
    requiredRoles: ["admin"],
    writeOperation: true,
    fields: [
      { key: "name", label: "分类名称", type: "text", required: true },
      { key: "description", label: "描述", type: "text" },
    ],
  },
  adjust_inventory: {
    requiredRoles: ["admin", "inventory_keeper"],
    writeOperation: true,
    fields: [
      { key: "productName", label: "商品名称", type: "text", required: true },
      { key: "quantity", label: "数量", type: "number", required: true },
      { key: "type", label: "类型", type: "select", options: ["IN", "OUT"], required: true },
      { key: "reason", label: "原因", type: "text" },
    ],
  },
  create_sale: {
    requiredRoles: ["admin", "cashier"],
    writeOperation: true,
    fields: [
      { key: "items", label: "商品列表（JSON格式）", type: "text", required: true },
      { key: "paymentMethod", label: "支付方式", type: "select", options: ["cash", "wechat", "alipay"] },
    ],
  },
  get_hot_selling_products: {},
  get_monthly_purchase_stats: {},
  get_product_detail: {},
  get_inventory_history: {},
  get_users: {
    requiredRoles: ["admin"],
  },
  get_supplier_products: {},
  edit_product: {
    requiredRoles: ["admin", "purchaser"],
    writeOperation: true,
    fields: [
      { key: "productName", label: "原商品名称", type: "text", required: true },
      { key: "newName", label: "新商品名称", type: "text" },
      { key: "categoryName", label: "分类名称", type: "text" },
      { key: "price", label: "售价", type: "number" },
      { key: "unit", label: "单位", type: "text" },
      { key: "description", label: "描述", type: "text" },
    ],
  },
  toggle_product_status: {
    requiredRoles: ["admin"],
    writeOperation: true,
    fields: [
      { key: "productName", label: "商品名称", type: "text", required: true },
      { key: "status", label: "状态", type: "select", options: ["active", "inactive"], required: true },
    ],
  },
};

// Tool definitions for function calling
const tools = [
  {
    type: "function",
    function: {
      name: "navigate",
      description: "导航到系统中的某个页面",
      parameters: {
        type: "object",
        properties: {
          page: {
            type: "string",
            enum: ["dashboard", "products", "categories", "suppliers", "purchases", "inventory", "sales", "sales/new", "users", "profile", "settings/ai"],
            description: "要导航到的页面",
          },
        },
        required: ["page"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_products",
      description: "搜索商品信息",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "搜索关键词" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_low_stock_products",
      description: "获取低库存或缺货商品列表",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_sales_report",
      description: "获取销售报表",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", enum: ["today", "week", "month"], description: "时间范围" },
        },
        required: ["period"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_supplier_info",
      description: "查询供应商信息",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "供应商名称（可选，不填则返回全部）" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_purchase_orders",
      description: "查询采购单状态",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["pending", "approved", "received", "rejected", "cancelled", "all"], description: "采购单状态筛选" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_categories",
      description: "获取商品分类列表及各分类商品数量",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_dashboard_stats",
      description: "获取系统整体运营数据概览（商品数、销售额、库存预警、待审批等）",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "create_product",
      description: "创建新商品（需要确认）",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "商品名称" },
          categoryName: { type: "string", description: "分类名称" },
          price: { type: "number", description: "售价" },
          unit: { type: "string", description: "单位（个、箱、瓶、袋等）" },
          description: { type: "string", description: "商品描述" },
        },
        required: ["name", "categoryName", "price", "unit"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_supplier",
      description: "创建新供应商（需要确认）",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "供应商名称" },
          contact: { type: "string", description: "联系人" },
          phone: { type: "string", description: "联系电话" },
          address: { type: "string", description: "地址" },
        },
        required: ["name", "contact", "phone"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_category",
      description: "创建新商品分类（需要确认）",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "分类名称" },
          description: { type: "string", description: "分类描述" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "adjust_inventory",
      description: "调整商品库存数量（入库或出库，需要确认）",
      parameters: {
        type: "object",
        properties: {
          productName: { type: "string", description: "商品名称" },
          quantity: { type: "number", description: "数量" },
          type: { type: "string", enum: ["IN", "OUT"], description: "入库(IN)或出库(OUT)" },
          reason: { type: "string", description: "原因" },
        },
        required: ["productName", "quantity", "type"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_sale",
      description: "创建销售订单（开单，需要确认）。items格式：[{productName, quantity}]，paymentMethod可选：cash(现金), wechat(微信), alipay(支付宝)",
      parameters: {
        type: "object",
        properties: {
          items: {
            type: "array",
            description: "销售商品列表",
            items: {
              type: "object",
              properties: {
                productName: { type: "string", description: "商品名称" },
                quantity: { type: "number", description: "数量" },
              },
              required: ["productName", "quantity"],
            },
          },
          paymentMethod: { type: "string", description: "支付方式：cash(现金), wechat(微信支付), alipay(支付宝)，默认cash" },
        },
        required: ["items"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_hot_selling_products",
      description: "获取热销商品排行（按销量排序）",
      parameters: {
        type: "object",
        properties: {
          days: { type: "number", description: "统计天数，默认7天" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_monthly_purchase_stats",
      description: "获取本月采购总额统计",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_product_detail",
      description: "获取某个商品的详细信息（价格、库存、分类、描述等）",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "商品名称" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_inventory_history",
      description: "获取某商品的库存变动历史记录",
      parameters: {
        type: "object",
        properties: {
          productName: { type: "string", description: "商品名称" },
          limit: { type: "number", description: "返回记录数，默认10" },
        },
        required: ["productName"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_users",
      description: "获取系统用户列表（仅店长可用）",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_supplier_products",
      description: "获取某供应商供应的商品列表",
      parameters: {
        type: "object",
        properties: {
          supplierName: { type: "string", description: "供应商名称" },
        },
        required: ["supplierName"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "edit_product",
      description: "编辑商品信息（修改名称、分类、价格等，需要确认）",
      parameters: {
        type: "object",
        properties: {
          productName: { type: "string", description: "要编辑的商品名称" },
          newName: { type: "string", description: "新的商品名称" },
          categoryName: { type: "string", description: "新的分类名称" },
          price: { type: "number", description: "新的售价" },
          unit: { type: "string", description: "新的单位" },
          description: { type: "string", description: "新的商品描述" },
        },
        required: ["productName"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "toggle_product_status",
      description: "启用或停用商品（需要确认）",
      parameters: {
        type: "object",
        properties: {
          productName: { type: "string", description: "商品名称" },
          status: { type: "string", enum: ["active", "inactive"], description: "active=启用，inactive=停用" },
        },
        required: ["productName", "status"],
      },
    },
  },
];

// Convert OpenAI tool format to Anthropic format
function toAnthropicTools() {
  return tools.map((t) => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters,
  }));
}

async function executeTool(name: string, args: Record<string, unknown>, user?: AuthUser): Promise<string> {
  const meta = toolMeta[name];
  if (meta?.requiredRoles && user && !meta.requiredRoles.includes(user.role)) {
    return JSON.stringify({ error: `权限不足：需要 ${meta.requiredRoles.map(r => r === "admin" ? "店长" : r === "purchaser" ? "采购" : r === "inventory_keeper" ? "理货员" : "收银员").join("或")} 角色` });
  }
  switch (name) {
    case "navigate": {
      const page = args.page as string;
      const pageNames: Record<string, string> = {
        dashboard: "经营总览", products: "商品管理", categories: "分类管理",
        suppliers: "供应商管理", purchases: "采购管理", inventory: "库存管理",
        sales: "销售管理", "sales/new": "收银台", users: "用户管理",
        profile: "个人信息", "settings/ai": "AI 设置",
      };
      return JSON.stringify({ navigateTo: `/${page}`, pageName: pageNames[page] || page });
    }
    case "search_products": {
      const query = args.query as string;
      const products = await db.product.findMany({
        where: { name: { contains: query }, status: "active" },
        include: { inventory: true, category: true },
        take: 10,
      });
      return JSON.stringify(products.map((p) => ({
        name: p.name, category: p.category.name, price: formatPrice(Number(p.price)),
        unit: p.unit, stock: p.inventory?.quantity ?? 0,
      })));
    }
    case "get_low_stock_products": {
      const items = await db.inventory.findMany({
        where: { quantity: { lt: 10 } },
        include: { product: { include: { category: true } } },
        orderBy: { quantity: "asc" },
        take: 20,
      });
      return JSON.stringify(items.map((i) => ({
        name: i.product.name, category: i.product.category.name,
        stock: i.quantity, unit: i.product.unit, status: i.quantity === 0 ? "缺货" : "低库存",
      })));
    }
    case "get_sales_report": {
      const now = new Date();
      let startDate: Date;
      if (args.period === "today") { startDate = new Date(now); startDate.setHours(0, 0, 0, 0); }
      else if (args.period === "week") { startDate = new Date(now); startDate.setDate(startDate.getDate() - 7); startDate.setHours(0, 0, 0, 0); }
      else { startDate = new Date(now.getFullYear(), now.getMonth(), 1); }
      const [sales, orderCount] = await Promise.all([
        db.saleOrder.aggregate({ _sum: { totalAmount: true }, where: { createdAt: { gte: startDate } } }),
        db.saleOrder.count({ where: { createdAt: { gte: startDate } } }),
      ]);
      const amount = Number(sales._sum.totalAmount || 0);
      return JSON.stringify({ period: args.period, totalAmount: formatPrice(amount), orderCount, avgOrder: orderCount > 0 ? formatPrice(amount / orderCount) : "0.00" });
    }
    case "get_supplier_info": {
      const name = args.name as string | undefined;
      const where = name ? { name: { contains: name }, status: "active" as const } : { status: "active" as const };
      const suppliers = await db.supplier.findMany({ where, take: 10 });
      return JSON.stringify(suppliers.map((s) => ({ name: s.name, contact: s.contact, phone: s.phone, address: s.address || "未填写" })));
    }
    case "get_purchase_orders": {
      const status = (args.status as string) || "all";
      const where = status === "all" ? {} : { status: status as "pending" | "approved" | "received" | "rejected" | "cancelled" };
      const orders = await db.purchaseOrder.findMany({
        where, include: { supplier: { select: { name: true } }, user: { select: { name: true } } },
        orderBy: { createdAt: "desc" }, take: 10,
      });
      return JSON.stringify(orders.map((o) => ({
        id: `PO-${String(o.id).padStart(4, "0")}`, supplier: o.supplier.name, creator: o.user.name,
        amount: formatPrice(Number(o.totalAmount)), status: o.status,
        createdAt: o.createdAt.toLocaleDateString("zh-CN"),
      })));
    }
    case "get_categories": {
      const cats = await db.category.findMany({
        include: { _count: { select: { products: true } } },
        orderBy: { name: "asc" },
      });
      return JSON.stringify(cats.map((c) => ({ name: c.name, productCount: c._count.products, description: c.description || "" })));
    }
    case "get_dashboard_stats": {
      const now = new Date();
      const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
      const [productCount, categoryCount, lowStock, outOfStock, todaySales, todayOrders, pendingPurchases, supplierCount, userCount] = await Promise.all([
        db.product.count({ where: { status: "active" } }),
        db.category.count(),
        db.inventory.count({ where: { quantity: { gt: 0, lt: 10 } } }),
        db.inventory.count({ where: { quantity: 0 } }),
        db.saleOrder.aggregate({ _sum: { totalAmount: true }, where: { createdAt: { gte: todayStart } } }),
        db.saleOrder.count({ where: { createdAt: { gte: todayStart } } }),
        db.purchaseOrder.count({ where: { status: "pending" } }),
        db.supplier.count({ where: { status: "active" } }),
        db.user.count(),
      ]);
      return JSON.stringify({
        productCount, categoryCount, lowStock, outOfStock,
        todaySales: formatPrice(Number(todaySales._sum.totalAmount || 0)),
        todayOrders, pendingPurchases, supplierCount, userCount,
      });
    }
    case "create_product": {
      const name = args.name as string;
      const categoryName = args.categoryName as string;
      const price = Number(args.price);
      const unit = args.unit as string;
      const description = args.description as string | undefined;

      if (!name || !categoryName || !price || !unit) {
        return JSON.stringify({ error: "缺少必填字段：商品名称、分类、价格、单位" });
      }

      const category = await db.category.findFirst({ where: { name: categoryName } });
      if (!category) {
        return JSON.stringify({ error: `分类"${categoryName}"不存在，请先创建分类` });
      }

      const existing = await db.product.findFirst({ where: { name, categoryId: category.id } });
      if (existing) {
        return JSON.stringify({ error: `商品"${name}"在该分类下已存在` });
      }

      const product = await db.product.create({
        data: { name, categoryId: category.id, price, unit, description: description || null },
      });
      await db.inventory.create({ data: { productId: product.id, quantity: 0 } });

      return JSON.stringify({ success: true, message: `商品"${name}"已创建，初始库存为 0`, productId: product.id });
    }

    case "create_supplier": {
      const name = args.name as string;
      const contact = args.contact as string;
      const phone = args.phone as string;
      const address = args.address as string | undefined;

      if (!name || !contact || !phone) {
        return JSON.stringify({ error: "缺少必填字段：供应商名称、联系人、电话" });
      }

      const existing = await db.supplier.findFirst({ where: { name } });
      if (existing) {
        return JSON.stringify({ error: `供应商"${name}"已存在` });
      }

      const supplier = await db.supplier.create({
        data: { name, contact, phone, address: address || null },
      });

      return JSON.stringify({ success: true, message: `供应商"${name}"已创建`, supplierId: supplier.id });
    }

    case "create_category": {
      const name = args.name as string;
      const description = args.description as string | undefined;

      if (!name) {
        return JSON.stringify({ error: "缺少分类名称" });
      }

      const existing = await db.category.findUnique({ where: { name } });
      if (existing) {
        return JSON.stringify({ error: `分类"${name}"已存在` });
      }

      const category = await db.category.create({
        data: { name, description: description || null },
      });

      return JSON.stringify({ success: true, message: `分类"${name}"已创建`, categoryId: category.id });
    }

    case "adjust_inventory": {
      const productName = args.productName as string;
      const quantity = Number(args.quantity);
      const type = args.type as "IN" | "OUT";
      const reason = args.reason as string | undefined;
      const userId = user?.id;

      if (!productName || !quantity || quantity <= 0) {
        return JSON.stringify({ error: "请提供有效的商品名称和数量" });
      }

      const product = await db.product.findFirst({
        where: { name: { contains: productName }, status: "active" },
        include: { inventory: true },
      });
      if (!product) {
        return JSON.stringify({ error: `未找到商品"${productName}"` });
      }
      if (!product.inventory) {
        return JSON.stringify({ error: `商品"${product.name}"没有库存记录` });
      }

      const currentStock = product.inventory.quantity;
      const newStock = type === "IN" ? currentStock + quantity : currentStock - quantity;
      if (newStock < 0) {
        return JSON.stringify({ error: `库存不足：当前 ${currentStock}，无法出库 ${quantity}` });
      }

      await db.inventory.update({
        where: { productId: product.id },
        data: { quantity: newStock },
      });
      await db.inventoryLog.create({
        data: {
          productId: product.id,
          type,
          quantity,
          reason: reason || `AI 助手调整 (${type === "IN" ? "入库" : "出库"})`,
          userId: userId || 1,
        },
      });

      return JSON.stringify({
        success: true,
        message: `${product.name} ${type === "IN" ? "入库" : "出库"} ${quantity}${product.unit}，库存 ${currentStock} → ${newStock}`,
      });
    }

    case "create_sale": {
      const rawItems = args.items as Array<{ productName: string; quantity: number }>;
      if (!rawItems || !Array.isArray(rawItems) || rawItems.length === 0) {
        return JSON.stringify({ error: "请提供至少一个商品" });
      }

      const userId = user?.id || 1;
      const saleItems: { productId: number; quantity: number; unitPrice: number; name: string; unit: string }[] = [];

      for (const item of rawItems) {
        if (!item.productName || !item.quantity || item.quantity <= 0) {
          return JSON.stringify({ error: `商品"${item.productName}"信息不完整` });
        }
        const p = await db.product.findFirst({
          where: { name: { contains: item.productName }, status: "active" },
          include: { inventory: true },
        });
        if (!p) {
          return JSON.stringify({ error: `未找到商品"${item.productName}"` });
        }
        if (!p.inventory || p.inventory.quantity < item.quantity) {
          return JSON.stringify({ error: `${p.name} 库存不足：当前 ${p.inventory?.quantity ?? 0}${p.unit}，需要 ${item.quantity}${p.unit}` });
        }
        saleItems.push({ productId: p.id, quantity: item.quantity, unitPrice: Number(p.price), name: p.name, unit: p.unit });
      }

      const totalAmount = saleItems.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
      const payMethod = (args.paymentMethod as string) || "cash";

      await db.$transaction(async (tx) => {
        const order = await tx.saleOrder.create({
          data: {
            userId,
            totalAmount,
            paymentMethod: payMethod,
            paymentStatus: payMethod === "cash" ? "paid" : "pending",
            items: { create: saleItems.map((i) => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice })) },
          },
        });
        for (const item of saleItems) {
          await tx.inventory.update({
            where: { productId: item.productId },
            data: { quantity: { decrement: item.quantity } },
          });
          await tx.inventoryLog.create({
            data: { productId: item.productId, type: "OUT", quantity: item.quantity, reason: `销售订单 #${order.id}`, userId },
          });
        }
      });

      const summary = saleItems.map((i) => `${i.name} x${i.quantity}`).join("、");
      return JSON.stringify({
        success: true,
        message: `销售完成：${summary}，合计 ¥${totalAmount.toFixed(2)}`,
        totalAmount,
      });
    }

    case "get_hot_selling_products": {
      const days = (args.days as number) || 7;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);

      const topItems = await db.saleOrderItem.groupBy({
        by: ["productId"],
        _sum: { quantity: true, unitPrice: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 10,
        where: { saleOrder: { createdAt: { gte: startDate } } },
      });

      const details = await Promise.all(
        topItems.map(async (item, i) => {
          const product = await db.product.findUnique({
            where: { id: item.productId },
            select: { name: true, unit: true },
          });
          return {
            rank: i + 1,
            name: product?.name || "未知",
            totalQuantity: item._sum.quantity || 0,
            unit: product?.unit || "",
          };
        })
      );

      return JSON.stringify({ period: `近${days}天`, products: details });
    }

    case "get_monthly_purchase_stats": {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const [result, orderCount] = await Promise.all([
        db.purchaseOrder.aggregate({
          _sum: { totalAmount: true },
          where: { createdAt: { gte: monthStart }, status: { not: "cancelled" } },
        }),
        db.purchaseOrder.count({
          where: { createdAt: { gte: monthStart }, status: { not: "cancelled" } },
        }),
      ]);

      const amount = Number(result._sum.totalAmount || 0);
      return JSON.stringify({
        month: `${now.getFullYear()}年${now.getMonth() + 1}月`,
        totalAmount: formatPrice(amount),
        orderCount,
      });
    }

    case "get_product_detail": {
      const name = args.name as string;
      const product = await db.product.findFirst({
        where: { name: { contains: name } },
        include: { inventory: true, category: true },
      });

      if (!product) {
        return JSON.stringify({ error: `未找到商品"${name}"` });
      }

      return JSON.stringify({
        name: product.name,
        category: product.category.name,
        price: formatPrice(Number(product.price)),
        unit: product.unit,
        description: product.description || "无",
        status: product.status === "active" ? "在售" : "已停用",
        stock: product.inventory?.quantity ?? 0,
        createdAt: product.createdAt.toLocaleDateString("zh-CN"),
      });
    }

    case "get_inventory_history": {
      const productName = args.productName as string;
      const limit = (args.limit as number) || 10;

      const product = await db.product.findFirst({
        where: { name: { contains: productName } },
      });

      if (!product) {
        return JSON.stringify({ error: `未找到商品"${productName}"` });
      }

      const logs = await db.inventoryLog.findMany({
        where: { productId: product.id },
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: limit,
      });

      return JSON.stringify({
        productName: product.name,
        records: logs.map((log) => ({
          type: log.type === "IN" ? "入库" : "出库",
          quantity: log.quantity,
          reason: log.reason || "-",
          operator: log.user.name,
          time: log.createdAt.toLocaleString("zh-CN"),
        })),
      });
    }

    case "get_users": {
      const users = await db.user.findMany({
        select: { id: true, name: true, username: true, role: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      });

      const roleNames: Record<string, string> = {
        admin: "店长", purchaser: "采购", inventory_keeper: "理货员", cashier: "收银员",
      };

      return JSON.stringify(users.map((u) => ({
        id: u.id,
        name: u.name,
        username: u.username,
        role: roleNames[u.role] || u.role,
        createdAt: u.createdAt.toLocaleDateString("zh-CN"),
      })));
    }

    case "get_supplier_products": {
      const supplierName = args.supplierName as string;

      const supplier = await db.supplier.findFirst({
        where: { name: { contains: supplierName } },
      });

      if (!supplier) {
        return JSON.stringify({ error: `未找到供应商"${supplierName}"` });
      }

      const supplierProducts = await db.supplierProduct.findMany({
        where: { supplierId: supplier.id },
        include: { product: { select: { name: true, unit: true, price: true } } },
      });

      return JSON.stringify({
        supplierName: supplier.name,
        products: supplierProducts.map((sp) => ({
          name: sp.product.name,
          unit: sp.product.unit,
          supplyPrice: sp.price ? formatPrice(Number(sp.price)) : "未设定",
          retailPrice: formatPrice(Number(sp.product.price)),
        })),
      });
    }

    case "edit_product": {
      const productName = args.productName as string;
      const product = await db.product.findFirst({
        where: { name: { contains: productName } },
      });

      if (!product) {
        return JSON.stringify({ error: `未找到商品"${productName}"` });
      }

      const updateData: Record<string, unknown> = {};
      if (args.newName) updateData.name = args.newName as string;
      if (args.price) updateData.price = Number(args.price);
      if (args.unit) updateData.unit = args.unit as string;
      if (args.description !== undefined) updateData.description = args.description as string;
      if (args.categoryName) {
        const category = await db.category.findFirst({ where: { name: args.categoryName as string } });
        if (!category) {
          return JSON.stringify({ error: `分类"${args.categoryName}"不存在` });
        }
        updateData.categoryId = category.id;
      }

      if (Object.keys(updateData).length === 0) {
        return JSON.stringify({ error: "请提供至少一个要修改的字段" });
      }

      await db.product.update({ where: { id: product.id }, data: updateData });

      const changes = Object.entries(updateData).map(([key, val]) => {
        const labels: Record<string, string> = { name: "名称", categoryId: "分类", price: "价格", unit: "单位", description: "描述" };
        return `${labels[key] || key}: ${val}`;
      }).join("，");

      return JSON.stringify({
        success: true,
        message: `商品"${product.name}"已更新：${changes}`,
      });
    }

    case "toggle_product_status": {
      const productName = args.productName as string;
      const status = args.status as "active" | "inactive";

      const product = await db.product.findFirst({
        where: { name: { contains: productName } },
      });

      if (!product) {
        return JSON.stringify({ error: `未找到商品"${productName}"` });
      }

      await db.product.update({
        where: { id: product.id },
        data: { status },
      });

      return JSON.stringify({
        success: true,
        message: `商品"${product.name}"已${status === "active" ? "启用" : "停用"}`,
      });
    }

    default:
      return JSON.stringify({ error: "未知工具" });
  }
}

async function buildSystemPrompt(): Promise<string> {
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);

  const [productCount, categoryCount, lowStockCount, outOfStockCount, todaySales, todayOrders, pendingPurchases] = await Promise.all([
    db.product.count({ where: { status: "active" } }),
    db.category.count(),
    db.inventory.count({ where: { quantity: { gt: 0, lt: 10 } } }),
    db.inventory.count({ where: { quantity: 0 } }),
    db.saleOrder.aggregate({ _sum: { totalAmount: true }, where: { createdAt: { gte: todayStart } } }),
    db.saleOrder.count({ where: { createdAt: { gte: todayStart } } }),
    db.purchaseOrder.count({ where: { status: "pending" } }),
  ]);

  const todayAmount = Number(todaySales._sum.totalAmount || 0);

  return `你是超市管理系统的 AI 智能助手。你的职责是帮助用户了解系统、查询数据、导航页面、指引操作。

## 你拥有的工具（必须通过工具调用获取数据，不要编造数据）：

**查询工具（随时可用）：**
- search_products: 按关键词搜索商品（名称、价格、库存）
- get_product_detail: 获取某个商品的详细信息（价格、库存、分类、描述等）
- get_low_stock_products: 查询库存不足（<10）的商品
- get_hot_selling_products: 获取热销商品排行，可指定统计天数
- get_sales_report: 获取销售报表，period 可选 today/week/month
- get_supplier_info: 查询供应商信息（名称、联系人、电话）
- get_supplier_products: 获取某供应商供应的商品列表
- get_purchase_orders: 查询采购单，status 可选 pending/approved/received/rejected/cancelled/all
- get_monthly_purchase_stats: 获取本月采购总额统计
- get_categories: 获取所有商品分类及各分类商品数量
- get_inventory_history: 获取某商品的库存变动历史记录
- get_dashboard_stats: 获取系统全局统计数据
- get_users: 获取系统用户列表（仅店长可用）
- navigate: 导航到指定页面

**写操作工具（需要用户确认后执行）：**
- create_product: 创建新商品（name, categoryName, price, unit）
- edit_product: 编辑商品信息（productName, newName/categoryName/price/unit/description 可选）
- toggle_product_status: 启用或停用商品（productName, status=active/inactive）
- create_supplier: 创建新供应商（name, contact, phone, address）
- create_category: 创建新分类（name, description）
- adjust_inventory: 调整库存（productName, quantity, type=IN/OUT, reason）
- create_sale: 创建销售订单/开单（items: [{productName, quantity}], paymentMethod: cash|wechat|alipay）

## 使用规则：
1. 用户询问数据时，**必须调用对应工具**获取实时数据，绝对不要编造数字
2. 用户要导航到某页面时，调用 navigate 工具
3. 用户要创建/编辑商品、供应商、分类、调整库存或销售开单时，调用对应写操作工具（系统会自动弹出确认框）
4. 复杂问题可以组合多个工具获取完整信息
5. 如果工具返回空结果，如实告知用户

## 当前系统实时数据：
- 活跃商品：${productCount} 个，${categoryCount} 个分类
- 库存预警：${lowStockCount} 个低库存，${outOfStockCount} 个缺货
- 今日销售：¥${formatPrice(todayAmount)}，${todayOrders} 笔订单
- 待审批采购：${pendingPurchases} 笔

## 回答风格：
- 简洁明了，用中文
- 涉及数据时用表格展示
- 涉及操作时给出具体的导航指引`;
}

async function callLLM(config: { provider: string; model: string; apiKey: string; baseUrl: string | null; protocol?: string; temperature?: number | null; maxTokens?: number | null; topP?: number | null; enableThinking?: boolean; enableTools?: boolean }, messages: ChatMessage[]): Promise<{ content: string; toolCalls?: LLMToolCall[]; reasoningContent?: string }> {
  const url = config.baseUrl || providerBaseUrls[config.provider] || "";
  const decryptedKey = decrypt(config.apiKey);
  const protocol = config.protocol || "openai";

  if (protocol === "anthropic") {
    const systemMsg = messages.find((m) => m.role === "system");
    const nonSystemMsgs = messages.filter((m) => m.role !== "system");

    // Convert internal messages to Anthropic content-block format
    const anthropicMessages = nonSystemMsgs.map((m) => {
      if (m.role === "tool") {
        return {
          role: "user",
          content: [{ type: "tool_result", tool_use_id: m.tool_call_id, content: m.content || "" }],
        };
      }
      if (m.role === "assistant" && m.tool_calls && m.tool_calls.length > 0) {
        const blocks: Array<Record<string, unknown>> = [];
        if (m.content) blocks.push({ type: "text", text: m.content });
        for (const tc of m.tool_calls) {
          blocks.push({
            type: "tool_use",
            id: tc.id,
            name: tc.function.name,
            input: typeof tc.function.arguments === "string" ? JSON.parse(tc.function.arguments) : tc.function.arguments,
          });
        }
        return { role: "assistant", content: blocks };
      }
      return { role: m.role === "assistant" ? "assistant" : "user", content: m.content || "" };
    });

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": decryptedKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: config.maxTokens || 4096,
        temperature: config.temperature ?? 0.7,
        system: systemMsg?.content || undefined,
        messages: anthropicMessages,
        tools: config.enableTools !== false ? toAnthropicTools() : undefined,
        tool_choice: config.enableTools !== false ? { type: "auto" } : undefined,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`LLM API error (${res.status}): ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    const contentBlocks: Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }> = data.content || [];
    const textContent = contentBlocks.filter((b) => b.type === "text").map((b) => b.text || "").join("");
    const toolCalls: LLMToolCall[] = contentBlocks
      .filter((b) => b.type === "tool_use")
      .map((b) => ({
        id: b.id!,
        type: "function" as const,
        function: { name: b.name!, arguments: JSON.stringify(b.input || {}) },
      }));

    return { content: textContent, toolCalls: toolCalls.length > 0 ? toolCalls : undefined };
  }

  // OpenAI-compatible protocol (default)
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${decryptedKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      tools: config.enableTools !== false && tools.length > 0 ? tools : undefined,
      tool_choice: config.enableTools !== false ? "auto" : undefined,
      max_tokens: config.maxTokens || 4096,
      temperature: config.temperature ?? 0.7,
      top_p: config.topP ?? 0.9,
      ...(config.provider === "doubao" ? { thinking: { type: config.enableThinking ? "enabled" : "disabled" } } : {}),
      ...(config.enableThinking && config.provider === "mimo" ? { thinking: { type: "enabled" } } : {}),
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LLM API error (${res.status}): ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const choice = data.choices?.[0];
  if (!choice) throw new Error("No response from LLM");

  return {
    content: choice.message?.content || "",
    toolCalls: choice.message?.tool_calls,
    reasoningContent: choice.message?.reasoning_content,
  };
}

export async function processQuery(input: string, user?: AuthUser, history?: ChatMessage[]): Promise<AssistantResponse> {
  // Try LLM integration first
  try {
    const config = await db.aIConfig.findFirst({ where: { isActive: true } });
    if (config) {
      return await processWithLLM(config, input, user, history);
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("LLM error, falling back to keyword matching:", message);
  }

  // Fallback to keyword matching
  return processWithKeywords(input, user);
}

export async function executeConfirmedTool(toolName: string, toolArgs: Record<string, unknown>, user?: AuthUser): Promise<AssistantResponse> {
  const result = await executeTool(toolName, toolArgs, user);
  const parsed = JSON.parse(result);

  // Record audit log
  if (user) {
    try {
      await db.auditLog.create({
        data: {
          userId: user.id,
          toolName,
          toolArgs: JSON.stringify(toolArgs),
          result,
          success: !parsed.error,
        },
      });
    } catch (e) {
      console.error("Failed to write audit log:", e);
    }
  }

  if (parsed.error) {
    return { type: "text", title: "执行失败", content: parsed.error };
  }

  const labels: Record<string, string> = {
    create_product: "创建商品",
    edit_product: "编辑商品",
    toggle_product_status: "修改商品状态",
    create_supplier: "创建供应商",
    create_category: "创建分类",
    adjust_inventory: "调整库存",
    create_sale: "创建销售",
  };

  // Navigation after successful write operations
  const navAfterWrite: Record<string, string> = {
    create_product: "/products",
    edit_product: "/products",
    toggle_product_status: "/products",
    create_supplier: "/suppliers",
    create_category: "/categories",
    adjust_inventory: "/inventory",
    create_sale: "/sales",
  };

  const navigateTo = navAfterWrite[toolName];

  return {
    type: navigateTo ? "navigate" : "text",
    title: labels[toolName] || "操作完成",
    content: parsed.message || "操作已成功执行",
    navigateTo,
  };
}

async function processWithLLM(config: AIConfig, input: string, user?: AuthUser, history?: ChatMessage[]): Promise<AssistantResponse> {
  const systemPrompt = await buildSystemPrompt();

  const messages: ChatMessage[] = [
    { role: "system", content: config.systemPrompt || systemPrompt },
    ...(history || []),
    { role: "user", content: input },
  ];

  let result = await callLLM(config, messages);

  // Handle tool calls
  if (result.toolCalls && result.toolCalls.length > 0) {
    // Check for write operations that need confirmation
    for (const toolCall of result.toolCalls) {
      const functionName = toolCall.function?.name;
      const meta = toolMeta[functionName];
      if (meta?.writeOperation) {
        const functionArgs = toolCall.function?.arguments ? JSON.parse(toolCall.function.arguments) : {};
        return {
          type: "confirm",
          title: `确认${functionName === "create_product" ? "创建商品" : functionName === "edit_product" ? "编辑商品" : functionName === "toggle_product_status" ? "修改商品状态" : functionName === "create_supplier" ? "创建供应商" : functionName === "create_category" ? "创建分类" : functionName === "create_sale" ? "销售开单" : "调整库存"}`,
          content: result.content || "AI 建议执行以下操作，请确认：",
          needsConfirmation: true,
          toolName: functionName,
          toolArgs: functionArgs,
          fields: meta.fields,
        };
      }
    }

    const toolResults: ChatMessage[] = [];

    for (const toolCall of result.toolCalls) {
      const functionName = toolCall.function?.name;
      const functionArgs = toolCall.function?.arguments ? JSON.parse(toolCall.function.arguments) : {};
      const toolResult = await executeTool(functionName, functionArgs, user);

      toolResults.push({
        role: "assistant" as const,
        content: null,
        tool_calls: [toolCall],
        reasoning_content: result.reasoningContent,
      });
      toolResults.push({
        role: "tool" as const,
        tool_call_id: toolCall.id,
        content: toolResult,
      });
    }

    // Send tool results back to LLM for final response
    const finalMessages: ChatMessage[] = [
      { role: "system", content: config.systemPrompt || systemPrompt },
      ...(history || []),
      { role: "user", content: input },
      ...toolResults,
    ];

    result = await callLLM(config, finalMessages);

    // Check if any tool call was a navigation
    const navCall = result.toolCalls?.find((tc) => tc.function?.name === "navigate");
    if (navCall) {
      const navArgs = JSON.parse(navCall.function.arguments);
      const navResult = JSON.parse(await executeTool("navigate", navArgs));
      return {
        type: "navigate",
        title: "导航",
        content: result.content || `正在前往${navResult.pageName}...`,
        navigateTo: navResult.navigateTo,
      };
    }
  }

  return {
    type: "text",
    title: "AI 助手",
    content: result.content || "抱歉，我无法处理这个问题。",
  };
}

// Keyword matching fallback (original logic)
async function processWithKeywords(input: string, user?: AuthUser): Promise<AssistantResponse> {
  const q = input.trim().toLowerCase();

  // Sell/create sale order (keyword fallback) - role check
  if (user && user.role !== "admin" && user.role !== "cashier") {
    // Block non-cashier/non-admin from selling
  } else if (q.includes("卖") && (q.includes("个") || q.includes("袋") || q.includes("瓶") || q.includes("箱") || q.includes("包") || q.includes("件") || q.match(/\d+/))) {
    // Extract quantity and product name
    const sellMatch = q.match(/(?:帮我)?(?:卖|卖出|销售)(?:了?)(\d+)?\s*(?:个|袋|瓶|箱|包|件|桶|罐)?(.+)/);
    if (sellMatch) {
      const qty = parseInt(sellMatch[1] || "1");
      const productName = (sellMatch[2] || "").trim().replace(/(吧|吗|的|啊)$/g, "");
      if (productName) {
        const products = await db.product.findMany({
          where: { name: { contains: productName }, status: "active" },
          include: { inventory: true },
          take: 5,
        });
        if (products.length === 1) {
          const p = products[0];
          const stock = p.inventory?.quantity ?? 0;
          if (stock < qty) {
            return { type: "text", title: "库存不足", content: `${p.name} 库存不足：当前 ${stock}${p.unit}，需要 ${qty}${p.unit}` };
          }
          return {
            type: "confirm",
            title: "销售开单",
            content: `确认销售 ${p.name} x${qty}，单价 ¥${formatPrice(Number(p.price))}，合计 ¥${formatPrice(qty * Number(p.price))}？`,
            needsConfirmation: true,
            toolName: "create_sale",
            toolArgs: { items: [{ productName: p.name, quantity: qty }], paymentMethod: "cash" },
          };
        }
        if (products.length > 1) {
          return {
            type: "table",
            title: "找到多个商品",
            content: `找到 ${products.length} 个匹配"${productName}"的商品，请明确商品名称：`,
            data: products.map((p) => ({ 商品: p.name, 库存: `${p.inventory?.quantity ?? 0}${p.unit}`, 价格: `¥${formatPrice(Number(p.price))}` })),
          };
        }
        return { type: "text", title: "商品未找到", content: `未找到包含"${productName}"的商品，请检查商品名称。` };
      }
    }
    // Generic sell request
    const recentProducts = await db.product.findMany({
      where: { status: "active" },
      include: { inventory: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    return {
      type: "list",
      title: "选择商品",
      content: `请告诉我具体要卖什么商品，例如"卖5瓶可口可乐"。以下是最近的商品：`,
      data: recentProducts.map((p) => ({ 商品: p.name, 库存: `${p.inventory?.quantity ?? 0}${p.unit}`, 价格: `¥${formatPrice(Number(p.price))}` })),
    };
  }

  if (q.includes("缺货") || q.includes("没货") || q.includes("无货")) {
    const items = await db.inventory.findMany({
      where: { quantity: 0 },
      include: { product: { include: { category: true } } },
    });
    if (items.length === 0) {
      return { type: "text", title: "库存查询", content: "目前没有缺货商品，库存充足！" };
    }
    return {
      type: "table", title: "缺货商品",
      content: `共有 ${items.length} 个商品缺货：`,
      data: items.map((i) => ({ 商品: i.product.name, 分类: i.product.category.name, 库存: 0 })),
    };
  }

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
      type: "table", title: "低库存商品",
      content: `共有 ${items.length} 个商品库存偏低（<10）：`,
      data: items.map((i) => ({ 商品: i.product.name, 库存: `${i.quantity} ${i.product.unit}` })),
    };
  }

  if (q.includes("今天") || q.includes("今日")) {
    if (q.includes("销售") || q.includes("卖") || q.includes("营收") || q.includes("收入")) {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const [sales, orderCount] = await Promise.all([
        db.saleOrder.aggregate({ _sum: { totalAmount: true }, where: { createdAt: { gte: today } } }),
        db.saleOrder.count({ where: { createdAt: { gte: today } } }),
      ]);
      const amount = Number(sales._sum.totalAmount || 0);
      return {
        type: "text", title: "今日销售",
        content: `今日销售额：¥${formatPrice(amount)}\n今日订单数：${orderCount} 笔\n${orderCount > 0 ? `客单价：¥${formatPrice(amount / orderCount)}` : ""}`,
      };
    }
  }

  if (q.includes("热销") || q.includes("畅销") || q.includes("卖得好") || q.includes("什么火")) {
    const days = 7;
    const startDate = new Date(); startDate.setDate(startDate.getDate() - days); startDate.setHours(0, 0, 0, 0);
    const topItems = await db.saleOrderItem.groupBy({
      by: ["productId"], _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } }, take: 10,
      where: { saleOrder: { createdAt: { gte: startDate } } },
    });
    const details = await Promise.all(
      topItems.map(async (item, i) => {
        const product = await db.product.findUnique({ where: { id: item.productId }, select: { name: true } });
        return { 排名: i + 1, 商品: product?.name || "未知", 销量: item._sum.quantity || 0 };
      })
    );
    return { type: "table", title: "近7天热销排行", content: "近7天热销商品 Top 10：", data: details };
  }

  if (q.includes("采购") || q.includes("进货")) {
    if (q.includes("多少") || q.includes("金额") || q.includes("总额") || q.includes("花了")) {
      const today = new Date();
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const result = await db.purchaseOrder.aggregate({
        _sum: { totalAmount: true },
        where: { createdAt: { gte: monthStart }, status: { not: "cancelled" } },
      });
      const amount = Number(result._sum.totalAmount || 0);
      return { type: "text", title: "采购查询", content: `本月采购总额：¥${formatPrice(amount)}` };
    }
    if (q.includes("待审批") || q.includes("待处理") || q.includes("未审批")) {
      const count = await db.purchaseOrder.count({ where: { status: "pending" } });
      return { type: "text", title: "采购查询", content: `当前有 ${count} 笔采购单待审批。` };
    }
  }

  if (q.includes("供应商") || q.includes("供货商")) {
    const supplierNameMatch = q.match(/供应商(.+?)(电话|联系|地址|$)/);
    if (supplierNameMatch) {
      const name = supplierNameMatch[1].trim();
      const supplier = await db.supplier.findFirst({ where: { name: { contains: name } } });
      if (supplier) {
        return {
          type: "text", title: "供应商信息",
          content: `${supplier.name}\n联系人：${supplier.contact}\n电话：${supplier.phone}\n地址：${supplier.address || "未填写"}`,
        };
      }
    }
    const suppliers = await db.supplier.findMany({ where: { status: "active" } });
    return {
      type: "table", title: "供应商列表",
      content: `共有 ${suppliers.length} 个活跃供应商：`,
      data: suppliers.map((s) => ({ 名称: s.name, 联系人: s.contact, 电话: s.phone })),
    };
  }

  if (q.includes("商品") && (q.includes("多少") || q.includes("几个") || q.includes("数量"))) {
    const count = await db.product.count({ where: { status: "active" } });
    const catCount = await db.category.count();
    return { type: "text", title: "商品查询", content: `当前共有 ${count} 个活跃商品，分布在 ${catCount} 个分类中。` };
  }

  // User list (admin only)
  if (user?.role === "admin" && q.includes("用户") && (q.includes("列表") || q.includes("查看") || q.includes("所有") || q.includes("多少"))) {
    const users = await db.user.findMany({ select: { name: true, username: true, role: true } });
    const roleLabels: Record<string, string> = { admin: "管理员", purchaser: "采购员", inventory_keeper: "库管员", cashier: "收银员" };
    return {
      type: "table", title: "用户列表",
      content: `共有 ${users.length} 个用户：`,
      data: users.map((u) => ({ 姓名: u.name, 用户名: u.username, 角色: roleLabels[u.role] || u.role })),
    };
  }

  // Product detail by name
  if (q.includes("详情") || q.includes("详细信息")) {
    const nameMatch = q.replace(/的?(详情|详细信息|商品详情|信息)/g, "").trim();
    if (nameMatch) {
      const product = await db.product.findFirst({
        where: { name: { contains: nameMatch }, status: "active" },
        include: { category: true, inventory: true },
      });
      if (product) {
        const stock = product.inventory?.quantity ?? 0;
        return {
          type: "text", title: `${product.name} 详情`,
          content: `分类：${product.category.name}\n价格：¥${formatPrice(Number(product.price))}/${product.unit}\n库存：${stock} ${product.unit}\n状态：${product.status === "active" ? "上架" : "下架"}${product.description ? `\n描述：${product.description}` : ""}`,
        };
      }
    }
  }

  // Navigation keywords (优先于库存查询)
  if (q.includes("去") || q.includes("打开") || q.includes("看看") || q.includes("跳转")) {
    const navMap: Record<string, { page: string; name: string }> = {
      "库存": { page: "/inventory", name: "库存管理" },
      "商品": { page: "/products", name: "商品管理" },
      "销售": { page: "/sales", name: "销售管理" },
      "采购": { page: "/purchases", name: "采购管理" },
      "供应商": { page: "/suppliers", name: "供应商管理" },
      "仪表盘": { page: "/dashboard", name: "仪表盘" },
      "用户": { page: "/users", name: "用户管理" },
      "分类": { page: "/categories", name: "分类管理" },
      "设置": { page: "/settings/ai", name: "系统设置" },
    };
    for (const [keyword, target] of Object.entries(navMap)) {
      if (q.includes(keyword)) {
        return { type: "navigate", title: "导航", content: `正在前往${target.name}...`, navigateTo: target.page };
      }
    }
  }

  if (q.includes("库存") || q.includes("还有多少") || q.includes("剩")) {
    const allProducts = await db.product.findMany({ where: { status: "active" }, include: { inventory: true } });
    const matched = allProducts.find((p) => q.includes(p.name.toLowerCase()));
    if (matched) {
      const stock = matched.inventory?.quantity ?? 0;
      const status = stock === 0 ? "（缺货）" : stock < 10 ? "（库存偏低）" : "（库存充足）";
      return { type: "text", title: "商品库存", content: `${matched.name}：库存 ${stock} ${matched.unit} ${status}` };
    }
    return { type: "text", title: "库存查询", content: '请输入具体商品名称查询库存，例如"可口可乐还有多少？"' };
  }

  if (q.includes("帮助") || q.includes("help") || q.includes("功能") || q.includes("能做什么")) {
    return {
      type: "text", title: "帮助",
      content: `我是超市智能助手，可以帮你查询和操作：

· "XX商品还有多少？" — 查询库存
· "哪些商品缺货了？" — 缺货列表
· "今天卖了多少？" — 今日销售
· "什么卖得好？" — 热销排行
· "卖5瓶可口可乐" — 销售开单
· "采购花了多少？" — 采购金额
· "供应商电话" — 供应商信息
· "商品有多少个？" — 商品统计

试试问我吧！`,
    };
  }

  return {
    type: "text", title: "未理解",
    content: '抱歉，我没有理解你的问题。输入"帮助"可以查看我能回答的问题列表。',
  };
}
