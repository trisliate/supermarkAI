import { Form, useNavigation, Link, useActionData } from "react-router";
import { useState, useMemo } from "react";
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
import { Loader2, AlertCircle, Plus, Minus, Trash2, ShoppingCart, Package, ArrowLeftRight } from "lucide-react";
import { flashRedirect } from "~/lib/flash.server";
import { useLoaderData } from "react-router";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireRole(request, ["admin", "purchaser"]);
  const [suppliers, products, supplierProducts] = await Promise.all([
    db.supplier.findMany({ where: { status: "active" }, orderBy: { name: "asc" } }),
    db.product.findMany({ where: { status: "active" }, orderBy: { name: "asc" } }),
    db.supplierProduct.findMany({ include: { product: { select: { id: true, name: true, price: true, unit: true } } } }),
  ]);

  const serializedProducts = products.map((p) => ({ ...p, price: Number(p.price) }));

  // Build supplier -> products map
  const supplierProductMap = new Map<number, Array<{ id: number; name: string; price: number; unit: string }>>();
  for (const sp of supplierProducts) {
    const list = supplierProductMap.get(sp.supplierId) || [];
    list.push({ ...sp.product, price: Number(sp.product.price) });
    supplierProductMap.set(sp.supplierId, list);
  }

  // Build product -> suppliers map
  const productSupplierMap = new Map<number, Array<{ id: number; name: string; price: number }>>();
  for (const sp of supplierProducts) {
    const list = productSupplierMap.get(sp.productId) || [];
    const supplier = suppliers.find((s) => s.id === sp.supplierId);
    if (supplier) {
      list.push({ id: sp.supplierId, name: supplier.name, price: Number(sp.price ?? sp.product.price) });
    }
    productSupplierMap.set(sp.productId, list);
  }

  return {
    user, suppliers, products: serializedProducts,
    supplierProductMap: Object.fromEntries(supplierProductMap),
    productSupplierMap: Object.fromEntries(productSupplierMap),
  };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireRole(request, ["admin", "purchaser"]);
  const formData = await request.formData();
  const supplierId = Number(formData.get("supplierId"));
  const remark = formData.get("remark") as string;

  const itemsJson = formData.get("items") as string;
  const items: { productId: number; quantity: number; unitPrice: number; batchNo?: string; productionDate?: string; expiryDate?: string }[] = JSON.parse(itemsJson);

  if (!supplierId || items.length === 0) {
    return { error: "请选择供应商并添加至少一项商品" };
  }

  // Validate that all products are linked to the selected supplier
  const supplierProducts = await db.supplierProduct.findMany({
    where: { supplierId, productId: { in: items.map((i) => i.productId) } },
    select: { productId: true },
  });
  const linkedIds = new Set(supplierProducts.map((sp) => sp.productId));
  const unlinked = items.filter((i) => !linkedIds.has(i.productId));
  if (unlinked.length > 0) {
    return { error: "部分商品未关联到所选供应商，请检查采购清单" };
  }

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
          batchNo: item.batchNo || null,
          productionDate: item.productionDate ? new Date(item.productionDate) : null,
          expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
        })),
      },
    },
  });

  throw flashRedirect("/purchases", { type: "success", message: "采购单创建成功" });
}

interface OrderItem {
  productId: number;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  batchNo: string;
  productionDate: string;
  expiryDate: string;
}

