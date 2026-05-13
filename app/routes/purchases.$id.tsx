import { Link, useFetcher } from "react-router";
import { useState, useEffect } from "react";
import type { Route } from "./+types/purchases.$id";
import { requireRole } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { AppLayout } from "~/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button, buttonVariants } from "~/components/ui/button";
import { cn, formatPrice } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { ArrowLeft, CheckCircle, FileText, Package } from "lucide-react";
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
  return { user, purchase: serializedPurchase };
}

export async function action({ request, params }: Route.ActionArgs) {
  const user = await requireRole(request, ["admin", "inventory_keeper"]);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const id = Number(params.id);

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
  }

  return { ok: true };
}

export default function PurchaseDetailPage({ loaderData }: Route.ComponentProps) {
  const { user, purchase } = loaderData;
  const fetcher = useFetcher();
  const status = statusLabels[purchase.status] || { label: purchase.status, variant: "outline" as const };
  const [showReceive, setShowReceive] = useState(false);
  const isReceiving = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      if (fetcher.data.error) {
        toast.error(fetcher.data.error);
      } else if (fetcher.data.ok) {
        toast.success("入库成功，库存已更新");
        setShowReceive(false);
      }
    }
  }, [fetcher.state, fetcher.data]);

  return (
    <AppLayout user={user}>
      <div className="max-w-3xl animate-fade-in">
        <div className="mb-6">
          <Link to="/purchases" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-2")}><ArrowLeft className="size-4" /> 返回采购列表</Link>
          <h2 className="text-2xl font-bold">采购单详情</h2>
        </div>

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
          <Button
            className="bg-green-600 hover:bg-green-700"
            onClick={() => setShowReceive(true)}
          >
            <CheckCircle className="size-4" /> 确认入库
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={showReceive}
        onOpenChange={setShowReceive}
        title="确认入库"
        description={`将为采购单 PO-${String(purchase.id).padStart(4, "0")} 执行入库操作，库存数量将相应增加。`}
        confirmText="确认入库"
        variant="default"
        loading={isReceiving}
        onConfirm={() => {
          const fd = new FormData();
          fd.set("intent", "receive");
          fetcher.submit(fd, { method: "post" });
        }}
      />
    </AppLayout>
  );
}
