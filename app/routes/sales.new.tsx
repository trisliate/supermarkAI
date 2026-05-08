import { Form, redirect, useNavigation, Link, useLoaderData, useActionData } from "react-router";
import { useState } from "react";
import type { Route } from "./+types/sales.new";
import { requireRole } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { AppLayout } from "~/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button, buttonVariants } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { ArrowLeft, Loader2, AlertCircle, Search, Plus, Minus, Trash2, ShoppingCart, CreditCard } from "lucide-react";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireRole(request, ["admin", "cashier"]);
  const products = await db.product.findMany({
    where: { status: "active" },
    include: { inventory: true },
    orderBy: { name: "asc" },
  });
  const available = products.filter((p) => p.inventory && p.inventory.quantity > 0);
  return { user, products: available };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireRole(request, ["admin", "cashier"]);
  const formData = await request.formData();
  const itemsJson = formData.get("items") as string;
  const items: { productId: number; quantity: number; unitPrice: number }[] = JSON.parse(itemsJson);

  if (items.length === 0) return { error: "请添加至少一件商品" };

  for (const item of items) {
    const inv = await db.inventory.findUnique({ where: { productId: item.productId } });
    if (!inv || inv.quantity < item.quantity) {
      const product = await db.product.findUnique({ where: { id: item.productId } });
      return { error: `${product?.name} 库存不足（剩余 ${inv?.quantity ?? 0}）` };
    }
  }

  const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  await db.$transaction(async (tx) => {
    const sale = await tx.saleOrder.create({
      data: {
        userId: user.id,
        totalAmount,
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
        },
      },
    });

    for (const item of items) {
      await tx.inventory.update({
        where: { productId: item.productId },
        data: { quantity: { decrement: item.quantity } },
      });
      await tx.inventoryLog.create({
        data: {
          productId: item.productId,
          type: "OUT",
          quantity: item.quantity,
          reason: `销售出库 SO-${String(sale.id).padStart(4, "0")}`,
          userId: user.id,
        },
      });
    }
  });

  throw redirect("/sales");
}

export default function SalesNewPage() {
  const { user, products } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [cart, setCart] = useState<{ productId: number; name: string; quantity: number; unitPrice: number; unit: string; maxQty: number }[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [qty, setQty] = useState(1);

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) || p.id.toString().includes(search)
  );

  const addToCart = () => {
    const product = products.find((p) => p.id === Number(selectedId));
    if (!product || qty <= 0) return;

    const maxQty = product.inventory?.quantity ?? 0;
    const existing = cart.find((c) => c.productId === product.id);
    if (existing) {
      const newQty = existing.quantity + qty;
      if (newQty > maxQty) return;
      setCart(cart.map((c) => c.productId === product.id ? { ...c, quantity: newQty } : c));
    } else {
      if (qty > maxQty) return;
      setCart([...cart, {
        productId: product.id,
        name: product.name,
        quantity: qty,
        unitPrice: Number(product.price),
        unit: product.unit,
        maxQty,
      }]);
    }
    setSelectedId("");
    setQty(1);
    setSearch("");
  };

  const updateQty = (productId: number, newQty: number) => {
    const item = cart.find((c) => c.productId === productId);
    if (!item || newQty <= 0 || newQty > item.maxQty) return;
    setCart(cart.map((c) => c.productId === productId ? { ...c, quantity: newQty } : c));
  };

  const removeItem = (productId: number) => {
    setCart(cart.filter((c) => c.productId !== productId));
  };

  const total = cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  return (
    <AppLayout user={user}>
      <div className="max-w-4xl animate-fade-in">
        <div className="mb-6">
          <Link to="/sales" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-2")}><ArrowLeft className="size-4" /> 返回销售记录</Link>
          <h2 className="text-2xl font-bold">收银台</h2>
        </div>

        {actionData?.error && (
          <Alert variant="destructive" className="mb-4"><AlertCircle className="size-4" /><AlertDescription>{actionData.error}</AlertDescription></Alert>
        )}

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Search className="size-4" /> 添加商品
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <Label className="text-xs">搜索/选择商品</Label>
                <div className="relative">
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="输入商品名称或ID搜索..."
                  />
                  {search && (
                    <div className="absolute z-10 w-full bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto mt-1">
                      {filtered.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setSelectedId(String(p.id));
                            setSearch(p.name);
                            setQty(1);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex justify-between"
                        >
                          <span>{p.name}</span>
                          <span className="text-muted-foreground">¥{Number(p.price).toFixed(2)}/{p.unit} | 库存:{p.inventory?.quantity}</span>
                        </button>
                      ))}
                      {filtered.length === 0 && <div className="px-3 py-2 text-muted-foreground text-sm">无匹配商品</div>}
                    </div>
                  )}
                </div>
              </div>
              <div className="w-24">
                <Label className="text-xs">数量</Label>
                <Input type="number" min="1" value={qty} onChange={(e) => setQty(Number(e.target.value))} />
              </div>
              <Button type="button" onClick={addToCart} disabled={!selectedId}>
                <Plus className="size-4" /> 加入购物车
              </Button>
            </div>
          </CardContent>
        </Card>

        <Form method="post">
          <input type="hidden" name="items" value={JSON.stringify(cart.map((c) => ({ productId: c.productId, quantity: c.quantity, unitPrice: c.unitPrice })))} />

          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShoppingCart className="size-4" /> 购物车
                {cart.length > 0 && <span className="text-muted-foreground font-normal">({cart.length}件商品)</span>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>商品</TableHead>
                    <TableHead className="text-right">单价</TableHead>
                    <TableHead className="text-center">数量</TableHead>
                    <TableHead className="text-right">小计</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cart.map((item) => (
                    <TableRow key={item.productId}>
                      <TableCell>{item.name}</TableCell>
                      <TableCell className="text-right">¥{item.unitPrice.toFixed(2)}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Button type="button" variant="outline" size="sm" className="size-7 p-0" onClick={() => updateQty(item.productId, item.quantity - 1)}>
                            <Minus className="size-3" />
                          </Button>
                          <span className="w-8 text-center font-medium">{item.quantity}</span>
                          <Button type="button" variant="outline" size="sm" className="size-7 p-0" onClick={() => updateQty(item.productId, item.quantity + 1)} disabled={item.quantity >= item.maxQty}>
                            <Plus className="size-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold">¥{(item.quantity * item.unitPrice).toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(item.productId)}>
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {cart.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">购物车为空，请添加商品</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center justify-between py-6">
              <div className="text-2xl font-bold">
                合计：<span className="text-destructive">¥{total.toFixed(2)}</span>
              </div>
              <Button
                type="submit"
                disabled={isSubmitting || cart.length === 0}
                className="bg-green-600 hover:bg-green-700 text-lg px-8 py-6"
              >
                {isSubmitting ? <Loader2 className="size-5 animate-spin" /> : <CreditCard className="size-5" />}
                {isSubmitting ? "结算中..." : "结算"}
              </Button>
            </CardContent>
          </Card>
        </Form>
      </div>
    </AppLayout>
  );
}
