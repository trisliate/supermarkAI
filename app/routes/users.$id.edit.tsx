import { Form, useNavigation, Link } from "react-router";
import type { Route } from "./+types/users.$id.edit";
import { requireRole } from "~/lib/auth.server";
import { roleLabels } from "~/lib/auth";
import { db } from "~/lib/db.server";
import { AppLayout } from "~/components/layout/app-layout";
import { Button, buttonVariants } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Loader2, UserCog } from "lucide-react";
import { FormPage } from "~/components/ui/form-page";
import { FormSection } from "~/components/ui/form-section";
import { flashRedirect } from "~/lib/flash.server";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";

export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireRole(request, ["admin"]);
  const { loadRoutePermissions } = await import("~/lib/permissions.server");
  const routePermissions = await loadRoutePermissions();
  const editUser = await db.user.findUnique({ where: { id: Number(params.id) } });
  if (!editUser) throw new Response("用户不存在", { status: 404 });
  return { user, editUser, routePermissions };
}

export async function action({ request, params }: Route.ActionArgs) {
  await requireRole(request, ["admin"]);
  const formData = await request.formData();
  const name = formData.get("name") as string;
  const role = formData.get("role") as Role;
  const password = formData.get("password") as string;

  const data: { name: string; role: Role; password?: string } = { name, role };
  if (password) {
    data.password = await bcrypt.hash(password, 10);
  }

  await db.user.update({ where: { id: Number(params.id) }, data });
  throw flashRedirect("/users", { type: "success", message: "用户已更新" });
}

export default function EditUserPage({ loaderData }: Route.ComponentProps) {
  const { user, editUser } = loaderData;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <AppLayout user={user} routePermissions={loaderData.routePermissions}>
      <FormPage
        icon={UserCog}
        title="编辑用户"
        subtitle={`编辑 ${editUser.name} 的信息`}
        actions={
          <>
            <Button type="submit" form="user-form" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
              {isSubmitting ? "保存中..." : "保存"}
            </Button>
            <Link to="/users" className={cn(buttonVariants({ variant: "outline" }))}>取消</Link>
          </>
        }
      >
        <Form id="user-form" method="post" className="space-y-6">
          <FormSection title="用户信息">
            <div className="space-y-2">
              <Label htmlFor="username">用户名</Label>
              <Input id="username" value={editUser.username} disabled />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">姓名</Label>
              <Input id="name" name="name" defaultValue={editUser.name} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">角色</Label>
              <Select name="role" required defaultValue={editUser.role}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(roleLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">新密码（留空不修改）</Label>
              <Input id="password" name="password" type="password" placeholder="留空则不修改密码" />
            </div>
          </FormSection>
        </Form>
      </FormPage>
    </AppLayout>
  );
}