export default function NewPurchasePage() {
  const { user, suppliers, products, supplierProductMap, productSupplierMap } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [mode, setMode] = useState<"supplier" | "product">("supplier");
  const [supplierId, setSupplierId] = useState("");
  const [remark, setRemark] = useState("");
  const [items, setItems] = useState<OrderItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState("");
  const [selectedProductSupplier, setSelectedProductSupplier] = useState("");
  const [batchNo, setBatchNo] = useState("");
  const [productionDate, setProductionDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");

  // Filter products by selected supplier (supplier-first mode)
  const availableProducts = useMemo(() => {
    if (!supplierId) return products;
    const supplierProds = supplierProductMap[Number(supplierId)];
    if (!supplierProds || supplierProds.length === 0) return [];
    return supplierProds;
  }, [supplierId, products, supplierProductMap]);

  // Get suppliers for selected product (product-first mode)
  const productSuppliers = useMemo(() => {
    if (!selectedProduct) return [];
    return productSupplierMap[Number(selectedProduct)] || [];
  }, [selectedProduct, productSupplierMap]);

  const addItem = () => {
    const pid = Number(selectedProduct);
    const price = Number(unitPrice);
    if (!pid || quantity <= 0 || !unitPrice || !isFinite(price) || price <= 0) return;

    // In product-first mode, auto-set supplier
    if (mode === "product" && selectedProductSupplier && !supplierId) {
      setSupplierId(selectedProductSupplier);
    }

    const product = mode === "supplier"
      ? availableProducts.find((p) => p.id === pid)
      : products.find((p) => p.id === pid);
    if (!product) return;
    if (items.some((i) => i.productId === pid)) return;
    setItems([...items, { productId: pid, name: product.name, unit: product.unit, quantity, unitPrice: price, batchNo, productionDate, expiryDate }]);
    setSelectedProduct("");
    setQuantity(1);
    setUnitPrice("");
    setSelectedProductSupplier("");
    setBatchNo("");
    setProductionDate("");
    setExpiryDate("");
  };

  const updateItemQty = (index: number, delta: number) => {
    setItems(items.map((item, i) => {
      if (i !== index) return item;
      const newQty = item.quantity + delta;
      return newQty > 0 ? { ...item, quantity: newQty } : item;
    }));
  };

  const updateItemPrice = (index: number, price: number) => {
    if (!isFinite(price) || price < 0) return;
    setItems(items.map((item, i) => i === index ? { ...item, unitPrice: price } : item));
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  return (
    <AppLayout
      user={user}
      description="选择供应商并添加采购商品"
    >
    <div className="animate-fade-in">
      <div className="flex justify-end mb-4">
        <Link to="/purchases" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          返回列表
        </Link>
      </div>
      {actionData?.error && (
        <Alert variant="destructive" className="py-2 mb-4">
          <AlertCircle className="size-4" />
          <AlertDescription>{actionData.error}</AlertDescription>
        </Alert>
      )}

      {/* Mode toggle + Remark */}
      <div className="bg-gradient-to-br from-white to-slate-50/80 dark:from-slate-900 dark:to-slate-900/80 rounded-xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => { setMode("supplier"); setSelectedProduct(""); setSelectedProductSupplier(""); }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${mode === "supplier" ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
            >
              按供应商选
            </button>
            <button
              type="button"
              onClick={() => { setMode("product"); setSupplierId(""); setSelectedProduct(""); setSelectedProductSupplier(""); }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${mode === "product" ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
            >
              按商品选
            </button>
          </div>
          <div className="w-48">
            <Input value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="备注（可选）" className="h-8 text-xs" />
          </div>
        </div>

        {/* Supplier-first mode */}
        {mode === "supplier" && (
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-600 dark:text-slate-300">供应商</Label>
            <Select value={supplierId} onValueChange={(v) => { setSupplierId(v ?? ""); setSelectedProduct(""); }}>
              <SelectTrigger className="w-full"><SelectValue placeholder="选择供应商" /></SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {supplierId && supplierProductMap[Number(supplierId)] && (
              <p className="text-[10px] text-slate-400">该供应商关联 {supplierProductMap[Number(supplierId)].length} 个商品</p>
            )}
          </div>
        )}

        {/* Product-first mode */}
        {mode === "product" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600 dark:text-slate-300">商品</Label>
              <SearchableSelect
                options={products
                  .filter((p) => !items.some((i) => i.productId === p.id))
                  .map((p) => ({
                    value: String(p.id),
                    label: `${p.name}（¥${formatPrice(p.price)}/${p.unit}）`,
                  }))}
                value={selectedProduct}
                onValueChange={(val) => { setSelectedProduct(val); setSelectedProductSupplier(""); setUnitPrice(""); }}
                placeholder="搜索商品..."
                searchPlaceholder="输入商品名称搜索"
                emptyText="无匹配商品"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                供应商{productSuppliers.length > 0 ? `（${productSuppliers.length} 家可供）` : ""}
              </Label>
              {selectedProduct ? (
                productSuppliers.length > 0 ? (
                  <Select value={selectedProductSupplier} onValueChange={(v) => {
                    setSelectedProductSupplier(v ?? "");
                    const sp = productSuppliers.find((s) => s.id === Number(v));
                    if (sp) setUnitPrice(String(sp.price));
                  }}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="选择供应商" /></SelectTrigger>
                    <SelectContent>
                      {productSuppliers.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>{s.name}（¥{formatPrice(s.price)}）</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-xs text-amber-500 py-2">该商品没有关联供应商，请先在商品管理中设置</p>
                )
              ) : (
                <p className="text-xs text-slate-400 py-2">请先选择商品</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add product row (supplier-first mode) */}
      {mode === "supplier" && (
        <div className="bg-gradient-to-br from-white to-slate-50/80 dark:from-slate-900 dark:to-slate-900/80 rounded-xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm p-4 mb-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs font-medium text-slate-600 dark:text-slate-300">商品</Label>
              <SearchableSelect
                options={availableProducts
                  .filter((p) => !items.some((i) => i.productId === p.id))
                  .map((p) => ({
                    value: String(p.id),
                    label: `${p.name}（¥${formatPrice(p.price)}/${p.unit}）`,
                  }))}
                value={selectedProduct}
                onValueChange={(val) => {
                  setSelectedProduct(val);
                  const p = availableProducts.find((pr) => pr.id === Number(val));
                  if (p) setUnitPrice(String(p.price));
                }}
                placeholder={supplierId ? "搜索该供应商的商品..." : "搜索商品..."}
                searchPlaceholder="输入商品名称搜索"
                emptyText="无匹配商品"
              />
            </div>
            <div className="w-24">
              <Label className="text-xs font-medium text-slate-600 dark:text-slate-300">数量</Label>
              <Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
            </div>
            <div className="w-32">
              <Label className="text-xs font-medium text-slate-600 dark:text-slate-300">单价</Label>
              <Input type="number" step="0.01" min="0" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
            </div>
            <Button type="button" onClick={addItem} disabled={!selectedProduct} className="h-9">
              <Plus className="size-4" /> 加入
            </Button>
          </div>
          <div className="flex flex-wrap gap-3 items-end mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="w-36">
              <Label className="text-xs font-medium text-slate-600 dark:text-slate-300">批次号</Label>
              <Input value={batchNo} onChange={(e) => setBatchNo(e.target.value)} placeholder="可选" className="h-8 text-xs" />
            </div>
            <div className="w-40">
              <Label className="text-xs font-medium text-slate-600 dark:text-slate-300">生产日期</Label>
              <Input type="date" value={productionDate} onChange={(e) => setProductionDate(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="w-40">
              <Label className="text-xs font-medium text-slate-600 dark:text-slate-300">保质期至</Label>
              <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="h-8 text-xs" />
            </div>
          </div>
        </div>
      )}

      {/* Add product row (product-first mode) */}
      {mode === "product" && selectedProduct && selectedProductSupplier && (
        <div className="bg-gradient-to-br from-white to-slate-50/80 dark:from-slate-900 dark:to-slate-900/80 rounded-xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm p-4 mb-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[120px]">
              <Label className="text-xs font-medium text-slate-600 dark:text-slate-300">数量</Label>
              <Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
            </div>
            <div className="w-32">
              <Label className="text-xs font-medium text-slate-600 dark:text-slate-300">单价</Label>
              <Input type="number" step="0.01" min="0" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
            </div>
            <Button type="button" onClick={addItem} className="h-9">
              <Plus className="size-4" /> 加入
            </Button>
          </div>
          <div className="flex flex-wrap gap-3 items-end mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="w-36">
              <Label className="text-xs font-medium text-slate-600 dark:text-slate-300">批次号</Label>
              <Input value={batchNo} onChange={(e) => setBatchNo(e.target.value)} placeholder="可选" className="h-8 text-xs" />
            </div>
            <div className="w-40">
              <Label className="text-xs font-medium text-slate-600 dark:text-slate-300">生产日期</Label>
              <Input type="date" value={productionDate} onChange={(e) => setProductionDate(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="w-40">
              <Label className="text-xs font-medium text-slate-600 dark:text-slate-300">保质期至</Label>
              <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="h-8 text-xs" />
            </div>
          </div>
        </div>
      )}

      {/* Items table */}
      <div className="bg-gradient-to-br from-white to-slate-50/80 dark:from-slate-900 dark:to-slate-900/80 rounded-xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">采购明细</span>
          {items.length > 0 && <span className="text-xs text-slate-400">{items.length} 项</span>}
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <Package className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">暂无采购商品</p>
            <p className="text-xs mt-1">从上方搜索并添加商品</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-500 text-xs w-12">#</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-500 text-xs">商品</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-500 text-xs w-28">批次号</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-500 text-xs w-28">生产日期</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-500 text-xs w-28">保质期至</th>
                  <th className="text-center px-4 py-2.5 font-medium text-slate-500 text-xs w-32">数量</th>
                  <th className="text-right px-4 py-2.5 font-medium text-slate-500 text-xs w-32">单价</th>
                  <th className="text-right px-4 py-2.5 font-medium text-slate-500 text-xs w-32">小计</th>
                  <th className="w-12 px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {items.map((item, index) => (
                  <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-2.5 text-slate-400 text-xs">{index + 1}</td>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-slate-800 dark:text-slate-200">{item.name}</p>
                      <p className="text-[10px] text-slate-400">{item.unit}</p>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{item.batchNo || "-"}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{item.productionDate || "-"}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{item.expiryDate || "-"}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => updateItemQty(index, -1)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                          <Minus className="size-3" />
                        </button>
                        <span className="w-10 text-center font-semibold text-slate-800 dark:text-slate-200 tabular-nums">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateItemQty(index, 1)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                          <Plus className="size-3" />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.unitPrice}
                        onChange={(e) => updateItemPrice(index, Number(e.target.value))}
                        className="h-8 text-right text-xs w-24 ml-auto"
                      />
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                      ¥{formatPrice(item.quantity * item.unitPrice)}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Total + Submit */}
        {items.length > 0 && (
          <div className="px-4 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-baseline gap-2">
              <span className="text-sm text-slate-500">合计</span>
              <span className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">¥{formatPrice(totalAmount)}</span>
            </div>
            <Form method="post">
              <input type="hidden" name="supplierId" value={supplierId} />
              <input type="hidden" name="remark" value={remark} />
              <input type="hidden" name="items" value={JSON.stringify(items.map((c) => ({ productId: c.productId, quantity: c.quantity, unitPrice: c.unitPrice, batchNo: c.batchNo, productionDate: c.productionDate, expiryDate: c.expiryDate })))} />
              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={isSubmitting || items.length === 0 || !supplierId}
                  className="h-10 px-6"
                >
                  {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <ShoppingCart className="size-4" />}
                  {isSubmitting ? "提交中..." : "提交采购单"}
                </Button>
              </div>
            </Form>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fade-in 0.4s ease-out both; }
      ` }} />
    </div>
    </AppLayout>
  );
}
