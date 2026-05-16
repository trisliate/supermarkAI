import { Form, useFetcher, useNavigation, useLoaderData } from "react-router";
import { useState, useEffect, useMemo } from "react";
import type { Route } from "./+types/categories";
import { requireRole } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { AppLayout } from "~/components/layout/app-layout";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "~/components/ui/dialog";
import { PageSkeleton } from "~/components/ui/page-skeleton";
import { Plus, Trash2, Tags, Loader2, Search, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { DataTablePagination } from "~/components/ui/data-table-pagination";
import { PAGE_SIZE } from "~/lib/constants";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireRole(request, ["admin"]);
  const { loadRoutePermissions } = await import("~/lib/permissions.server");
  const routePermissions = await loadRoutePermissions();
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
  return { user, categories, total, page, pageSize: PAGE_SIZE, routePermissions };
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
  const { user, categories, total, page, pageSize, routePermissions } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const isLoading = navigation.state === "loading" && navigation.location?.pathname === "/categories";
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const isDeleting = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      if (fetcher.data.error) {
        toast.error(fetcher.data.error);
      } else if (fetcher.data.ok) {
        if (deleteId !== null) {
          toast.success("分类已删除");
          setDeleteId(null);
        } else {
          toast.success("分类已添加");
          setShowAdd(false);
        }
      }
    }
  }, [fetcher.state, fetcher.data]);

  const filtered = useMemo(() => {
    if (!search) return categories;
    const q = search.toLowerCase();
    return categories.filter((c) => c.name.toLowerCase().includes(q) || (c.description && c.description.toLowerCase().includes(q)));
  }, [categories, search]);

  return (
    <AppLayout
      user={user} routePermissions={routePermissions}
      description={`共 ${total} 个分类`}
    >
      {isLoading ? <PageSkeleton columns={5} rows={6} /> : (
      <div className="animate-fade-in">
        {/* Search + Action */}
        <div className="flex items-center gap-3 mb-4">
          <Button onClick={() => setShowAdd(true)} size="sm" className="shrink-0">
            <Plus className="size-4" /> 添加分类
          </Button>
          <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <Input
            placeholder="搜索分类..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        </div>

        {/* Add Category Dialog */}
        <Dialog open={showAdd} onOpenChange={(open) => { if (!open) setShowAdd(false); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="size-4" /> 新增分类
              </DialogTitle>
              <DialogDescription>添加新的商品分类</DialogDescription>
            </DialogHeader>
            <fetcher.Form method="post" className="space-y-4">
              <input type="hidden" name="intent" value="create" />
              <div className="space-y-1.5">
                <Label htmlFor="cat-name">分类名称 <span className="text-red-500">*</span></Label>
                <Input id="cat-name" name="name" required placeholder="请输入分类名称" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cat-desc">描述 <span className="text-muted-foreground font-normal">(可选)</span></Label>
                <Textarea id="cat-desc" name="description" rows={2} placeholder="分类描述" className="text-sm" />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
                  {isSubmitting ? "添加中..." : "添加分类"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>取消</Button>
              </div>
            </fetcher.Form>
          </DialogContent>
        </Dialog>

        {/* Category grid */}
        {filtered.length === 0 ? (
          <div className="bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 p-12 text-center">
            <FolderOpen className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-500 dark:text-slate-400">{search ? "没有匹配的分类" : "暂无分类"}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{search ? "尝试其他关键词" : "点击上方按钮添加第一个分类"}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filtered.map((c) => (
              <div
                key={c.id}
                className="bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 p-4 hover:border-slate-300 dark:hover:border-slate-700 transition-colors group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center shrink-0">
                      <Tags className="w-4 h-4 text-slate-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{c.description || "无描述"}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setDeleteId(c.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/20"
                  >
                    <Trash2 className="size-3.5 text-destructive" />
                  </button>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-xs text-muted-foreground">{c._count.products} 件商品</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4">
          <DataTablePagination totalPages={Math.ceil(total / pageSize)} currentPage={page} />
        </div>
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

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fade-in 0.4s ease-out both; }
      ` }} />
    </AppLayout>
  );
}
