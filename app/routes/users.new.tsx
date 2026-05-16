import { Form, useActionData, useNavigation, Link } from "react-router";
import type { Route } from "./+types/users.new";
import { requireRole } from "~/lib/auth.server";
import { roleLabels } from "~/lib/auth";
import { db } from "~/lib/db.server";
import { AppLayout } from "~/components/layout/app-layout";
import { Button, buttonVariants } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Loader2, AlertCircle, UserPlus } from "lucide-react";
import { FormPage } from "~/components/ui/form-page";
import { FormSection } from "~/components/ui/form-section";
import { flashRedirect } from "~/lib/flash.server";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireRole(request, ["admin"]);
  const { loadRoutePermissions } = await import("~/lib/permissions.server");
  const routePermissions = await loadRoutePermissions();
  return { user, routePermissions };
}

export async function action({ request }: Route.ActionArgs) {
  await requireRole(request, ["admin"]);
  const formData = await request.formData();
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;
  const name = formData.get("name") as string;
  const role = formData.get("role") as Role;

  if (!username || !password || !name || !role) {
    return { error: "所有字段都必填" };
  }

  const exists = await db.user.findUnique({ where: { username } });
  if (exists) return { error: "用户名已存在" };

  const hashed = await bcrypt.hash(password, 10);
  await db.user.create({ data: { username, password: hashed, name, role } });

  throw flashRedirect("/users", { type: "success", message: "用户创建成功" });
}

export default function NewUserPage({ loaderData }: Route.ComponentProps) {
  const { user } = loaderData;
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <AppLayout user={user} routePermissions={loaderData.routePermissions}>
      <FormPage
        icon={UserPlus}
        title="新增用户"
        subtitle="创建新的系统用户"
        actions={
          <>
            <Button type="submit" form="user-form" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
              {isSubmitting ? "创建中..." : "创建用户"}
            </Button>
            <Link to="/users" className={cn(buttonVariants({ variant: "outline" }))}>取消</Link>
          </>
        }
      >
        <Form id="user-form" method="post" className="space-y-6">
          {actionData?.error && (
            <Alert variant="destructive" className="py-2"><AlertCircle className="size-4" /><AlertDescription>{actionData.error}</AlertDescription></Alert>
          )}

          <FormSection icon={UserPlus} title="用户信息">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="username">用户名</Label>
                <Input id="username" name="username" required placeholder="登录用户名" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">密码</Label>
                <Input id="password" name="password" type="password" required placeholder="登录密码" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">姓名</Label>
                <Input id="name" name="name" required placeholder="真实姓名" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">角色</Label>
                <Select name="role" required>
                  <SelectTrigger className="w-full"><SelectValue placeholder="选择角色" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(roleLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </FormSection>
        </Form>
      </FormPage>
    </AppLayout>
  );
}
