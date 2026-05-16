import { Link, useFetcher } from "react-router";
import { useState, useEffect } from "react";
import type { Route } from "./+types/purchases.$id";
import { requireRole } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { AppLayout } from "~/components/layout/app-layout";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { formatPrice } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { ArrowLeft, CheckCircle, FileText, Package, ArrowDownToLine, Clock, CircleCheck, Ban, XCircle } from "lucide-react";
import { toast } from "sonner";

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "待审批", variant: "outline" },
  approved: { label: "已审批", variant: "default" },
  received: { label: "已入库", variant: "secondary" },
  rejected: { label: "已驳回", variant: "destructive" },
  cancelled: { label: "已取消", variant: "destructive" },
};

export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireRole(request, ["admin", "purchaser", "inventory_keeper"]);
  const { loadRoutePermissions } = await import("~/lib/permissions.server");
  const routePermissions = await loadRoutePermissions();
  const purchase = await db.purchaseOrder.findUnique({
    where: { id: Number(params.id) },
    include: {
      supplier: true,
      user: { select: { name: true } },
      items: { include: { product: true } },
    },
  });
  if (!purchase) throw new Response("采购单不存在", { status: 404 });
  const serializedPurchase = {
    ...purchase,
    totalAmount: Number(purchase.totalAmount),
    items: purchase.items.map((item) => ({ ...item, unitPrice: Number(item.unitPrice) })),
  };
  return { user, purchase: serializedPurchase, routePermissions };
}

export async function action({ request, params }: Route.ActionArgs) {
  const user = await requireRole(request, ["admin", "inventory_keeper"]);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const id = Number(params.id);

  if (intent === "approve" && user.role === "admin") {
    await db.purchaseOrder.update({ where: { id }, data: { status: "approved" } });
    return { ok: true, message: "采购单已审批" };
  }

  if (intent === "reject" && user.role === "admin") {
    await db.purchaseOrder.update({ where: { id }, data: { status: "rejected" } });
    return { ok: true, message: "采购单已驳回" };
  }

  if (intent === "cancel") {
    await db.purchaseOrder.update({ where: { id }, data: { status: "cancelled" } });
    return { ok: true, message: "采购单已取消" };
  }

  if (intent === "receive") {
    const purchase = await db.purchaseOrder.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!purchase || purchase.status !== "approved") {
      return { error: "采购单状态不允许入库" };
    }

    await db.$transaction(async (tx) => {
      for (const item of purchase.items) {
        await tx.inventory.upsert({
          where: { productId: item.productId },
          update: { quantity: { increment: item.quantity } },
          create: { productId: item.productId, quantity: item.quantity },
        });
        await tx.inventoryLog.create({
          data: {
            productId: item.productId,
            type: "IN",
            quantity: item.quantity,
            reason: `采购入库 PO-${String(id).padStart(4, "0")}`,
            userId: user.id,
          },
        });
      }
      await tx.purchaseOrder.update({ where: { id }, data: { status: "received" } });
    });
    return { ok: true, message: "入库成功，库存已更新" };
  }

  return { ok: true };
}

