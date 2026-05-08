import { Form, redirect, useNavigation, Link, useLoaderData, useActionData } from "react-router";
import { useState } from "react";
import type { Route } from "./+types/purchases.new";
import { requireRole } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { AppLayout } from "~/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button, buttonVariants } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { ArrowLeft, Loader2, AlertCircle, Plus, Trash2, ShoppingCart } from "lucide-react";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireRole(request, ["admin", "purchaser"]);
  const [suppliers, products] = await Promise.all([
    db.supplier.findMany({ where: { status: "active" }, orderBy: { name: "asc" } }),
    db.product.findMany({ where: { status: "active" }, orderBy: { name: "asc" } }),
  ]);
  return { user, suppliers, products };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireRole(request, ["admin", "purchaser"]);
  const formData = await request.formData();
  const supplierId = Number(formData.get("supplierId"));
  const remark = formData.get("remark") as string;

  const itemsJson = formData.get("items") as string;
  const items: { productId: number; quantity: number; unitPrice: number }[] = JSON.parse(itemsJson);

  if (!supplierId || items.length === 0) {
    return { error: "请选择供应商并添加至少一项商品" };
  }

  const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  await db.purchaseOrder.create({
    data: {
      supplierId,
      userId: user.id,
      totalAmount,
      remark,
      items: {
        create: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      },
    },
  });

  throw redirect("/purchases");
}

export default function NewPurchasePage() {
  const { user, suppliers, products } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [items, setItems] = useState<{ productId: number; quantity: number; unitPrice: number }[]>([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState("");

  const addItem = () => {
    const pid = Number(selectedProduct);
    if (!pid || quantity <= 0 || !unitPrice) return;
    setItems([...items, { productId: pid, quantity, unitPrice: Number(unitPrice) }]);
    setSelectedProduct("");
    setQuantity(1);
    setUnitPrice("");
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  return (
    <AppLayout user={user}>
      <div className="max-w-3xl animate-fade-in">
        <div className="mb-6">
          <Link to="/purchases" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-2")}><ArrowLeft className="size-4" /> 返回采购列表</Link>
          <h2 className="text-2xl font-bold">新建采购单</h2>
        </div>

        <Form method="post" className="space-y-6">
          <input type="hidden" name="items" value={JSON.stringify(items)} />

          {actionData?.error && (
            <Alert variant="destructive"><AlertCircle className="size-4" /><AlertDescription>{actionData.error}</AlertDescription></Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShoppingCart className="size-4" /> 采购信息
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="supplierId">供应商</Label>
                <Select name="supplierId" required>
                  <SelectTrigger className="w-full"><SelectValue placeholder="请选择供应商" /></SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="remark">备注</Label>
                <Textarea name="remark" rows={2} placeholder="采购备注（可选）" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">采购明细</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3 mb-4 items-end">
                <div className="flex-1">
                  <Label className="text-xs">商品</Label>
                  <Select value={selectedProduct} onValueChange={(val) => {
                    setSelectedProduct(val ?? "");
                    const p = products.find((pr) => pr.id === Number(val));
                    if (p) setUnitPrice(String(Number(p.price)));
                  }}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="选择商品" /></SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.name}（¥{Number(p.price).toFixed(2)}/{p.unit}）</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-24">
                  <Label className="text-xs">数量</Label>
                  <Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
                </div>
                <div className="w-32">
                  <Label className="text-xs">单价</Label>
                  <Input type="number" step="0.01" min="0" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
                </div>
                <Button type="button" variant="outline" onClick={addItem}>
                  <Plus className="size-4" /> 添加
                </Button>
              </div>

              {items.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>商品</TableHead>
                      <TableHead className="text-right">数量</TableHead>
                      <TableHead className="text-right">单价</TableHead>
                      <TableHead className="text-right">小计</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, index) => {
                      const product = products.find((p) => p.id === item.productId);
                      return (
                        <TableRow key={index}>
                          <TableCell>{product?.name}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">¥{item.unitPrice.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-medium">¥{(item.quantity * item.unitPrice).toFixed(2)}</TableCell>
                          <TableCell className="text-right">
                            <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(index)}>
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">暂无采购明细，请添加商品</div>
              )}

              <div className="text-right mt-4 text-lg font-bold">
                合计：¥{totalAmount.toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button type="submit" disabled={isSubmitting || items.length === 0}>
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
              {isSubmitting ? "提交中..." : "提交采购单"}
            </Button>
            <Link to="/purchases" className={cn(buttonVariants({ variant: "outline" }))}>取消</Link>
          </div>
        </Form>
      </div>
    </AppLayout>
  );
}
