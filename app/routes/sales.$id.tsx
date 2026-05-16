import { Link, useFetcher } from "react-router";
import { useState, useEffect } from "react";
import type { Route } from "./+types/sales.$id";
import { requireRole } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { AppLayout } from "~/components/layout/app-layout";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { formatPrice } from "~/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { Receipt, Banknote, QrCode, CreditCard, RotateCcw, Clock, CircleCheck, XCircle } from "lucide-react";
import { toast } from "sonner";

const paymentLabels: Record<string, { label: string; icon: typeof Banknote; color: string }> = {
  cash: { label: "现金", icon: Banknote, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400" },
  wechat: { label: "微信支付", icon: QrCode, color: "text-green-600 bg-green-50 dark:bg-green-950/30 dark:text-green-400" },
  alipay: { label: "支付宝", icon: CreditCard, color: "text-blue-600 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400" },
};

const statusLabels: Record<string, { label: string; color: string }> = {
  paid: { label: "已支付", color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400" },
  pending: { label: "待支付", color: "text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400" },
  failed: { label: "失败", color: "text-red-600 bg-red-50 dark:bg-red-950/30 dark:text-red-400" },
  refunded: { label: "已退款", color: "text-slate-600 bg-slate-50 dark:bg-slate-950/30 dark:text-slate-400" },
};

export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireRole(request, ["admin", "cashier"]);
  const { loadRoutePermissions } = await import("~/lib/permissions.server");
  const routePermissions = await loadRoutePermissions();

  const sale = await db.saleOrder.findUnique({
    where: { id: Number(params.id) },
    include: {
      user: { select: { name: true } },
      items: { include: { product: true } },
    },
  });
  if (!sale) throw new Response("订单不存在", { status: 404 });

  return {
    user,
    routePermissions,
    sale: {
      ...sale,
      totalAmount: Number(sale.totalAmount),
      paidAmount: sale.paidAmount ? Number(sale.paidAmount) : null,
      changeAmount: sale.changeAmount ? Number(sale.changeAmount) : null,
      items: sale.items.map((item) => ({ ...item, unitPrice: Number(item.unitPrice) })),
    },
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const user = await requireRole(request, ["admin"]);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const id = Number(params.id);

  if (intent === "refund") {
    const sale = await db.saleOrder.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!sale) return { error: "订单不存在" };
    if (sale.paymentStatus !== "paid") return { error: "只有已支付的订单可以退款" };

    await db.$transaction(async (tx) => {
      // Return inventory
      for (const item of sale.items) {
        await tx.inventory.update({
          where: { productId: item.productId },
          data: { quantity: { increment: item.quantity } },
        });
        await tx.inventoryLog.create({
          data: {
            productId: item.productId,
            type: "IN",
            quantity: item.quantity,
            reason: `订单退款 SO-${String(id).padStart(4, "0")}`,
            userId: user.id,
          },
        });
      }
      await tx.saleOrder.update({
        where: { id },
        data: { paymentStatus: "refunded" },
      });
    });

    return { ok: true, message: "退款成功，库存已恢复" };
  }

  if (intent === "cancel") {
    const sale = await db.saleOrder.findUnique({ where: { id } });
    if (!sale) return { error: "订单不存在" };
    if (sale.paymentStatus !== "pending") return { error: "只有待支付的订单可以取消" };

    await db.saleOrder.update({
      where: { id },
      data: { paymentStatus: "failed" },
    });
    return { ok: true, message: "订单已取消" };
  }

  return { error: "未知操作" };
}

export default function SaleDetailPage({ loaderData }: Route.ComponentProps) {
  const { user, sale } = loaderData;
  const fetcher = useFetcher();
  const [showRefund, setShowRefund] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const isProcessing = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      if ((fetcher.data as any).error) {
        toast.error((fetcher.data as any).error);
      } else if ((fetcher.data as any).ok) {
        toast.success((fetcher.data as any).message);
        setShowRefund(false);
        setShowCancel(false);
      }
    }
  }, [fetcher.state, fetcher.data]);

  const pm = paymentLabels[sale.paymentMethod] || paymentLabels.cash;
  const PmIcon = pm.icon;
  const st = statusLabels[sale.paymentStatus] || statusLabels.paid;

  return (
    <AppLayout user={user} routePermissions={loaderData.routePermissions} backTo="/sales" backLabel="返回销售列表" description="订单详情">
      <div className="max-w-4xl space-y-5 animate-fade-in">
        {/* Status flow */}
        {sale.paymentStatus === "paid" && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-5">
            <div className="flex items-center justify-between">
              {[
                { key: "pending", label: "下单", icon: Clock },
                { key: "paid", label: "已支付", icon: CircleCheck },
              ].map((step, i) => {
                const StepIcon = step.icon;
                const isActive = step.key === "pending" || step.key === "paid";
                const isCurrent = step.key === "paid";
                return (
                  <div key={step.key} className="flex items-center flex-1">
                    <div className="flex flex-col items-center gap-1.5">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        isCurrent ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                          : isActive ? "bg-emerald-500 text-white"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                      }`}>
                        <StepIcon className="w-5 h-5" />
                      </div>
                      <span className={`text-xs font-medium ${isActive ? "text-slate-700 dark:text-slate-200" : "text-slate-400"}`}>
                        {step.label}
                      </span>
                    </div>
                    {i < 1 && (
                      <div className="flex-1 h-0.5 mx-3 rounded bg-emerald-500" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {sale.paymentStatus === "refunded" && (
          <div className="bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-200 dark:border-red-800/50 p-4 text-center">
            <p className="text-sm text-red-600 dark:text-red-400 font-medium">该订单已退款</p>
          </div>
        )}

        {/* Order info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="size-4" />
              SO-{String(sale.id).padStart(4, "0")}
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>{st.label}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">营业员：</span>
                {sale.user.name}
              </div>
              <div>
                <span className="text-muted-foreground">支付方式：</span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${pm.color}`}>
                  <PmIcon className="size-3" />
                  {pm.label}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">订单金额：</span>
                <span className="font-semibold">¥{formatPrice(sale.totalAmount)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">下单时间：</span>
                {new Date(sale.createdAt).toLocaleString()}
              </div>
              {sale.paidAmount != null && (
                <>
                  <div>
                    <span className="text-muted-foreground">实付金额：</span>
                    ¥{formatPrice(sale.paidAmount)}
                  </div>
                  {sale.changeAmount != null && sale.changeAmount > 0 && (
                    <div>
                      <span className="text-muted-foreground">找零：</span>
                      ¥{formatPrice(sale.changeAmount)}
                    </div>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Items */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">商品明细</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>商品</TableHead>
                  <TableHead className="text-right">数量</TableHead>
                  <TableHead className="text-right">单价</TableHead>
                  <TableHead className="text-right">小计</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sale.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.product.name}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">¥{formatPrice(item.unitPrice)}</TableCell>
                    <TableCell className="text-right font-medium">¥{formatPrice(item.quantity * item.unitPrice)}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={3} className="text-right font-semibold">合计</TableCell>
                  <TableCell className="text-right font-bold text-base">¥{formatPrice(sale.totalAmount)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Actions */}
        {user.role === "admin" && sale.paymentStatus === "paid" && (
          <div className="bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-800/50 p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center">
                  <RotateCcw className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">退款操作</p>
                  <p className="text-xs text-amber-600 dark:text-amber-400">退款后库存将自动恢复</p>
                </div>
              </div>
              <Button variant="destructive" size="lg" onClick={() => setShowRefund(true)}>
                <RotateCcw className="size-5 mr-2" /> 退款
              </Button>
            </div>
          </div>
        )}

        {user.role === "admin" && sale.paymentStatus === "pending" && (
          <div className="bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-200 dark:border-red-800/50 p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-red-500 flex items-center justify-center">
                  <XCircle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-red-800 dark:text-red-300">取消订单</p>
                  <p className="text-xs text-red-600 dark:text-red-400">该订单还未支付，可以取消</p>
                </div>
              </div>
              <Button variant="destructive" size="lg" onClick={() => setShowCancel(true)}>
                <XCircle className="size-5 mr-2" /> 取消订单
              </Button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={showRefund}
        onOpenChange={setShowRefund}
        title="确认退款"
        description={`将为订单 SO-${String(sale.id).padStart(4, "0")} 执行退款操作，退款金额 ¥${formatPrice(sale.totalAmount)}，库存将自动恢复。`}
        confirmText="确认退款"
        variant="destructive"
        loading={isProcessing}
        onConfirm={() => {
          const fd = new FormData();
          fd.set("intent", "refund");
          fetcher.submit(fd, { method: "post" });
        }}
      />

      <ConfirmDialog
        open={showCancel}
        onOpenChange={setShowCancel}
        title="取消订单"
        description={`确认取消订单 SO-${String(sale.id).padStart(4, "0")}？`}
        confirmText="确认取消"
        variant="destructive"
        loading={isProcessing}
        onConfirm={() => {
          const fd = new FormData();
          fd.set("intent", "cancel");
          fetcher.submit(fd, { method: "post" });
        }}
      />
    </AppLayout>
  );
}
