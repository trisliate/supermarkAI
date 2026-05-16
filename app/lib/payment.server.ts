import { db } from "./db.server";
import { decrypt } from "./crypto.server";

interface WxPayConfig {
  appid: string;
  mchid: string;
  privateKey: string;
  publicKey: string;
  serial_no?: string;
  key?: string;
}

interface AlipayConfig {
  appId: string;
  privateKey: string;
  alipayPublicKey?: string;
}

let wxPayInstance: any = null;
let alipayInstance: any = null;

async function getWxPayConfig(): Promise<WxPayConfig | null> {
  const config = await db.paymentConfig.findFirst({ where: { provider: "wechat", isActive: true } });
  if (!config || !config.apiKey || !config.certData) return null;
  return {
    appid: config.appId || "",
    mchid: config.mchId || "",
    privateKey: decrypt(config.certData),
    publicKey: decrypt(config.certData),
    key: config.apiKey ? decrypt(config.apiKey) : undefined,
  };
}

async function getAlipayConfig(): Promise<AlipayConfig | null> {
  const config = await db.paymentConfig.findFirst({ where: { provider: "alipay", isActive: true } });
  if (!config || !config.apiKey) return null;
  return {
    appId: config.appId || "",
    privateKey: decrypt(config.apiKey),
  };
}

async function getWxPay() {
  if (wxPayInstance) return wxPayInstance;
  const cfg = await getWxPayConfig();
  if (!cfg) return null;
  const WxPay = (await import("wechatpay-node-v3")).default;
  wxPayInstance = new WxPay({
    appid: cfg.appid,
    mchid: cfg.mchid,
    publicKey: Buffer.from(cfg.publicKey),
    privateKey: Buffer.from(cfg.privateKey),
  });
  return wxPayInstance;
}

async function getAlipay() {
  if (alipayInstance) return alipayInstance;
  const cfg = await getAlipayConfig();
  if (!cfg) return null;
  const { AlipaySdk } = await import("alipay-sdk");
  alipayInstance = new AlipaySdk({
    appId: cfg.appId,
    privateKey: cfg.privateKey,
  });
  return alipayInstance;
}

function getOrderNo(orderId: number): string {
  return `SO-${String(orderId).padStart(4, "0")}-${Date.now()}`;
}

export async function createPayment(
  orderId: number,
  totalAmount: number,
  method: "wechat" | "alipay"
): Promise<{ codeUrl?: string; payUrl?: string; orderNo: string }> {
  const orderNo = getOrderNo(orderId);
  const notifyUrl = `http://localhost:3000/api/payment`;

  if (method === "wechat") {
    const wx = await getWxPay();
    if (!wx) throw new Error("微信支付未配置");
    const result = await wx.transactions_native({
      description: `超市订单 ${orderNo}`,
      out_trade_no: orderNo,
      notify_url: notifyUrl,
      amount: { total: Math.round(totalAmount * 100) },
    });
    if (result.code_url) {
      await db.saleOrder.update({
        where: { id: orderId },
        data: { transactionId: orderNo },
      });
      return { codeUrl: result.code_url, orderNo };
    }
    throw new Error(result.message || "微信支付创建失败");
  }

  if (method === "alipay") {
    const alipay = await getAlipay();
    if (!alipay) throw new Error("支付宝未配置");
    const payUrl = alipay.pageExecute(
      "alipay.trade.page.pay",
      "GET",
      {
        bizContent: {
          out_trade_no: orderNo,
          total_amount: totalAmount.toFixed(2),
          subject: `超市订单 ${orderNo}`,
          product_code: "FAST_INSTANT_TRADE_PAY",
        },
        notify_url: notifyUrl,
      }
    );
    await db.saleOrder.update({
      where: { id: orderId },
      data: { transactionId: orderNo },
    });
    return { payUrl, orderNo };
  }

  throw new Error("不支持的支付方式");
}

