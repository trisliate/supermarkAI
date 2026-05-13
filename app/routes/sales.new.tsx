import { Form, useNavigation, useLoaderData, useActionData } from "react-router";
import { useState, useRef, useEffect } from "react";
import type { Route } from "./+types/sales.new";
import { requireRole } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { AppLayout } from "~/components/layout/app-layout";
import { Button } from "~/components/ui/button";
import { formatPrice } from "~/lib/utils";
import { Input } from "~/components/ui/input";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Loader2, AlertCircle, Search, Plus, Minus, Trash2, CreditCard, Package, ShoppingCart } from "lucide-react";
import { flashRedirect } from "~/lib/flash.server";

interface CartItem {
  productId: number;
  name: string;
  quantity: number;
  unitPrice: number;
  unit: string;
  maxQty: number;
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireRole(request, ["admin", "cashier"]);
  const products = await db.product.findMany({
    where: { status: "active" },
    include: { inventory: true },
    orderBy: { name: "asc" },
  });
  const available = products.filter((p) => p.inventory && p.inventory.quantity > 0);
  const serializedProducts = available.map((p) => ({ ...p, price: Number(p.price) }));
  return { user, products: serializedProducts };
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

  throw flashRedirect("/sales", { type: "success", message: "结算成功" });
}

export default function SalesNewPage() {
  const { user, products } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [qty, setQty] = useState(1);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Click outside to close search dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) || p.id.toString().includes(search)
  );

  const selectProduct = (product: typeof products[number]) => {
    setSelectedId(product.id);
    setSearch(product.name);
    setShowDropdown(false);
    setQty(1);
  };

  const addToCart = () => {
    if (!selectedId) return;
    const product = products.find((p) => p.id === selectedId);
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
    setSelectedId(null);
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
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <AppLayout user={user}>
      <div className="flex gap-6 h-[calc(100vh-7rem)] animate-fade-in">
        {/* Left: Product selection */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">收银台</h2>
              <p className="text-xs text-muted-foreground">选择商品加入购物车</p>
            </div>
          </div>

          {actionData?.error && (
            <Alert variant="destructive" className="py-2 mb-4">
              <AlertCircle className="size-4" />
              <AlertDescription>{actionData.error}</AlertDescription>
            </Alert>
          )}

          {/* Search + Add */}
          <div className="bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 p-4 mb-4">
            <div className="flex gap-3 items-end">
              <div className="flex-1" ref={searchRef}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setShowDropdown(true);
                      if (!e.target.value) setSelectedId(null);
                    }}
                    onFocus={() => setShowDropdown(true)}
                    placeholder="输入商品名称或 ID 搜索..."
                    className="pl-9"
                  />
                  {showDropdown && search && (
                    <div className="absolute z-20 w-full bg-popover border rounded-lg shadow-lg max-h-56 overflow-y-auto mt-1">
                      {filtered.length > 0 ? filtered.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => selectProduct(p)}
                          className={`w-full text-left px-3 py-2.5 hover:bg-accent text-sm flex justify-between items-center transition-colors ${
                            selectedId === p.id ? "bg-accent" : ""
                          }`}
                        >
                          <div>
                            <span className="font-medium">{p.name}</span>
                            <span className="text-muted-foreground ml-2 text-xs">#{p.id}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>¥{formatPrice(Number(p.price))}/{p.unit}</span>
                            <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">库存 {p.inventory?.quantity}</span>
                          </div>
                        </button>
                      )) : (
                        <div className="px-3 py-3 text-muted-foreground text-sm text-center">无匹配商品</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="w-20">
                <Input
                  type="number"
                  min="1"
                  value={qty}
                  onChange={(e) => setQty(Number(e.target.value))}
                  placeholder="数量"
                />
              </div>
              <Button onClick={addToCart} disabled={!selectedId} className="shrink-0">
                <Plus className="size-4" /> 加入
              </Button>
            </div>
          </div>

          {/* Product grid */}
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {products.map((p) => {
                const inCart = cart.find((c) => c.productId === p.id);
                const remaining = (p.inventory?.quantity ?? 0) - (inCart?.quantity ?? 0);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(p.id);
                      setSearch(p.name);
                      setQty(1);
                    }}
                    disabled={remaining <= 0}
                    className={`text-left p-3 rounded-xl border transition-all ${
                      selectedId === p.id
                        ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 hover:border-slate-300 dark:hover:border-slate-700"
                    } ${remaining <= 0 ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{p.name}</span>
                      {inCart && (
                        <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full shrink-0 ml-1">
                          {inCart.quantity}件
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-base font-bold text-slate-900 dark:text-white">
                        ¥{formatPrice(Number(p.price))}
                        <span className="text-[10px] font-normal text-muted-foreground">/{p.unit}</span>
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        remaining <= 5
                          ? "bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400"
                          : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                      }`}>
                        余{remaining}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
            {products.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">暂无可售商品</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Cart + Checkout */}
        <div className="w-80 shrink-0 flex flex-col">
          <div className="bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col h-full">
            {/* Cart header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">购物车</h3>
                {cart.length > 0 && (
                  <span className="text-xs text-muted-foreground">{totalItems} 件商品</span>
                )}
              </div>
            </div>

            {/* Cart items */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <ShoppingCart className="w-12 h-12 mb-3 opacity-30" />
                  <p className="text-sm">购物车为空</p>
                  <p className="text-xs mt-1">选择左侧商品加入购物车</p>
                </div>
              ) : cart.map((item) => (
                <div
                  key={item.productId}
                  className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">¥{formatPrice(item.unitPrice)}/{item.unit}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => updateQty(item.productId, item.quantity - 1)}
                      className="w-6 h-6 rounded flex items-center justify-center bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors"
                    >
                      <Minus className="size-3" />
                    </button>
                    <span className="w-7 text-center text-sm font-semibold">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => updateQty(item.productId, item.quantity + 1)}
                      disabled={item.quantity >= item.maxQty}
                      className="w-6 h-6 rounded flex items-center justify-center bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors disabled:opacity-40"
                    >
                      <Plus className="size-3" />
                    </button>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      ¥{formatPrice(item.quantity * item.unitPrice)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.productId)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="size-3.5 text-destructive" />
                  </button>
                </div>
              ))}
            </div>

            {/* Checkout */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">合计</span>
                <span className="text-2xl font-bold text-destructive">¥{formatPrice(total)}</span>
              </div>
              <Form method="post">
                <input type="hidden" name="items" value={JSON.stringify(cart.map((c) => ({ productId: c.productId, quantity: c.quantity, unitPrice: c.unitPrice })))} />
                <Button
                  type="submit"
                  disabled={isSubmitting || cart.length === 0}
                  className="w-full h-11 bg-green-600 hover:bg-green-700 text-base font-medium"
                >
                  {isSubmitting ? <Loader2 className="size-5 animate-spin" /> : <CreditCard className="size-5" />}
                  {isSubmitting ? "结算中..." : "结算"}
                </Button>
              </Form>
            </div>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.4s ease-out both;
        }
      ` }} />
    </AppLayout>
  );
}
