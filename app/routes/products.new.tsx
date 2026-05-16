import { Form, useActionData, useNavigation, Link, useLoaderData } from "react-router";
import type { Route } from "./+types/products.new";
import { requireRole } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { AppLayout } from "~/components/layout/app-layout";
import { Button, buttonVariants } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Loader2, AlertCircle, PackagePlus } from "lucide-react";
import { FormPage } from "~/components/ui/form-page";
import { FormSection } from "~/components/ui/form-section";
import { flashRedirect } from "~/lib/flash.server";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireRole(request, ["admin"]);
  const { loadRoutePermissions } = await import("~/lib/permissions.server");
  const routePermissions = await loadRoutePermissions();
  const categories = await db.category.findMany({ orderBy: { name: "asc" } });
  return { user, categories, routePermissions };
}

export async function action({ request }: Route.ActionArgs) {
  await requireRole(request, ["admin"]);
  const formData = await request.formData();
  const name = formData.get("name") as string;
  const categoryId = Number(formData.get("categoryId"));
  const price = Number(formData.get("price"));
  const unit = formData.get("unit") as string;
  const description = formData.get("description") as string;

  if (!name || !categoryId || !price || !unit) {
    return { error: "必填字段不能为空" };
  }
  if (!formData.get("shelfLifeDays") || !formData.get("productionDate")) {
    return { error: "保质期和生产日期为必填项" };
  }

  const product = await db.product.create({
    data: {
      name, categoryId, price, unit, description,
      shelfLifeDays: formData.get("shelfLifeDays") ? Number(formData.get("shelfLifeDays")) : null,
      productionDate: formData.get("productionDate") ? new Date(formData.get("productionDate") as string) : null,
    },
  });

  await db.inventory.create({ data: { productId: product.id, quantity: 0 } });

  throw flashRedirect("/products", { type: "success", message: "商品创建成功" });
}

export default function NewProductPage() {
  const { user, categories, routePermissions } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <AppLayout user={user} routePermissions={routePermissions}>
      <FormPage
        icon={PackagePlus}
        title="新增商品"
        subtitle="添加新商品到系统"
        actions={
          <>
            <Button type="submit" form="product-form" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
              {isSubmitting ? "创建中..." : "创建商品"}
            </Button>
            <Link to="/products" className={cn(buttonVariants({ variant: "outline" }))}>取消</Link>
          </>
        }
      >
        <Form id="product-form" method="post" className="space-y-6">
          {actionData?.error && (
            <Alert variant="destructive" className="py-2"><AlertCircle className="size-4" /><AlertDescription>{actionData.error}</AlertDescription></Alert>
          )}

          <FormSection icon={PackagePlus} title="商品信息">
            <div className="space-y-2">
              <Label htmlFor="name">商品名称</Label>
              <Input id="name" name="name" required placeholder="请输入商品名称" />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="categoryId">分类</Label>
                <Select name="categoryId" required>
                  <SelectTrigger className="w-full"><SelectValue placeholder="选择分类" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (<SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">单价（元）</Label>
                <Input id="price" name="price" type="number" step="0.01" min="0" required placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">单位</Label>
                <Input id="unit" name="unit" required placeholder="个/箱/瓶" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="shelfLifeDays">保质期（天）<span className="text-red-500">*</span></Label>
                <Input id="shelfLifeDays" name="shelfLifeDays" type="number" min="1" required placeholder="如 365" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="productionDate">生产日期<span className="text-red-500">*</span></Label>
                <Input id="productionDate" name="productionDate" type="date" required className="h-10" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">描述 <span className="text-muted-foreground font-normal">(可选)</span></Label>
              <Textarea id="description" name="description" rows={2} placeholder="商品描述" className="text-sm" />
            </div>
          </FormSection>
        </Form>
      </FormPage>
    </AppLayout>
  );
}