export async function queryPaymentStatus(
  orderId: number
): Promise<"pending" | "paid" | "failed"> {
  const order = await db.saleOrder.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("订单不存在");
  if (order.paymentStatus === "paid") return "paid";
  if (!order.transactionId) return "pending";

  if (order.paymentMethod === "wechat") {
    const wx = await getWxPay();
    if (!wx) return "pending";
    try {
      const result = await wx.query({ out_trade_no: order.transactionId });
      if (result.trade_state === "SUCCESS") {
        await db.saleOrder.update({
          where: { id: orderId },
          data: { paymentStatus: "paid", paidAmount: order.totalAmount },
        });
        await deductInventoryForOrder(orderId);
        return "paid";
      }
      if (result.trade_state === "CLOSED" || result.trade_state === "PAYERROR") {
        await db.saleOrder.update({
          where: { id: orderId },
          data: { paymentStatus: "failed" },
        });
        return "failed";
      }
    } catch { /* ignore query errors */ }
  }

  if (order.paymentMethod === "alipay") {
    const alipay = await getAlipay();
    if (!alipay) return "pending";
    try {
      const result = await alipay.exec("alipay.trade.query", {
        bizContent: { out_trade_no: order.transactionId },
      });
      if (result.tradeStatus === "TRADE_SUCCESS" || result.tradeStatus === "TRADE_FINISHED") {
        await db.saleOrder.update({
          where: { id: orderId },
          data: { paymentStatus: "paid", paidAmount: order.totalAmount },
        });
        await deductInventoryForOrder(orderId);
        return "paid";
      }
      if (result.tradeStatus === "TRADE_CLOSED") {
        await db.saleOrder.update({
          where: { id: orderId },
          data: { paymentStatus: "failed" },
        });
        return "failed";
      }
    } catch { /* ignore query errors */ }
  }

  return "pending";
}

export async function handleWxPayNotify(body: any, headers: Record<string, string>): Promise<boolean> {
  const wx = await getWxPay();
  if (!wx) return false;

  try {
    const decrypted = wx.decipher_gcm(
      body.resource?.ciphertext,
      body.resource?.associated_data,
      body.resource?.nonce,
    );
    if (decrypted.trade_state === "SUCCESS") {
      const orderNo = decrypted.out_trade_no;
      // Try to find order by transactionId or by numeric ID
      const order = await db.saleOrder.findFirst({
        where: {
          OR: [
            { transactionId: orderNo },
            { id: Number(orderNo) || -1 },
          ],
          paymentStatus: "pending",
        },
      });
      if (order) {
        await db.saleOrder.update({
          where: { id: order.id },
          data: {
            paymentStatus: "paid",
            transactionId: decrypted.transaction_id,
            paidAmount: order.totalAmount,
          },
        });
        await deductInventoryForOrder(order.id);
      }
      return true;
    }
  } catch (e) {
    console.error("WeChat notify error:", e);
  }
  return false;
}

export async function handleAlipayNotify(body: Record<string, string>): Promise<boolean> {
  const alipay = await getAlipay();
  if (!alipay) return false;

  try {
    const isValid = alipay.checkNotifySignV2(body);
    if (isValid && body.trade_status === "TRADE_SUCCESS") {
      const orderNo = body.out_trade_no;
      const order = await db.saleOrder.findFirst({
        where: {
          OR: [
            { transactionId: orderNo },
            { id: Number(orderNo) || -1 },
          ],
          paymentStatus: "pending",
        },
      });
      if (order) {
        await db.saleOrder.update({
          where: { id: order.id },
          data: {
            paymentStatus: "paid",
            transactionId: body.trade_no,
            paidAmount: order.totalAmount,
          },
        });
        await deductInventoryForOrder(order.id);
      }
      return true;
    }
  } catch (e) {
    console.error("Alipay notify error:", e);
  }
  return false;
}

// Deduct inventory for a sale order after payment confirmation (idempotent)
async function deductInventoryForOrder(saleOrderId: number) {
  const order = await db.saleOrder.findUnique({
    where: { id: saleOrderId },
    include: { items: true },
  });
  if (!order || order.paymentStatus !== "paid") return;

  // Idempotency check: skip if inventory logs already exist for this order
  const orderRef = `SO-${String(order.id).padStart(4, "0")}`;
  const existingLog = await db.inventoryLog.findFirst({
    where: { reason: { contains: orderRef }, type: "OUT" },
  });
  if (existingLog) return;

  for (const item of order.items) {
    await db.inventory.update({
      where: { productId: item.productId },
      data: { quantity: { decrement: item.quantity } },
    });
    await db.inventoryLog.create({
      data: {
        productId: item.productId,
        type: "OUT",
        quantity: item.quantity,
        reason: `销售出库 ${orderRef}`,
        userId: order.userId,
      },
    });
  }
}

export function clearPaymentCache() {
  wxPayInstance = null;
  alipayInstance = null;
}
