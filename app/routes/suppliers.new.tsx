import { Form, redirect, useActionData, useNavigation, Link, useLoaderData } from "react-router";
import type { Route } from "./+types/suppliers.new";
import { requireRole } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { AppLayout } from "~/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button, buttonVariants } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { ArrowLeft, Loader2, AlertCircle, Truck } from "lucide-react";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireRole(request, ["admin", "purchaser"]);
  return { user };
}

export async function action({ request }: Route.ActionArgs) {
  await requireRole(request, ["admin", "purchaser"]);
  const formData = await request.formData();
  const name = formData.get("name") as string;
  const contact = formData.get("contact") as string;
  const phone = formData.get("phone") as string;
  const address = formData.get("address") as string;

  if (!name || !contact || !phone) return { error: "必填字段不能为空" };

  await db.supplier.create({ data: { name, contact, phone, address } });
  throw redirect("/suppliers");
}

export default function NewSupplierPage() {
  const { user } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <AppLayout user={user}>
      <div className="max-w-lg animate-fade-in">
        <div className="mb-6">
          <Link to="/suppliers" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-2")}><ArrowLeft className="size-4" /> 返回供应商列表</Link>
          <h2 className="text-2xl font-bold">新增供应商</h2>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Truck className="size-4" /> 添加新供应商
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form method="post" className="space-y-4">
              {actionData?.error && (
                <Alert variant="destructive"><AlertCircle className="size-4" /><AlertDescription>{actionData.error}</AlertDescription></Alert>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="name">供应商名称</Label>
                <Input id="name" name="name" required placeholder="请输入供应商名称" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="contact">联系人</Label>
                  <Input id="contact" name="contact" required placeholder="联系人姓名" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">电话</Label>
                  <Input id="phone" name="phone" required placeholder="联系电话" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="address">地址</Label>
                <Input id="address" name="address" placeholder="供应商地址（可选）" />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
                  {isSubmitting ? "提交中..." : "创建"}
                </Button>
                <Link to="/suppliers" className={cn(buttonVariants({ variant: "outline" }))}>取消</Link>
              </div>
            </Form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
