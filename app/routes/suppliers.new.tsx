import { Form, useActionData, useNavigation, Link, useLoaderData } from "react-router";
import type { Route } from "./+types/suppliers.new";
import { requireRole } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { AppLayout } from "~/components/layout/app-layout";
import { Button, buttonVariants } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Loader2, AlertCircle, Truck } from "lucide-react";
import { FormPage } from "~/components/ui/form-page";
import { FormSection } from "~/components/ui/form-section";
import { flashRedirect } from "~/lib/flash.server";

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
  throw flashRedirect("/suppliers", { type: "success", message: "供应商创建成功" });
}

export default function NewSupplierPage() {
  const { user } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <AppLayout user={user}>
      <FormPage
        icon={Truck}
        title="新增供应商"
        subtitle="添加新的供应商"
        actions={
          <>
            <Button type="submit" form="supplier-form" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
              {isSubmitting ? "创建中..." : "创建供应商"}
            </Button>
            <Link to="/suppliers" className={cn(buttonVariants({ variant: "outline" }))}>取消</Link>
          </>
        }
      >
        <Form id="supplier-form" method="post" className="space-y-6">
          {actionData?.error && (
            <Alert variant="destructive" className="py-2"><AlertCircle className="size-4" /><AlertDescription>{actionData.error}</AlertDescription></Alert>
          )}

          <FormSection icon={Truck} title="供应商信息">
            <div className="space-y-2">
              <Label htmlFor="name">供应商名称</Label>
              <Input id="name" name="name" required placeholder="请输入供应商名称" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact">联系人</Label>
                <Input id="contact" name="contact" required placeholder="联系人姓名" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">电话</Label>
                <Input id="phone" name="phone" required placeholder="联系电话" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">地址 <span className="text-muted-foreground font-normal">(可选)</span></Label>
              <Input id="address" name="address" placeholder="供应商地址" />
            </div>
          </FormSection>
        </Form>
      </FormPage>
    </AppLayout>
  );
}
