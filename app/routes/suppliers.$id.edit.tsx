import { Form, useNavigation, Link, useLoaderData } from "react-router";
import type { Route } from "./+types/suppliers.$id.edit";
import { requireRole } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { AppLayout } from "~/components/layout/app-layout";
import { Button, buttonVariants } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Loader2, Pencil } from "lucide-react";
import { FormPage } from "~/components/ui/form-page";
import { FormSection } from "~/components/ui/form-section";
import { flashRedirect } from "~/lib/flash.server";

export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireRole(request, ["admin", "purchaser"]);
  const { loadRoutePermissions } = await import("~/lib/permissions.server");
  const routePermissions = await loadRoutePermissions();
  const supplier = await db.supplier.findUnique({ where: { id: Number(params.id) } });
  if (!supplier) throw new Response("供应商不存在", { status: 404 });
  return { user, supplier, routePermissions };
}

export async function action({ request, params }: Route.ActionArgs) {
  await requireRole(request, ["admin", "purchaser"]);
  const formData = await request.formData();
  const name = formData.get("name") as string;
  const contact = formData.get("contact") as string;
  const phone = formData.get("phone") as string;
  const address = formData.get("address") as string;
  const status = formData.get("status") as "active" | "inactive";

  if (!name || !contact || !phone) {
    return { error: "必填字段不能为空" };
  }

  await db.supplier.update({
    where: { id: Number(params.id) },
    data: { name, contact, phone, address, status },
  });
  throw flashRedirect("/suppliers", { type: "success", message: "供应商已更新" });
}

export default function EditSupplierPage() {
  const { user, supplier, routePermissions } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <AppLayout user={user} routePermissions={routePermissions}>
      <FormPage
        icon={Pencil}
        title="编辑供应商"
        subtitle={`编辑 ${supplier.name} 的信息`}
        actions={
          <>
            <Button type="submit" form="supplier-form" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
              {isSubmitting ? "保存中..." : "保存"}
            </Button>
            <Link to="/suppliers" className={cn(buttonVariants({ variant: "outline" }))}>取消</Link>
          </>
        }
      >
        <Form id="supplier-form" method="post" className="space-y-6">
          <FormSection title="供应商信息">
            <div className="space-y-2">
              <Label htmlFor="name">供应商名称</Label>
              <Input id="name" name="name" defaultValue={supplier.name} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact">联系人</Label>
                <Input id="contact" name="contact" defaultValue={supplier.contact} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">电话</Label>
                <Input id="phone" name="phone" defaultValue={supplier.phone} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">地址</Label>
              <Input id="address" name="address" defaultValue={supplier.address || ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">状态</Label>
              <Select name="status" defaultValue={supplier.status}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">合作中</SelectItem>
                  <SelectItem value="inactive">已停用</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </FormSection>
        </Form>
      </FormPage>
    </AppLayout>
  );
}
