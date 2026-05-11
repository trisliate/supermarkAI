import { db } from "./db.server";
import { decrypt } from "./crypto.server";
import { formatPrice } from "./utils";
import type { AIConfig } from "@prisma/client";

export interface AssistantResponse {
  type: "text" | "list" | "table" | "navigate";
  title: string;
  content: string;
  data?: Record<string, unknown>[];
  navigateTo?: string;
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
}

const providerBaseUrls: Record<string, string> = {
  dashscope: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  deepseek: "https://api.deepseek.com/v1",
  glm: "https://open.bigmodel.cn/api/paas/v4",
  moonshot: "https://api.moonshot.cn/v1",
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
];

async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
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

  return `你是一个超市管理系统的 AI 智能助手。你可以帮助用户查询库存、销售、供应商等信息，也可以帮用户导航到系统中的不同页面。

当前系统数据概览：
- 活跃商品：${productCount} 个，分布在 ${categoryCount} 个分类中
- 低库存商品（<10）：${lowStockCount} 个
- 缺货商品：${outOfStockCount} 个
- 今日销售额：¥${formatPrice(todayAmount)}，${todayOrders} 笔订单
- 待审批采购单：${pendingPurchases} 笔

你可以使用提供的工具来查询数据和导航页面。请用中文回答，简洁明了。`;
}

async function callLLM(config: { provider: string; model: string; apiKey: string; baseUrl: string | null }, messages: ChatMessage[]): Promise<{ content: string; toolCalls?: LLMToolCall[] }> {
  const baseUrl = config.baseUrl || providerBaseUrls[config.provider] || "";
  const decryptedKey = decrypt(config.apiKey);

  // Most Chinese LLMs support OpenAI-compatible format
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${decryptedKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: "auto",
      max_tokens: 1024,
      temperature: 0.7,
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
  };
}

export async function processQuery(input: string, history?: ChatMessage[]): Promise<AssistantResponse> {
  // Try LLM integration first
  try {
    const config = await db.aIConfig.findFirst({ where: { isActive: true } });
    if (config) {
      return await processWithLLM(config, input, history);
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("LLM error, falling back to keyword matching:", message);
  }

  // Fallback to keyword matching
  return processWithKeywords(input);
}

async function processWithLLM(config: AIConfig, input: string, history?: ChatMessage[]): Promise<AssistantResponse> {
  const systemPrompt = await buildSystemPrompt();

  const messages: ChatMessage[] = [
    { role: "system", content: config.systemPrompt || systemPrompt },
    ...(history || []),
    { role: "user", content: input },
  ];

  let result = await callLLM(config, messages);

  // Handle tool calls
  if (result.toolCalls && result.toolCalls.length > 0) {
    const toolResults: ChatMessage[] = [];

    for (const toolCall of result.toolCalls) {
      const functionName = toolCall.function?.name;
      const functionArgs = toolCall.function?.arguments ? JSON.parse(toolCall.function.arguments) : {};
      const toolResult = await executeTool(functionName, functionArgs);

      toolResults.push({
        role: "assistant" as const,
        content: null,
        tool_calls: [toolCall],
      });
      toolResults.push({
        role: "tool" as const,
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
async function processWithKeywords(input: string): Promise<AssistantResponse> {
  const q = input.trim().toLowerCase();

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
    type: "text", title: "未理解",
    content: '抱歉，我没有理解你的问题。输入"帮助"可以查看我能回答的问题列表。',
  };
}
