import { Form, useNavigation, Link, useLoaderData, useActionData } from "react-router";
import { useEffect, useRef } from "react";
import type { Route } from "./+types/inventory.$id";
import { requireRole } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { AppLayout } from "~/components/layout/app-layout";
import { Button, buttonVariants } from "~/components/ui/button";
import { cn, formatPrice } from "~/lib/utils";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { ArrowLeft, Loader2, ArrowDownToLine, ArrowUpFromLine, Settings, Package } from "lucide-react";
import { toast } from "sonner";

export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireRole(request, ["admin", "inventory_keeper"]);
  const { loadRoutePermissions } = await import("~/lib/permissions.server");
  const routePermissions = await loadRoutePermissions();
  const inventory = await db.inventory.findUnique({
    where: { id: Number(params.id) },
    include: { product: { include: { category: true } } },
  });
  if (!inventory) throw new Response("库存记录不存在", { status: 404 });

  const recentLogs = await db.inventoryLog.findMany({
    where: { productId: inventory.productId },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 15,
  });

  const serializedInventory = {
    ...inventory,
    product: { ...inventory.product, price: Number(inventory.product.price) },
  };
  return { user, inventory: serializedInventory, recentLogs, routePermissions };
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
  const { user, inventory, recentLogs, routePermissions } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const prevActionState = useRef(navigation.state);

  useEffect(() => {
    if (prevActionState.current === "submitting" && navigation.state === "idle" && actionData) {
      if (actionData.error) {
        toast.error(actionData.error);
      } else if (actionData.ok) {
        toast.success("库存调整成功");
      }
    }
    prevActionState.current = navigation.state;
  }, [navigation.state, actionData]);

  const stock = inventory.quantity;
  const isLow = stock < 10;
  const isOut = stock === 0;

  return (
    <AppLayout user={user} routePermissions={routePermissions}>
      <div className="max-w-3xl animate-fade-in">
        <div className="flex items-center gap-3 mb-5">
          <Link to="/inventory" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-8 w-8 p-0")}>
            <ArrowLeft className="size-4" />
          </Link>
          <p className="text-xs text-muted-foreground">{inventory.product.name}</p>
          <Badge variant="outline" className="ml-2">{inventory.product.category.name}</Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left: stock info + adjustment form */}
          <div className="space-y-4">
            {/* Current stock */}
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-5">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200 mb-4">
                <Package className="size-4 text-blue-500" />
                库存信息
              </div>
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 rounded-xl flex items-center justify-center text-2xl font-bold text-white ${isOut ? "bg-red-500" : isLow ? "bg-amber-500" : "bg-emerald-500"}`}>
                  {stock}
                </div>
                <div>
                  <p className="text-sm text-slate-500">{inventory.product.unit}</p>
                  <p className="text-xs text-slate-400">单价 ¥{formatPrice(Number(inventory.product.price))}</p>
                  <Badge variant={isOut ? "destructive" : isLow ? "secondary" : "default"} className="mt-1 text-[10px]">
                    {isOut ? "缺货" : isLow ? "库存偏低" : "正常"}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Adjustment form */}
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-5">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200 mb-4">
                <Settings className="size-4 text-blue-500" />
                出入库操作
              </div>
              <Form method="post" className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">操作类型</Label>
                    <Select name="type" defaultValue="IN">
                      <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="IN">入库</SelectItem>
                        <SelectItem value="OUT">出库</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="quantity" className="text-xs">数量</Label>
                    <Input name="quantity" type="number" min="1" required className="h-9" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reason" className="text-xs">原因 <span className="text-muted-foreground">(可选)</span></Label>
                  <Input name="reason" placeholder="操作原因" className="h-9" />
                </div>
                <Button type="submit" disabled={isSubmitting} className="h-9 w-full">
                  {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
                  {isSubmitting ? "提交中..." : "确认调整"}
                </Button>
              </Form>
            </div>
          </div>

          {/* Right: recent logs */}
          <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-5">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">操作记录</span>
            <div className="mt-3 max-h-[420px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">时间</TableHead>
                    <TableHead className="text-xs">类型</TableHead>
                    <TableHead className="text-xs text-right">数量</TableHead>
                    <TableHead className="text-xs">操作人</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-muted-foreground text-sm">暂无记录</TableCell>
                    </TableRow>
                  ) : (
                    recentLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </TableCell>
                        <TableCell>
                          <Badge variant={log.type === "IN" ? "default" : "destructive"} className="text-[10px]">
                            {log.type === "IN" ? <ArrowDownToLine className="size-2.5" /> : <ArrowUpFromLine className="size-2.5" />}
                            {log.type === "IN" ? "入库" : "出库"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">{log.type === "IN" ? "+" : "-"}{log.quantity}</TableCell>
                        <TableCell className="text-sm">{log.user.name}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