export default function PurchaseDetailPage({ loaderData }: Route.ComponentProps) {
  const { user, purchase } = loaderData;
  const fetcher = useFetcher();
  const status = statusLabels[purchase.status] || { label: purchase.status, variant: "outline" as const };
  const [showReceive, setShowReceive] = useState(false);
  const [showApprove, setShowApprove] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const isProcessing = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      if ((fetcher.data as any).error) {
        toast.error((fetcher.data as any).error);
      } else if ((fetcher.data as any).ok) {
        toast.success((fetcher.data as any).message || "操作成功");
        setShowReceive(false);
        setShowApprove(false);
        setShowReject(false);
        setShowCancel(false);
      }
    }
  }, [fetcher.state, fetcher.data]);

  return (
    <AppLayout user={user} routePermissions={loaderData.routePermissions} backTo="/purchases" backLabel="返回采购列表" description="采购单详情">
      <div className="max-w-3xl animate-fade-in">

        {/* Status Flow Bar */}
        {["pending", "approved", "received"].includes(purchase.status) && (
          <div className="mb-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
            <div className="flex items-center justify-between">
              {[
                { key: "pending", label: "待审批", icon: Clock },
                { key: "approved", label: "已审批", icon: CheckCircle },
                { key: "received", label: "已入库", icon: CircleCheck },
              ].map((step, i) => {
                const steps = ["pending", "approved", "received"];
                const currentIdx = steps.indexOf(purchase.status);
                const stepIdx = steps.indexOf(step.key);
                const isActive = stepIdx <= currentIdx;
                const isCurrent = stepIdx === currentIdx;
                const StepIcon = step.icon;
                return (
                  <div key={step.key} className="flex items-center flex-1">
                    <div className="flex flex-col items-center gap-1.5">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                        isCurrent ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30"
                          : isActive ? "bg-emerald-500 text-white"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                      }`}>
                        <StepIcon className="w-5 h-5" />
                      </div>
                      <span className={`text-xs font-medium ${isActive ? "text-slate-700 dark:text-slate-200" : "text-slate-400"}`}>
                        {step.label}
                      </span>
                    </div>
                    {i < 2 && (
                      <div className={`flex-1 h-0.5 mx-3 rounded ${stepIdx < currentIdx ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700"}`} />
                    )}
                  </div>
                );
              })}
            </div>
            {purchase.status === "approved" && (
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-center">
                <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">审批通过，可以执行入库操作</p>
              </div>
            )}
          </div>
        )}

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="size-4" /> PO-{String(purchase.id).padStart(4, "0")}
              <Badge variant={status.variant}>{status.label}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">供应商：</span>{purchase.supplier.name}</div>
              <div><span className="text-muted-foreground">采购员：</span>{purchase.user.name}</div>
              <div><span className="text-muted-foreground">总金额：</span><span className="font-semibold">¥{formatPrice(Number(purchase.totalAmount))}</span></div>
              <div><span className="text-muted-foreground">创建时间：</span>{new Date(purchase.createdAt).toLocaleString()}</div>
              {purchase.remark && <div className="col-span-2"><span className="text-muted-foreground">备注：</span>{purchase.remark}</div>}
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="size-4" /> 采购明细
            </CardTitle>
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
                {purchase.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.product.name}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">¥{formatPrice(Number(item.unitPrice))}</TableCell>
                    <TableCell className="text-right font-medium">¥{formatPrice(item.quantity * Number(item.unitPrice))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {purchase.status === "approved" && (user.role === "admin" || user.role === "inventory_keeper") && (
          <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-800/50 p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-500 flex items-center justify-center">
                  <ArrowDownToLine className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">准备入库</p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">审批通过，点击按钮执行入库操作</p>
                </div>
              </div>
              <Button
                size="lg"
                className="bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/20"
                onClick={() => setShowReceive(true)}
              >
                <CheckCircle className="size-5 mr-2" /> 确认入库
              </Button>
            </div>
          </div>
        )}

        {purchase.status === "pending" && user.role === "admin" && (
          <div className="bg-blue-50 dark:bg-blue-950/20 rounded-xl border border-blue-200 dark:border-blue-800/50 p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">待审批</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400">该采购单等待审批，请审核后操作</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="lg" onClick={() => setShowReject(true)}>
                  <Ban className="size-5 mr-2" /> 驳回
                </Button>
                <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/20" onClick={() => setShowApprove(true)}>
                  <CheckCircle className="size-5 mr-2" /> 审批通过
                </Button>
              </div>
            </div>
          </div>
        )}

        {purchase.status === "pending" && (
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setShowCancel(true)}>
              <XCircle className="size-4 mr-1.5" /> 取消采购单
            </Button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={showReceive}
        onOpenChange={setShowReceive}
        title="确认入库"
        description={`将为采购单 PO-${String(purchase.id).padStart(4, "0")} 执行入库操作，库存数量将相应增加。`}
        confirmText="确认入库"
        variant="default"
        loading={isProcessing}
        onConfirm={() => {
          const fd = new FormData();
          fd.set("intent", "receive");
          fetcher.submit(fd, { method: "post" });
        }}
      />

      <ConfirmDialog
        open={showApprove}
        onOpenChange={setShowApprove}
        title="审批采购单"
        description={`确定审批通过采购单 PO-${String(purchase.id).padStart(4, "0")}？审批后可执行入库操作。`}
        confirmText="审批通过"
        variant="default"
        loading={isProcessing}
        onConfirm={() => {
          const fd = new FormData();
          fd.set("intent", "approve");
          fetcher.submit(fd, { method: "post" });
        }}
      />

      <ConfirmDialog
        open={showReject}
        onOpenChange={setShowReject}
        title="驳回采购单"
        description={`确定要驳回采购单 PO-${String(purchase.id).padStart(4, "0")}？驳回后需重新创建。`}
        confirmText="驳回"
        loading={isProcessing}
        onConfirm={() => {
          const fd = new FormData();
          fd.set("intent", "reject");
          fetcher.submit(fd, { method: "post" });
        }}
      />

      <ConfirmDialog
        open={showCancel}
        onOpenChange={setShowCancel}
        title="取消采购单"
        description={`确定取消采购单 PO-${String(purchase.id).padStart(4, "0")}？此操作不可撤销。`}
        confirmText="取消采购单"
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
