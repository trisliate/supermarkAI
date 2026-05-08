import { Form, useFetcher, useNavigation, useLoaderData } from "react-router";
import type { Route } from "./+types/categories";
import { requireRole } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { AppLayout } from "~/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Plus, Trash2, Tags, Loader2 } from "lucide-react";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireRole(request, ["admin"]);
  const categories = await db.category.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: { name: "asc" },
  });
  return { user, categories };
}

export async function action({ request }: Route.ActionArgs) {
  await requireRole(request, ["admin"]);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    if (!name) return { error: "分类名称不能为空" };
    const exists = await db.category.findUnique({ where: { name } });
    if (exists) return { error: "分类名称已存在" };
    await db.category.create({ data: { name, description } });
  } else if (intent === "delete") {
    const id = Number(formData.get("id"));
    const count = await db.product.count({ where: { categoryId: id } });
    if (count > 0) return { error: "该分类下还有商品，无法删除" };
    await db.category.delete({ where: { id } });
  }

  return { ok: true };
}

export default function CategoriesPage() {
  const { user, categories } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <AppLayout user={user}>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h2 className="text-2xl font-bold">分类管理</h2>
          <p className="text-sm text-muted-foreground mt-1">管理商品分类</p>
        </div>

        {/* 新增分类表单 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="size-4" />
              新增分类
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form method="post" className="flex gap-4 items-end">
              <input type="hidden" name="intent" value="create" />
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="name">分类名称</Label>
                <Input id="name" name="name" required placeholder="请输入分类名称" />
              </div>
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="description">描述</Label>
                <Input id="description" name="description" placeholder="可选描述" />
              </div>
              <Button type="submit" disabled={isSubmitting} className="shrink-0">
                {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                添加
              </Button>
            </Form>
          </CardContent>
        </Card>

        {/* 分类列表 */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-16">ID</TableHead>
                  <TableHead>名称</TableHead>
                  <TableHead>描述</TableHead>
                  <TableHead>商品数</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                      <Tags className="size-8 mx-auto mb-2 opacity-50" />
                      暂无分类数据
                    </TableCell>
                  </TableRow>
                ) : (
                  categories.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-muted-foreground">{c.id}</TableCell>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-muted-foreground">{c.description || "-"}</TableCell>
                      <TableCell>{c._count.products}</TableCell>
                      <TableCell className="text-right">
                        <fetcher.Form method="post" className="inline">
                          <input type="hidden" name="intent" value="delete" />
                          <input type="hidden" name="id" value={c.id} />
                          <Button
                            variant="ghost"
                            size="sm"
                            type="submit"
                            className="text-destructive hover:text-destructive"
                            onClick={(e) => { if (!confirm("确定删除？")) e.preventDefault(); }}
                          >
                            <Trash2 className="size-3.5" />
                            删除
                          </Button>
                        </fetcher.Form>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
