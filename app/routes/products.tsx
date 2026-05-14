import { useFetcher, useNavigation } from "react-router";
import { useState, useEffect, useMemo } from "react";
import type { Route } from "./+types/products";
import { requireRole } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { AppLayout } from "~/components/layout/app-layout";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { cn, formatPrice } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { PageSkeleton } from "~/components/ui/page-skeleton";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "~/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { SearchableSelect } from "~/components/ui/searchable-select";
import { Plus, Pencil, Trash2, Package, Search, Loader2, Truck } from "lucide-react";
import { toast } from "sonner";
import { DataTablePagination } from "~/components/ui/data-table-pagination";
import { ImageUpload } from "~/components/ui/image-upload";

const PAGE_SIZE = 20;

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireRole(request, ["admin", "purchaser", "inventory_keeper"]);
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);

  const [products, total, categories, suppliers, supplierProducts] = await Promise.all([
    db.product.findMany({
      include: { category: true, inventory: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.product.count(),
    db.category.findMany({ orderBy: { name: "asc" } }),
    db.supplier.findMany({ where: { status: "active" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.supplierProduct.findMany({ select: { supplierId: true, productId: true } }),
  ]);
  const serializedProducts = products.map((p) => ({ ...p, price: Number(p.price), hasImage: !!p.image, image: undefined }));

  // Build productId -> supplierId[] map
  const bindingMap: Record<number, number[]> = {};
  for (const sp of supplierProducts) {
    if (!bindingMap[sp.productId]) bindingMap[sp.productId] = [];
    bindingMap[sp.productId].push(sp.supplierId);
  }

  return { user, products: serializedProducts, categories, suppliers, bindingMap, total, page, pageSize: PAGE_SIZE };
}

export async function action({ request }: Route.ActionArgs) {
  await requireRole(request, ["admin"]);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "delete") {
    const id = Number(formData.get("id"));
    await db.$transaction([
      db.inventoryLog.deleteMany({ where: { productId: id } }),
      db.inventory.deleteMany({ where: { productId: id } }),
      db.saleOrderItem.deleteMany({ where: { productId: id } }),
      db.purchaseOrderItem.deleteMany({ where: { productId: id } }),
      db.supplierProduct.deleteMany({ where: { productId: id } }),
      db.product.delete({ where: { id } }),
    ]);
    return { ok: true, intent: "delete" };
  }

  if (intent === "update") {
    const id = Number(formData.get("id"));
    const name = formData.get("name") as string;
    const categoryId = Number(formData.get("categoryId"));
    const price = Number(formData.get("price"));
    const unit = formData.get("unit") as string;
    const description = formData.get("description") as string;
    const status = formData.get("status") as "active" | "inactive";
    const shelfLifeDays = formData.get("shelfLifeDays") ? Number(formData.get("shelfLifeDays")) : null;
    const productionDate = formData.get("productionDate") ? new Date(formData.get("productionDate") as string) : null;
    const imageDataUrl = formData.get("image") as string | null;

    if (!name || !categoryId || !price || !unit) {
      return { error: "必填字段不能为空", intent: "update" };
    }

    const updateData: Record<string, unknown> = { name, categoryId, price, unit, description, status, shelfLifeDays, productionDate };
    if (imageDataUrl && imageDataUrl.startsWith("data:image")) {
      updateData.image = Buffer.from(imageDataUrl.split(",")[1], "base64");
    }
    if (formData.get("removeImage") === "true") {
      updateData.image = null;
    }

    await db.product.update({ where: { id }, data: updateData });
    return { ok: true, intent: "update" };
  }

  if (intent === "create") {
    const name = formData.get("name") as string;
    const categoryId = Number(formData.get("categoryId"));
    const price = Number(formData.get("price"));
    const unit = formData.get("unit") as string;
    const description = formData.get("description") as string;
    const shelfLifeDays = formData.get("shelfLifeDays") ? Number(formData.get("shelfLifeDays")) : null;
    const productionDate = formData.get("productionDate") ? new Date(formData.get("productionDate") as string) : null;
    const imageDataUrl = formData.get("image") as string | null;

    if (!name || !categoryId || !price || !unit) {
      return { error: "必填字段不能为空", intent: "create" };
    }

    const createData: Record<string, unknown> = { name, categoryId, price, unit, description, shelfLifeDays, productionDate };
    if (imageDataUrl && imageDataUrl.startsWith("data:image")) {
      createData.image = Buffer.from(imageDataUrl.split(",")[1], "base64");
    }

    const product = await db.product.create({ data: createData });
    await db.inventory.create({ data: { productId: product.id, quantity: 0 } });
    return { ok: true, intent: "create" };
  }

  if (intent === "update_bindings") {
    const productId = Number(formData.get("productId"));
    const supplierIdsStr = formData.get("supplierIds") as string;
    const supplierIds = supplierIdsStr ? supplierIdsStr.split(",").map(Number).filter(Boolean) : [];

    await db.$transaction([
      db.supplierProduct.deleteMany({ where: { productId } }),
      ...(supplierIds.length > 0
        ? [db.supplierProduct.createMany({ data: supplierIds.map((supplierId) => ({ supplierId, productId })), skipDuplicates: true })]
        : []),
    ]);
    return { ok: true, intent: "update_bindings" };
  }

  return { ok: false };
}

export default function ProductsPage({ loaderData }: Route.ComponentProps) {
  const { user, products, categories, suppliers, bindingMap, total, page, pageSize } = loaderData;
  const fetcher = useFetcher();
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editProduct, setEditProduct] = useState<typeof products[number] | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newCategoryId, setNewCategoryId] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [newImage, setNewImage] = useState<string | null>(null);
  const [editImage, setEditImage] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [bindingProduct, setBindingProduct] = useState<typeof products[number] | null>(null);
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<number[]>([]);
  const isDeleting = fetcher.state !== "idle";
  const isSaving = fetcher.state !== "idle";
  const navigation = useNavigation();
  const isLoading = navigation.state === "loading" && navigation.location?.pathname === "/products";

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      if (fetcher.data.intent === "delete" && fetcher.data.ok) {
        toast.success("商品已删除");
        setDeleteId(null);
      } else if (fetcher.data.intent === "update" && fetcher.data.ok) {
        toast.success("商品已更新");
        setEditProduct(null);
      } else if (fetcher.data.intent === "create" && fetcher.data.ok) {
        toast.success("商品创建成功");
        setShowNew(false);
        setNewCategoryId("");
      } else if (fetcher.data.intent === "update_bindings" && fetcher.data.ok) {
        toast.success("供应商绑定已更新");
        setBindingProduct(null);
      } else if (fetcher.data.error) {
        toast.error(fetcher.data.error);
      }
    }
  }, [fetcher.state, fetcher.data]);

  const categoryNames = useMemo(() => {
    return categories.map((c) => c.name);
  }, [categories]);

  const filtered = useMemo(() => {
    let list = products;
    if (category !== "all") list = list.filter((p) => p.category.name === category);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.category.name.toLowerCase().includes(q));
    }
    return list;
  }, [products, category, search]);

  return (
    <AppLayout
      user={user}
      description="管理商品信息和库存"
    >
      {isLoading ? <PageSkeleton columns={8} rows={6} /> : (
      <div className="space-y-8 animate-fade-in">
        <div className="flex items-center gap-3 flex-wrap">
          {user.role === "admin" && (
            <Button onClick={() => setShowNew(true)} size="sm" className="shrink-0">
              <Plus className="size-4" /> 新增商品
            </Button>
          )}
          <Tabs value={category} onValueChange={setCategory}>
            <TabsList className="h-9">
              <TabsTrigger value="all" className="text-xs">全部 ({products.length})</TabsTrigger>
              {categoryNames.map((cat) => (
                <TabsTrigger key={cat} value={cat} className="text-xs">
                  {cat} ({products.filter((p) => p.category.name === cat).length})
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="relative ml-auto w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder="搜索商品..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">ID</TableHead>
                  <TableHead>名称</TableHead>
                  <TableHead>分类</TableHead>
                  <TableHead>单价</TableHead>
                  <TableHead>单位</TableHead>
                  <TableHead>库存</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                      <Package className="size-8 mx-auto mb-2 opacity-50" />
                      {search ? "没有找到匹配的商品" : "暂无商品数据"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((p) => {
                    const stock = p.inventory?.quantity ?? 0;
                    const isLow = stock < 10;
                    const isOut = stock === 0;
                    return (
                      <TableRow key={p.id} className={isOut ? "bg-red-50/50 dark:bg-red-950/20" : isLow ? "bg-amber-50/30 dark:bg-amber-950/10" : ""}>
                        <TableCell className="font-mono text-muted-foreground text-xs">{p.id}</TableCell>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-normal text-xs">{p.category.name}</Badge>
                        </TableCell>
                        <TableCell className="font-mono">¥{formatPrice(Number(p.price))}</TableCell>
                        <TableCell className="text-muted-foreground">{p.unit}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                              <div
                                className={cn("h-full rounded-full transition-all", isOut ? "bg-red-500" : isLow ? "bg-amber-500" : "bg-emerald-500")}
                                style={{ width: `${Math.min(100, (stock / 100) * 100)}%` }}
                              />
                            </div>
                            <span className={cn("text-sm font-medium", isOut ? "text-red-600" : isLow ? "text-amber-600" : "text-slate-600 dark:text-slate-300")}>
                              {stock}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={p.status === "active" ? "default" : "secondary"} className="text-xs">
                            {p.status === "active" ? "上架" : "下架"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {user.role === "admin" ? (
                            <div className="flex items-center justify-end gap-0.5">
                              <Button variant="ghost" size="sm" className="h-7 px-2" title="管理供应商" onClick={() => { setBindingProduct(p); setSelectedSupplierIds(bindingMap[p.id] || []); }}>
                                <Truck className="size-3.5" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => { setEditProduct(p); setEditCategoryId(String(p.categoryId)); }}>
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-destructive hover:text-destructive"
                                onClick={() => setDeleteId(p.id)}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">只读</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <DataTablePagination totalPages={Math.ceil(total / pageSize)} currentPage={page} />
      </div>
      )}

      {/* New Product Dialog */}
      <Dialog open={showNew} onOpenChange={(open) => { if (!open) { setShowNew(false); setNewCategoryId(""); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="size-4" /> 新增商品
            </DialogTitle>
            <DialogDescription>添加新商品到系统</DialogDescription>
          </DialogHeader>
          <fetcher.Form method="post" className="space-y-4">
            <input type="hidden" name="intent" value="create" />
            <input type="hidden" name="image" value={newImage || ""} />
            <div className="space-y-1.5">
              <Label>商品图片 <span className="text-muted-foreground font-normal">(可选)</span></Label>
              <ImageUpload
                onUpload={(b64) => setNewImage(b64)}
                onRemove={() => setNewImage(null)}
                isSaving={isSaving}
                size="md"
                placeholder="上传商品图"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-name">商品名称</Label>
              <Input id="new-name" name="name" required placeholder="请输入商品名称" />
            </div>
            <div className="space-y-1.5">
              <Label>分类</Label>
              <SearchableSelect
                options={categories.map((c) => ({ value: String(c.id), label: c.name }))}
                value={newCategoryId}
                onValueChange={setNewCategoryId}
                placeholder="选择分类"
                searchPlaceholder="搜索分类..."
              />
              <input type="hidden" name="categoryId" value={newCategoryId} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="new-price">单价（元）</Label>
                <Input id="new-price" name="price" type="number" step="0.01" min="0" required placeholder="0.00" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-unit">单位</Label>
                <Input id="new-unit" name="unit" required placeholder="个/箱/瓶" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="new-shelfLifeDays">保质期（天）<span className="text-muted-foreground font-normal">(可选)</span></Label>
                <Input id="new-shelfLifeDays" name="shelfLifeDays" type="number" min="1" placeholder="如 365" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-productionDate">生产日期<span className="text-muted-foreground font-normal">(可选)</span></Label>
                <Input id="new-productionDate" name="productionDate" type="date" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-desc">描述 <span className="text-muted-foreground font-normal">(可选)</span></Label>
              <Textarea id="new-desc" name="description" rows={2} placeholder="商品描述" className="text-sm" />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
                {isSaving ? "创建中..." : "创建商品"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowNew(false)}>取消</Button>
            </div>
          </fetcher.Form>
        </DialogContent>
      </Dialog>

      {/* Edit Product Dialog */}
      <Dialog open={editProduct !== null} onOpenChange={(open) => { if (!open) setEditProduct(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="size-4" /> 编辑商品
            </DialogTitle>
            <DialogDescription>修改商品信息</DialogDescription>
          </DialogHeader>
          {editProduct && (
            <fetcher.Form method="post" className="space-y-4">
              <input type="hidden" name="intent" value="update" />
              <input type="hidden" name="id" value={editProduct.id} />
              <input type="hidden" name="image" value={editImage || ""} />
              <input type="hidden" name="removeImage" value={removeImage ? "true" : ""} />
              <div className="space-y-1.5">
                <Label>商品图片</Label>
                <ImageUpload
                  existingImageUrl={!removeImage && editProduct.hasImage ? `/api/product-image?productId=${editProduct.id}` : null}
                  onUpload={(b64) => { setEditImage(b64); setRemoveImage(false); }}
                  onRemove={() => { setEditImage(null); setRemoveImage(true); }}
                  isSaving={isSaving}
                  size="md"
                  placeholder="上传商品图"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-name">商品名称</Label>
                <Input id="edit-name" name="name" defaultValue={editProduct.name} required />
              </div>
              <div className="space-y-1.5">
                <Label>分类</Label>
                <SearchableSelect
                  options={categories.map((c) => ({ value: String(c.id), label: c.name }))}
                  value={editCategoryId}
                  onValueChange={setEditCategoryId}
                  placeholder="选择分类"
                  searchPlaceholder="搜索分类..."
                />
                <input type="hidden" name="categoryId" value={editCategoryId} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-price">单价（元）</Label>
                  <Input id="edit-price" name="price" type="number" step="0.01" min="0" defaultValue={Number(editProduct.price)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-unit">单位</Label>
                  <Input id="edit-unit" name="unit" defaultValue={editProduct.unit} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-shelfLifeDays">保质期（天）<span className="text-muted-foreground font-normal">(可选)</span></Label>
                  <Input id="edit-shelfLifeDays" name="shelfLifeDays" type="number" min="1" defaultValue={editProduct.shelfLifeDays ?? ""} placeholder="如 365" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-productionDate">生产日期<span className="text-muted-foreground font-normal">(可选)</span></Label>
                  <Input id="edit-productionDate" name="productionDate" type="date" defaultValue={editProduct.productionDate ? new Date(editProduct.productionDate).toISOString().split("T")[0] : ""} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-desc">描述</Label>
                <Textarea id="edit-desc" name="description" rows={3} defaultValue={editProduct.description || ""} />
              </div>
              <div className="space-y-1.5">
                <Label>状态</Label>
                <Select name="status" defaultValue={editProduct.status}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">上架</SelectItem>
                    <SelectItem value="inactive">下架</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
                  {isSaving ? "保存中..." : "保存"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setEditProduct(null)}>取消</Button>
              </div>
            </fetcher.Form>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => { if (!open) setDeleteId(null); }}
        title="删除商品"
        description="确定要删除该商品吗？此操作不可撤销。"
        confirmText="删除"
        loading={isDeleting}
        onConfirm={() => {
          if (deleteId === null) return;
          const fd = new FormData();
          fd.set("intent", "delete");
          fd.set("id", String(deleteId));
          fetcher.submit(fd, { method: "post" });
        }}
      />

      {/* Supplier Binding Dialog */}
      <Dialog open={bindingProduct !== null} onOpenChange={(open) => { if (!open) setBindingProduct(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="size-4" /> 管理供应商 - {bindingProduct?.name}
            </DialogTitle>
            <DialogDescription>选择供应该商品的供应商</DialogDescription>
          </DialogHeader>
          {bindingProduct && (
            <div className="space-y-3">
              <div className="max-h-[400px] overflow-y-auto space-y-0.5 border rounded-lg p-1">
                {suppliers.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedSupplierIds.includes(s.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedSupplierIds([...selectedSupplierIds, s.id]);
                        } else {
                          setSelectedSupplierIds(selectedSupplierIds.filter((id) => id !== s.id));
                        }
                      }}
                      className="rounded size-4"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-200">{s.name}</span>
                  </label>
                ))}
                {suppliers.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-4">暂无供应商</p>
                )}
              </div>
              <p className="text-[10px] text-slate-400">已选择 {selectedSupplierIds.length} 个供应商</p>
              <div className="flex gap-3 pt-1">
                <Button
                  size="sm"
                  disabled={isSaving}
                  onClick={() => {
                    const fd = new FormData();
                    fd.set("intent", "update_bindings");
                    fd.set("productId", String(bindingProduct.id));
                    fd.set("supplierIds", selectedSupplierIds.join(","));
                    fetcher.submit(fd, { method: "post" });
                  }}
                >
                  {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
                  保存绑定
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setBindingProduct(null)}>取消</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
