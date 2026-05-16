import { Form, useLoaderData, useActionData, useNavigate } from "react-router";
import { useState, useRef, useEffect } from "react";
import type { Route } from "./+types/sales.new";
import { requireRole } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { AppLayout } from "~/components/layout/app-layout";
import { Button } from "~/components/ui/button";
import { formatPrice } from "~/lib/utils";
import { Input } from "~/components/ui/input";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { AlertCircle, Search, Plus, Minus, Trash2, CreditCard, Package, ShoppingCart, Banknote, QrCode, CheckCircle } from "lucide-react";
import { flashRedirect } from "~/lib/flash.server";

interface CartItem {
  productId: number;
  name: string;
  quantity: number;
  unitPrice: number;
  unit: string;
  maxQty: number;
}

type PaymentMethod = "cash" | "wechat" | "alipay";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireRole(request, ["admin", "cashier"]);
  const { loadRoutePermissions } = await import("~/lib/permissions.server");
  const routePermissions = await loadRoutePermissions();

  const url = new URL(request.url);
  const categoryId = url.searchParams.get("category");

  const [topSelling, categories] = await Promise.all([
    db.saleOrderItem.groupBy({
      by: ["productId"],
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 50,
    }),
    db.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  const topIds = topSelling.map((s) => s.productId);
  const volumeMap: Record<number, number> = {};
  for (const sv of topSelling) {
    volumeMap[sv.productId] = sv._sum.quantity ?? 0;
  }

  const where: Record<string, unknown> = { status: "active" };
  if (categoryId) {
    where.categoryId = Number(categoryId);
  } else if (topIds.length > 0) {
    where.id = { in: topIds };
  }

  const products = await db.product.findMany({
    where,
    include: { inventory: true },
  });

  const available = products.filter((p) => p.inventory && p.inventory.quantity > 0);
  available.sort((a, b) => {
    const va = volumeMap[a.id] ?? 0;
    const vb = volumeMap[b.id] ?? 0;
    if (va !== vb) return vb - va;
    return a.name.localeCompare(b.name);
  });
  const serializedProducts = available.map((p) => ({ ...p, price: Number(p.price) }));
  return { user, products: serializedProducts, categories, salesVolume: volumeMap, currentCategory: categoryId ? Number(categoryId) : null, routePermissions };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireRole(request, ["admin", "cashier"]);
  const formData = await request.formData();
  const itemsJson = formData.get("items") as string;
  const items: { productId: number; quantity: number; unitPrice: number }[] = JSON.parse(itemsJson);

  if (items.length === 0) return { error: "请添加至少一件商品" };

  // Fetch real prices from database to prevent client-side tampering
  const productIds = items.map((i) => i.productId);
  const dbProducts = await db.product.findMany({
    where: { id: { in: productIds } },
    include: { inventory: true },
  });
  const priceMap: Record<number, number> = {};
  for (const p of dbProducts) priceMap[p.id] = Number(p.price);

  // Use database prices instead of client-provided prices
  const validatedItems = items.map((item) => ({
    ...item,
    unitPrice: priceMap[item.productId] ?? item.unitPrice,
  }));

  const totalAmount = validatedItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const paymentMethod = (formData.get("paymentMethod") as string) || "cash";
  const paidAmount = formData.get("paidAmount") ? Number(formData.get("paidAmount")) : null;
  const changeAmount = paidAmount ? paidAmount - totalAmount : null;

  if (paymentMethod === "cash" && paidAmount !== null && paidAmount < totalAmount) {
    return { error: "收款金额不足" };
  }

  try {
    await db.$transaction(async (tx) => {
      // Atomic inventory check + decrement inside transaction (prevents race condition)
      for (const item of validatedItems) {
        const result = await tx.$executeRaw`
          UPDATE Inventory SET quantity = quantity - ${item.quantity}
          WHERE productId = ${item.productId} AND quantity >= ${item.quantity}
        `;
        if (result === 0) {
          const product = dbProducts.find((p) => p.id === item.productId);
          throw new Error(`${product?.name ?? "商品"} 库存不足`);
        }
      }

      const sale = await tx.saleOrder.create({
        data: {
          userId: user.id,
          totalAmount,
          paymentMethod,
          paymentStatus: "paid",
          paidAmount,
          changeAmount: changeAmount !== null && changeAmount > 0 ? changeAmount : null,
          items: {
            create: validatedItems.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
            })),
          },
        },
      });

      for (const item of validatedItems) {
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

      return sale;
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("库存不足")) return { error: msg };
    throw e;
  }

  throw flashRedirect("/sales", { type: "success", message: "结算成功" });
}

