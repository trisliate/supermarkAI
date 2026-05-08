import { Form, redirect, useNavigation, Link, useLoaderData } from "react-router";
import type { Route } from "./+types/suppliers.$id.edit";
import { requireRole } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { AppLayout } from "~/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button, buttonVariants } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { ArrowLeft, Loader2, Pencil } from "lucide-react";

export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireRole(request, ["admin", "purchaser"]);
  const supplier = await db.supplier.findUnique({ where: { id: Number(params.id) } });
  if (!supplier) throw new Response("供应商不存在", { status: 404 });
  return { user, supplier };
}

export async function action({ request, params }: Route.ActionArgs) {
  await requireRole(request, ["admin", "purchaser"]);
  const formData = await request.formData();
  const name = formData.get("name") as string;
  const contact = formData.get("contact") as string;
  const phone = formData.get("phone") as string;
  const address = formData.get("address") as string;
  const status = formData.get("status") as "active" | "inactive";

  await db.supplier.update({
    where: { id: Number(params.id) },
    data: { name, contact, phone, address, status },
  });
  throw redirect("/suppliers");
}

export default function EditSupplierPage() {
  const { user, supplier } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <AppLayout user={user}>
      <div className="max-w-lg animate-fade-in">
        <div className="mb-6">
          <Link to="/suppliers" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-2")}><ArrowLeft className="size-4" /> 返回供应商列表</Link>
          <h2 className="text-2xl font-bold">编辑供应商</h2>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Pencil className="size-4" /> 编辑供应商信息
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form method="post" className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">供应商名称</Label>
                <Input id="name" name="name" defaultValue={supplier.name} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="contact">联系人</Label>
                  <Input id="contact" name="contact" defaultValue={supplier.contact} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">电话</Label>
                  <Input id="phone" name="phone" defaultValue={supplier.phone} required />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="address">地址</Label>
                <Input id="address" name="address" defaultValue={supplier.address || ""} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="status">状态</Label>
                <Select name="status" defaultValue={supplier.status}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">合作中</SelectItem>
                    <SelectItem value="inactive">已停用</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
                  {isSubmitting ? "保存中..." : "保存"}
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
