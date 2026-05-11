import { Form, useNavigation, Link, useLoaderData, useActionData } from "react-router";
import { useState } from "react";
import type { Route } from "./+types/purchases.new";
import { requireRole } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { AppLayout } from "~/components/layout/app-layout";
import { Button, buttonVariants } from "~/components/ui/button";
import { cn, formatPrice } from "~/lib/utils";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { SearchableSelect } from "~/components/ui/searchable-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Loader2, AlertCircle, Plus, Trash2, ShoppingCart } from "lucide-react";
import { FormPage } from "~/components/ui/form-page";
import { FormSection } from "~/components/ui/form-section";
import { flashRedirect } from "~/lib/flash.server";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireRole(request, ["admin", "purchaser"]);
  const [suppliers, products] = await Promise.all([
    db.supplier.findMany({ where: { status: "active" }, orderBy: { name: "asc" } }),
    db.product.findMany({ where: { status: "active" }, orderBy: { name: "asc" } }),
  ]);
  const serializedProducts = products.map((p) => ({ ...p, price: Number(p.price) }));
  return { user, suppliers, products: serializedProducts };
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

  // Fallback: ensure unitPrice is valid
  for (const item of items) {
    if (!item.unitPrice || !isFinite(item.unitPrice)) {
      const product = await db.product.findUnique({ where: { id: item.productId } });
      if (product) item.unitPrice = Number(product.price);
    }
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

  throw flashRedirect("/purchases", { type: "success", message: "采购单创建成功" });
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
    const price = Number(unitPrice);
    if (!pid || quantity <= 0 || !unitPrice || !isFinite(price) || price <= 0) return;
    setItems([...items, { productId: pid, quantity, unitPrice: price }]);
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
      <FormPage
        icon={ShoppingCart}
        title="新建采购单"
        subtitle="创建新的采购订单"
        className="max-w-4xl"
        actions={
          <>
            <Button type="submit" form="purchase-form" disabled={isSubmitting || items.length === 0}>
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
              {isSubmitting ? "提交中..." : "提交采购单"}
            </Button>
            <Link to="/purchases" className={cn(buttonVariants({ variant: "outline" }))}>取消</Link>
          </>
        }
      >
        <Form id="purchase-form" method="post" className="space-y-6">
          <input type="hidden" name="items" value={JSON.stringify(items)} />

          {actionData?.error && (
            <Alert variant="destructive" className="py-2"><AlertCircle className="size-4" /><AlertDescription>{actionData.error}</AlertDescription></Alert>
          )}

          <FormSection icon={ShoppingCart} title="采购信息">
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="supplierId">供应商</Label>
                <Select name="supplierId" required>
                  <SelectTrigger className="w-full"><SelectValue placeholder="选择供应商" /></SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="remark">备注</Label>
                <Input name="remark" placeholder="可选备注" />
              </div>
            </div>
          </FormSection>

          <FormSection title="采购明细" description={`${items.length} 项商品`}>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Label className="text-xs">商品</Label>
                <SearchableSelect
                  options={products.map((p) => ({
                    value: String(p.id),
                    label: `${p.name}（¥${formatPrice(Number(p.price))}/${p.unit}）`,
                  }))}
                  value={selectedProduct}
                  onValueChange={(val) => {
                    setSelectedProduct(val);
                    const p = products.find((pr) => pr.id === Number(val));
                    if (p) setUnitPrice(String(Number(p.price)));
                  }}
                  placeholder="选择商品"
                  searchPlaceholder="搜索商品..."
                  emptyText="无匹配商品"
                />
              </div>
              <div className="w-20">
                <Label className="text-xs">数量</Label>
                <Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
              </div>
              <div className="w-28">
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
                    <TableHead className="text-right w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => {
                    const product = products.find((p) => p.id === item.productId);
                    return (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{product?.name}</TableCell>
                        <TableCell className="text-right font-mono">{item.quantity}</TableCell>
                        <TableCell className="text-right font-mono">¥{formatPrice(item.unitPrice)}</TableCell>
                        <TableCell className="text-right font-mono font-semibold">¥{formatPrice(item.quantity * item.unitPrice)}</TableCell>
                        <TableCell className="text-right">
                          <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => removeItem(index)}>
                            <Trash2 className="size-3.5 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-6 text-muted-foreground text-sm">暂无明细，请添加商品</div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
              <span className="text-sm text-slate-500">合计</span>
              <span className="text-xl font-bold text-slate-900 dark:text-white">¥{formatPrice(totalAmount)}</span>
            </div>
          </FormSection>
        </Form>
      </FormPage>
    </AppLayout>
  );
}
