import { Form, useNavigation, Link, useLoaderData } from "react-router";
import type { Route } from "./+types/products.$id.edit";
import { requireRole } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { AppLayout } from "~/components/layout/app-layout";
import { Button, buttonVariants } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Loader2, Pencil } from "lucide-react";
import { FormPage } from "~/components/ui/form-page";
import { FormSection } from "~/components/ui/form-section";
import { flashRedirect } from "~/lib/flash.server";

export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireRole(request, ["admin"]);
  const { loadRoutePermissions } = await import("~/lib/permissions.server");
  const routePermissions = await loadRoutePermissions();
  const product = await db.product.findUnique({ where: { id: Number(params.id) } });
  if (!product) throw new Response("商品不存在", { status: 404 });
  const categories = await db.category.findMany({ orderBy: { name: "asc" } });
  const serializedProduct = { ...product, price: Number(product.price) };
  return { user, product: serializedProduct, categories, routePermissions };
}

export async function action({ request, params }: Route.ActionArgs) {
  await requireRole(request, ["admin"]);
  const formData = await request.formData();
  const name = formData.get("name") as string;
  const categoryId = Number(formData.get("categoryId"));
  const price = Number(formData.get("price"));
  const unit = formData.get("unit") as string;
  const description = formData.get("description") as string;
  const status = formData.get("status") as "active" | "inactive";

  if (!name || !categoryId || !price || !unit) {
    return { error: "必填字段不能为空" };
  }
  if (!formData.get("shelfLifeDays") || !formData.get("productionDate")) {
    return { error: "保质期和生产日期为必填项" };
  }

  await db.product.update({
    where: { id: Number(params.id) },
    data: {
      name, categoryId, price, unit, description, status,
      shelfLifeDays: formData.get("shelfLifeDays") ? Number(formData.get("shelfLifeDays")) : null,
      productionDate: formData.get("productionDate") ? new Date(formData.get("productionDate") as string) : null,
    },
  });

  throw flashRedirect("/products", { type: "success", message: "商品已更新" });
}

export default function EditProductPage() {
  const { user, product, categories, routePermissions } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <AppLayout user={user} routePermissions={routePermissions}>
      <FormPage
        icon={Pencil}
        title="编辑商品"
        subtitle={`编辑 ${product.name} 的信息`}
        actions={
          <>
            <Button type="submit" form="product-form" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
              {isSubmitting ? "保存中..." : "保存"}
            </Button>
            <Link to="/products" className={cn(buttonVariants({ variant: "outline" }))}>取消</Link>
          </>
        }
      >
        <Form id="product-form" method="post" className="space-y-6">
          <FormSection title="商品信息">
            <div className="space-y-2">
              <Label htmlFor="name">商品名称</Label>
              <Input id="name" name="name" defaultValue={product.name} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="categoryId">分类</Label>
              <Select name="categoryId" required defaultValue={String(product.categoryId)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (<SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">单价（元）</Label>
                <Input id="price" name="price" type="number" step="0.01" min="0" defaultValue={Number(product.price)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">单位</Label>
                <Input id="unit" name="unit" defaultValue={product.unit} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="shelfLifeDays">保质期（天）<span className="text-red-500">*</span></Label>
                <Input id="shelfLifeDays" name="shelfLifeDays" type="number" min="1" required defaultValue={product.shelfLifeDays ?? ""} placeholder="如 365" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="productionDate">生产日期<span className="text-red-500">*</span></Label>
                <Input id="productionDate" name="productionDate" type="date" required className="h-10" defaultValue={product.productionDate ? new Date(product.productionDate).toISOString().split("T")[0] : ""} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">描述</Label>
              <Textarea id="description" name="description" rows={3} defaultValue={product.description || ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">状态</Label>
              <Select name="status" defaultValue={product.status}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">上架</SelectItem>
                  <SelectItem value="inactive">下架</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </FormSection>
        </Form>
      </FormPage>
    </AppLayout>
  );
}