export default function SalesNewPage() {
  const { user, products, categories, salesVolume, currentCategory, routePermissions } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [paidAmount, setPaidAmount] = useState("");
  const [showQrModal, setShowQrModal] = useState(false);
  const [searchResults, setSearchResults] = useState<typeof products>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!search.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/product-search?q=${encodeURIComponent(search)}&take=20`);
        const data = await res.json();
        setSearchResults(data.products || []);
      } catch {
        setSearchResults([]);
      }
      setIsSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const displayProducts = search.trim() ? searchResults : products;

  // Click product = directly add 1 to cart
  const addToCart = (product: { id: number; name: string; price: number | string; unit: string; inventory?: { quantity: number } | null }) => {
    const maxQty = product.inventory?.quantity ?? 0;
    const existing = cart.find((c) => c.productId === product.id);
    if (existing) {
      if (existing.quantity + 1 > maxQty) return;
      setCart(cart.map((c) => c.productId === product.id ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      if (maxQty <= 0) return;
      setCart([...cart, {
        productId: product.id,
        name: product.name,
        quantity: 1,
        unitPrice: Number(product.price),
        unit: product.unit,
        maxQty,
      }]);
    }
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
  const change = paidAmount ? Number(paidAmount) - total : 0;

  const paymentMethods: { id: PaymentMethod; label: string; icon: typeof Banknote; color: string; activeColor: string }[] = [
    { id: "cash", label: "现金", icon: Banknote, color: "border-slate-200 dark:border-slate-700", activeColor: "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400" },
    { id: "wechat", label: "微信支付", icon: QrCode, color: "border-slate-200 dark:border-slate-700", activeColor: "border-green-500 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400" },
    { id: "alipay", label: "支付宝", icon: CreditCard, color: "border-slate-200 dark:border-slate-700", activeColor: "border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400" },
  ];

  return (
    <AppLayout user={user} routePermissions={routePermissions}>
      <div className="flex gap-5 animate-fade-in" style={{ height: "calc(100vh - 7rem)" }}>
        {/* Left: Products */}
        <div className="flex-1 flex flex-col min-w-0">
          {(actionData && "error" in actionData && actionData.error) && (
            <Alert variant="destructive" className="py-2 mb-3">
              <AlertCircle className="size-4" />
              <AlertDescription>{actionData.error as string}</AlertDescription>
            </Alert>
          )}

          {/* Search */}
          <div className="relative mb-3" ref={searchRef}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setShowDropdown(true); }}
              onFocus={() => setShowDropdown(true)}
              placeholder="搜索商品名称或 ID..."
              className="pl-9 bg-white dark:bg-slate-900/50"
            />
            {showDropdown && search.trim() && (
              <div className="absolute z-20 w-full bg-popover border rounded-lg shadow-lg max-h-64 overflow-y-auto mt-1">
                {isSearching ? (
                  <div className="px-3 py-3 text-muted-foreground text-sm text-center">搜索中...</div>
                ) : searchResults.length > 0 ? searchResults.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { addToCart(p); setSearch(""); setShowDropdown(false); }}
                    className="w-full text-left px-3 py-2.5 hover:bg-accent text-sm flex justify-between items-center transition-colors"
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

          {/* Category filter */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
            <button
              type="button"
              onClick={() => navigate("/sales/new")}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                currentCategory === null
                  ? "bg-primary text-primary-foreground"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              全部
            </button>
            {categories.map((cat: { id: number; name: string }) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => navigate(`/sales/new?category=${cat.id}`)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  currentCategory === cat.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Product grid - click to add directly */}
          <div className="flex-1 overflow-y-auto mt-1 pt-2 pr-2">
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {displayProducts.map((p: { id: number; name: string; price: number; unit: string; categoryId: number; inventory: { quantity: number } | null }) => {
                const inCart = cart.find((c) => c.productId === p.id);
                const remaining = (p.inventory?.quantity ?? 0) - (inCart?.quantity ?? 0);
                const sold = salesVolume[p.id] ?? 0;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addToCart(p)}
                    disabled={remaining <= 0}
                    className={`text-left p-3 rounded-xl border transition-all relative ${
                      inCart
                        ? "border-primary bg-primary/5"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 hover:border-primary/50 hover:shadow-sm"
                    } ${remaining <= 0 ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    {sold >= 10 && (
                      <span className="absolute -top-1.5 -right-1.5 text-[9px] bg-orange-500 text-white px-1.5 py-0.5 rounded-full font-medium shadow-sm">
                        热销
                      </span>
                    )}
                    <div className="flex items-start justify-between mb-1">
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{p.name}</span>
                      {inCart && (
                        <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full shrink-0 ml-1 font-medium">
                          {inCart.quantity}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-base font-bold text-slate-900 dark:text-white">
                        ¥{formatPrice(p.price)}
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
            {displayProducts.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">{search ? "无匹配商品" : "暂无可售商品"}</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Cart + Checkout */}
        <div className="w-80 shrink-0 flex flex-col">
          <div className="bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col h-full">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <ShoppingCart className="size-4" />
                购物车
              </h3>
              {cart.length > 0 && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{totalItems}件</span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <ShoppingCart className="w-10 h-10 mb-2 opacity-30" />
                  <p className="text-sm">点击左侧商品添加</p>
                </div>
              ) : cart.map((item) => (
                <div
                  key={item.productId}
                  className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{item.name}</p>
                    <p className="text-[11px] text-muted-foreground">¥{formatPrice(item.unitPrice)}/{item.unit}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => updateQty(item.productId, item.quantity - 1)}
                      className="w-6 h-6 rounded flex items-center justify-center bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors"
                    >
                      <Minus className="size-3" />
                    </button>
                    <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => updateQty(item.productId, item.quantity + 1)}
                      disabled={item.quantity >= item.maxQty}
                      className="w-6 h-6 rounded flex items-center justify-center bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors disabled:opacity-40"
                    >
                      <Plus className="size-3" />
                    </button>
                  </div>
                  <span className="text-sm font-bold text-slate-900 dark:text-white w-16 text-right">
                    ¥{formatPrice(item.quantity * item.unitPrice)}
                  </span>
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

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">合计</span>
                <span className="text-2xl font-bold text-destructive">¥{formatPrice(total)}</span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {paymentMethods.map((pm) => {
                  const PmIcon = pm.icon;
                  const isActive = paymentMethod === pm.id;
                  return (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => setPaymentMethod(pm.id)}
                      className={`flex flex-col items-center gap-1 py-2 rounded-lg border-2 transition-all ${
                        isActive ? pm.activeColor : `${pm.color} hover:border-slate-300 dark:hover:border-slate-600`
                      }`}
                    >
                      <PmIcon className="size-4" />
                      <span className="text-[11px] font-medium">{pm.label}</span>
                    </button>
                  );
                })}
              </div>

              {paymentMethod === "cash" && total > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-10">收款</span>
                    <Input
                      type="number"
                      min={total}
                      step="0.01"
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(e.target.value)}
                      placeholder={`应付 ¥${formatPrice(total)}`}
                      className="h-9 text-sm"
                    />
                  </div>
                  {paidAmount && Number(paidAmount) >= total && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-10">找零</span>
                      <span className="text-lg font-bold text-emerald-600">¥{formatPrice(change)}</span>
                    </div>
                  )}
                </div>
              )}

              {(paymentMethod === "wechat" || paymentMethod === "alipay") && total > 0 && (
                <Button
                  type="button"
                  onClick={() => setShowQrModal(true)}
                  disabled={cart.length === 0}
                  className="w-full h-11 text-base font-medium"
                >
                  <QrCode className="size-5" />
                  扫码收款 ¥{formatPrice(total)}
                </Button>
              )}

              {paymentMethod === "cash" && (
                <Form method="post">
                  <input type="hidden" name="items" value={JSON.stringify(cart.map((c) => ({ productId: c.productId, quantity: c.quantity, unitPrice: c.unitPrice })))} />
                  <input type="hidden" name="paymentMethod" value="cash" />
                  {paidAmount && <input type="hidden" name="paidAmount" value={paidAmount} />}
                  <Button
                    type="submit"
                    disabled={cart.length === 0 || (!!paidAmount && Number(paidAmount) < total)}
                    className="w-full h-11 bg-green-600 hover:bg-green-700 text-base font-medium"
                  >
                    <CreditCard className="size-5" />
                    结算
                  </Button>
                </Form>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* QR Code Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 w-[380px] text-center relative">
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <Plus className="size-5 rotate-45" />
            </button>

            <h3 className="text-lg font-semibold mb-1">
              {paymentMethod === "wechat" ? "微信支付" : "支付宝"}
            </h3>
            <p className="text-2xl font-bold text-destructive mb-4">¥{formatPrice(total)}</p>

            <div className="w-52 h-52 mx-auto mb-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center bg-white dark:bg-slate-800 overflow-hidden">
              <img
                src={paymentMethod === "wechat" ? "/payments/wechat-qr.png" : "/payments/alipay-qr.png"}
                alt={paymentMethod === "wechat" ? "微信收款码" : "支付宝收款码"}
                className="w-full h-full object-contain"
                onError={(e) => {
                  const el = e.currentTarget;
                  el.style.display = "none";
                  const fallback = el.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = "flex";
                }}
              />
              <div className="hidden w-full h-full flex-col items-center justify-center p-4">
                <QrCode className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-2" />
                <p className="text-xs text-slate-400 text-center">
                  请在支付配置页面上传{paymentMethod === "wechat" ? "微信" : "支付宝"}收款码
                </p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground mb-4">
              请顾客扫码支付，确认到账后点击下方按钮
            </p>

            <Form method="post" className="space-y-2">
              <input type="hidden" name="items" value={JSON.stringify(cart.map((c) => ({ productId: c.productId, quantity: c.quantity, unitPrice: c.unitPrice })))} />
              <input type="hidden" name="paymentMethod" value={paymentMethod} />
              <Button
                type="submit"
                className="w-full h-11 bg-green-600 hover:bg-green-700 text-base font-medium"
              >
                <CheckCircle className="size-5" />
                确认收款
              </Button>
            </Form>

            <Button
              variant="ghost"
              onClick={() => setShowQrModal(false)}
              className="w-full mt-2 text-sm text-muted-foreground"
            >
              取消
            </Button>
          </div>
        </div>
      )}

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
