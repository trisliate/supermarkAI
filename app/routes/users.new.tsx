import { Form, redirect, useActionData, useNavigation, Link } from "react-router";
import type { Route } from "./+types/users.new";
import { requireRole } from "~/lib/auth.server";
import { roleLabels } from "~/lib/auth";
import { db } from "~/lib/db.server";
import { AppLayout } from "~/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button, buttonVariants } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { ArrowLeft, Loader2, AlertCircle, UserPlus } from "lucide-react";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireRole(request, ["admin"]);
  return { user };
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

  throw redirect("/users");
}

export default function NewUserPage({ loaderData }: Route.ComponentProps) {
  const { user } = loaderData;
  const actionData = useActionData<typeof action>();
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
          <h2 className="text-2xl font-bold">新增用户</h2>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserPlus className="size-4" />
              创建新用户
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form method="post" className="space-y-4">
              {actionData?.error && (
                <Alert variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertDescription>{actionData.error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="username">用户名</Label>
                <Input id="username" name="username" required placeholder="请输入用户名" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">密码</Label>
                <Input id="password" name="password" type="password" required placeholder="请输入密码" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="name">姓名</Label>
                <Input id="name" name="name" required placeholder="请输入真实姓名" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="role">角色</Label>
                <Select name="role" required>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="请选择角色" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(roleLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
                  {isSubmitting ? "提交中..." : "创建"}
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
