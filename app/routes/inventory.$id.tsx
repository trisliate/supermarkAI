import { Form, redirect, useNavigation, Link, useLoaderData, useActionData } from "react-router";
import type { Route } from "./+types/inventory.$id";
import { requireRole } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { AppLayout } from "~/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button, buttonVariants } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/badge";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { ArrowLeft, Loader2, AlertCircle, CheckCircle, ArrowDownToLine, ArrowUpFromLine, Settings, Package } from "lucide-react";

export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireRole(request, ["admin", "inventory_keeper"]);
  const inventory = await db.inventory.findUnique({
    where: { id: Number(params.id) },
    include: { product: { include: { category: true } } },
  });
  if (!inventory) throw new Response("库存记录不存在", { status: 404 });

  const recentLogs = await db.inventoryLog.findMany({
    where: { productId: inventory.productId },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return { user, inventory, recentLogs };
}

export async function action({ request, params }: Route.ActionArgs) {
  const user = await requireRole(request, ["admin", "inventory_keeper"]);
  const formData = await request.formData();
  const type = formData.get("type") as "IN" | "OUT";
  const quantity = Number(formData.get("quantity"));
  const reason = formData.get("reason") as string;

  if (!quantity || quantity <= 0) return { error: "数量必须大于0" };

  const inventory = await db.inventory.findUnique({ where: { id: Number(params.id) } });
  if (!inventory) throw new Response("库存记录不存在", { status: 404 });

  if (type === "OUT" && inventory.quantity < quantity) {
    return { error: `库存不足，当前库存 ${inventory.quantity}` };
  }

  await db.$transaction(async (tx) => {
    await tx.inventory.update({
      where: { id: Number(params.id) },
      data: { quantity: type === "IN" ? { increment: quantity } : { decrement: quantity } },
    });
    await tx.inventoryLog.create({
      data: {
        productId: inventory.productId,
        type,
        quantity,
        reason: reason || (type === "IN" ? "手动入库" : "手动出库"),
        userId: user.id,
      },
    });
  });

  return { ok: true };
}

export default function InventoryDetailPage() {
  const { user, inventory, recentLogs } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <AppLayout user={user}>
      <div className="max-w-2xl animate-fade-in">
        <div className="mb-6">
          <Link to="/inventory" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-2")}><ArrowLeft className="size-4" /> 返回库存列表</Link>
          <h2 className="text-2xl font-bold">库存调整</h2>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="size-4" /> {inventory.product.name}
              <Badge variant="secondary">{inventory.product.category.name}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">当前库存：</span><span className="font-bold text-lg">{inventory.quantity} {inventory.product.unit}</span></div>
              <div><span className="text-muted-foreground">单价：</span>¥{Number(inventory.product.price).toFixed(2)}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings className="size-4" /> 出入库操作
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form method="post" className="space-y-4">
              {actionData?.error && (
                <Alert variant="destructive"><AlertCircle className="size-4" /><AlertDescription>{actionData.error}</AlertDescription></Alert>
              )}
              {actionData?.ok && (
                <Alert className="border-green-200 bg-green-50 text-green-700"><CheckCircle className="size-4" /><AlertDescription>操作成功</AlertDescription></Alert>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>操作类型</Label>
                  <Select name="type" defaultValue="IN">
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="IN">入库</SelectItem>
                      <SelectItem value="OUT">出库</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="quantity">数量</Label>
                  <Input name="quantity" type="number" min="1" required />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reason">原因</Label>
                <Input name="reason" placeholder="可选" />
              </div>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
                {isSubmitting ? "提交中..." : "确认"}
              </Button>
            </Form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">最近操作记录</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>时间</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead className="text-right">数量</TableHead>
                  <TableHead>原因</TableHead>
                  <TableHead>操作人</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={log.type === "IN" ? "default" : "destructive"}>
                        {log.type === "IN" ? <ArrowDownToLine className="size-3 mr-1" /> : <ArrowUpFromLine className="size-3 mr-1" />}
                        {log.type === "IN" ? "入库" : "出库"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{log.quantity}</TableCell>
                    <TableCell className="text-muted-foreground">{log.reason || "-"}</TableCell>
                    <TableCell>{log.user.name}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
