import { Form, redirect, useNavigation, Link } from "react-router";
import type { Route } from "./+types/users.$id.edit";
import { requireRole } from "~/lib/auth.server";
import { roleLabels } from "~/lib/auth";
import { db } from "~/lib/db.server";
import { AppLayout } from "~/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button, buttonVariants } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { ArrowLeft, Loader2, UserCog } from "lucide-react";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";

export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireRole(request, ["admin"]);
  const editUser = await db.user.findUnique({ where: { id: Number(params.id) } });
  if (!editUser) throw new Response("用户不存在", { status: 404 });
  return { user, editUser };
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
  throw redirect("/users");
}

export default function EditUserPage({ loaderData }: Route.ComponentProps) {
  const { user, editUser } = loaderData;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <AppLayout user={user}>
      <div className="max-w-lg animate-fade-in">
        <div className="mb-6">
          <Link to="/users" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-2")}>
            <ArrowLeft className="size-4" />
            返回用户列表
          </Link>
          <h2 className="text-2xl font-bold">编辑用户</h2>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserCog className="size-4" />
              编辑用户信息
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form method="post" className="space-y-4">

              <div className="space-y-1.5">
                <Label htmlFor="username">用户名</Label>
                <Input id="username" value={editUser.username} disabled />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="name">姓名</Label>
                <Input id="name" name="name" defaultValue={editUser.name} required />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="role">角色</Label>
                <Select name="role" required defaultValue={editUser.role}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(roleLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">新密码（留空不修改）</Label>
                <Input id="password" name="password" type="password" placeholder="留空则不修改密码" />
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
                  {isSubmitting ? "保存中..." : "保存"}
                </Button>
                <Link to="/users" className={cn(buttonVariants({ variant: "outline" }))}>取消</Link>
              </div>
            </Form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
