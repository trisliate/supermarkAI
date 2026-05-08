import { Form, redirect, useActionData, useNavigation, Link, useLoaderData } from "react-router";
import type { Route } from "./+types/products.new";
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
import { ArrowLeft, Loader2, AlertCircle, PackagePlus } from "lucide-react";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireRole(request, ["admin"]);
  const categories = await db.category.findMany({ orderBy: { name: "asc" } });
  return { user, categories };
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

  const product = await db.product.create({
    data: { name, categoryId, price, unit, description },
  });

  await db.inventory.create({ data: { productId: product.id, quantity: 0 } });

  throw redirect("/products");
}

export default function NewProductPage() {
  const { user, categories } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <AppLayout user={user}>
      <div className="max-w-lg animate-fade-in">
        <div className="mb-6">
          <Link to="/products" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-2")}><ArrowLeft className="size-4" /> 返回商品列表</Link>
          <h2 className="text-2xl font-bold">新增商品</h2>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PackagePlus className="size-4" /> 添加新商品
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form method="post" className="space-y-4">
              {actionData?.error && (
                <Alert variant="destructive"><AlertCircle className="size-4" /><AlertDescription>{actionData.error}</AlertDescription></Alert>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="name">商品名称</Label>
                <Input id="name" name="name" required placeholder="请输入商品名称" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="categoryId">分类</Label>
                <Select name="categoryId" required>
                  <SelectTrigger className="w-full"><SelectValue placeholder="请选择分类" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (<SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="price">单价（元）</Label>
                  <Input id="price" name="price" type="number" step="0.01" min="0" required placeholder="0.00" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="unit">单位</Label>
                  <Input id="unit" name="unit" required placeholder="个/箱/瓶/袋" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="description">描述</Label>
                <Textarea id="description" name="description" rows={3} placeholder="商品描述（可选）" />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
                  {isSubmitting ? "提交中..." : "创建"}
                </Button>
                <Link to="/products" className={cn(buttonVariants({ variant: "outline" }))}>取消</Link>
              </div>
            </Form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
