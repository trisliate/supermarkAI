import type { Route } from "./+types/api.payment";
import { createPayment, queryPaymentStatus, handleWxPayNotify, handleAlipayNotify } from "~/lib/payment.server";
import { db } from "~/lib/db.server";

// GET: poll payment status by orderId
export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const orderId = Number(url.searchParams.get("orderId"));
  if (!orderId) return Response.json({ error: "Missing orderId" }, { status: 400 });

  const order = await db.saleOrder.findUnique({
    where: { id: orderId },
    select: { id: true, paymentStatus: true, transactionId: true },
  });
  if (!order) return Response.json({ error: "Order not found" }, { status: 404 });

  return Response.json({ orderId: order.id, paymentStatus: order.paymentStatus, transactionId: order.transactionId });
}

export async function action({ request }: Route.ActionArgs) {
  const contentType = request.headers.get("content-type") || "";

  // WeChat / Alipay callback (form-encoded or JSON)
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const formData = await request.formData();
    const body: Record<string, string> = {};
    formData.forEach((v, k) => { body[k] = String(v); });

    // Try Alipay first (form-encoded)
    if (body.sign) {
      const ok = await handleAlipayNotify(body);
      return new Response(ok ? "success" : "fail", { status: ok ? 200 : 400 });
    }
  }

  if (contentType.includes("application/json")) {
    const data = await request.json();

    // WeChat callback
    if (data.resource) {
      const headers = Object.fromEntries(request.headers.entries());
      const ok = await handleWxPayNotify(data, headers);
      return new Response(ok ? "" : "fail", { status: ok ? 200 : 500 });
    }

    // Frontend API calls
    const { intent } = data;

    if (intent === "create") {
      const { orderId, totalAmount, method } = data;
      try {
        const result = await createPayment(orderId, totalAmount, method);
        return Response.json({ ok: true, ...result });
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "创建支付失败";
        return Response.json({ ok: false, error: message }, { status: 400 });
      }
    }

    if (intent === "query") {
      const { orderId } = data;
      try {
        const status = await queryPaymentStatus(orderId);
        return Response.json({ ok: true, status });
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "查询失败";
        return Response.json({ ok: false, error: message }, { status: 400 });
      }
    }
  }

  return Response.json({ error: "Invalid request" }, { status: 400 });
}
