import { Form, redirect, useActionData, useNavigation } from "react-router";
import type { Route } from "./+types/login";
import { login, createUserSession } from "~/lib/auth.server";
import { getUserSession } from "~/lib/auth.server";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Store, AlertCircle, Loader2, Lock, User } from "lucide-react";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getUserSession(request);
  if (user) throw redirect("/dashboard");
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;

  if (!username || !password) {
    return { error: "请输入用户名和密码" };
  }

  const user = await login(username, password);
  if (!user) {
    return { error: "用户名或密码错误" };
  }

  return createUserSession(user.id, "/dashboard");
}

export default function LoginPage() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="backdrop-blur-sm bg-white/95 shadow-2xl rounded-2xl p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
              <Store className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">超市商品采购管理系统</h1>
            <p className="text-gray-500 mt-2">请登录您的账号</p>
          </div>

          <Form method="post" className="space-y-5">
            {actionData?.error && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription>{actionData.error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="username">
                <User className="size-4 text-muted-foreground" />
                用户名
              </Label>
              <Input
                id="username"
                name="username"
                type="text"
                required
                placeholder="请输入用户名"
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">
                <Lock className="size-4 text-muted-foreground" />
                密码
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                placeholder="请输入密码"
                className="h-10"
              />
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-10"
              size="lg"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  登录中...
                </>
              ) : (
                "登 录"
              )}
            </Button>

            <div className="text-center text-sm text-muted-foreground pt-2 space-y-1">
              <p>默认管理员：admin / admin123</p>
              <p>其他用户：用户名 / 123456</p>
            </div>
          </Form>
        </div>
      </div>
    </div>
  );
}
