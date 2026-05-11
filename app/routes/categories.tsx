import { Form, useFetcher, useNavigation, useLoaderData } from "react-router";
import { useState, useEffect, useMemo } from "react";
import type { Route } from "./+types/categories";
import { requireRole } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { AppLayout } from "~/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { PageSkeleton } from "~/components/ui/page-skeleton";
import { Plus, Trash2, Tags, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { DataTablePagination } from "~/components/ui/data-table-pagination";

const PAGE_SIZE = 20;

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireRole(request, ["admin"]);
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const [total, categories] = await Promise.all([
    db.category.count(),
    db.category.findMany({
      include: { _count: { select: { products: true } } },
      orderBy: { name: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);
  return { user, categories, total, page, pageSize: PAGE_SIZE };
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
  const { user, categories, total, page, pageSize } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const isLoading = navigation.state === "loading" && navigation.location?.pathname === "/categories";
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const isDeleting = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      if (fetcher.data.error) {
        toast.error(fetcher.data.error);
      } else if (fetcher.data.ok && deleteId !== null) {
        toast.success("分类已删除");
        setDeleteId(null);
      }
    }
  }, [fetcher.state, fetcher.data]);

  const filtered = useMemo(() => {
    if (!search) return categories;
    const q = search.toLowerCase();
    return categories.filter((c) => c.name.toLowerCase().includes(q) || (c.description && c.description.toLowerCase().includes(q)));
  }, [categories, search]);

  return (
    <AppLayout user={user}>
      {isLoading ? <PageSkeleton columns={5} rows={6} /> : (
      <div className="space-y-4 animate-fade-in">
        <div>
          <h2 className="text-2xl font-bold">分类管理</h2>
          <p className="text-sm text-muted-foreground mt-1">管理商品分类</p>
        </div>

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

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <Input
            placeholder="搜索分类名称..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">ID</TableHead>
                  <TableHead>名称</TableHead>
                  <TableHead>描述</TableHead>
                  <TableHead>商品数</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                      <Tags className="size-8 mx-auto mb-2 opacity-50" />
                      {search ? "没有匹配的分类" : "暂无分类数据"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-muted-foreground">{c.id}</TableCell>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-muted-foreground">{c.description || "-"}</TableCell>
                      <TableCell>{c._count.products}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(c.id)}
                        >
                          <Trash2 className="size-3.5" />
                          删除
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <DataTablePagination totalPages={Math.ceil(total / pageSize)} currentPage={page} />
      </div>
      )}

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => { if (!open) setDeleteId(null); }}
        title="删除分类"
        description="确定要删除该分类吗？此操作不可撤销。"
        confirmText="删除"
        loading={isDeleting}
        onConfirm={() => {
          if (deleteId === null) return;
          const fd = new FormData();
          fd.set("intent", "delete");
          fd.set("id", String(deleteId));
          fetcher.submit(fd, { method: "post" });
        }}
      />
    </AppLayout>
  );
}
