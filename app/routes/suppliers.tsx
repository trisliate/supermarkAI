import { useFetcher, useNavigation } from "react-router";
import { useState, useEffect, useMemo } from "react";
import type { Route } from "./+types/suppliers";
import { requireRole } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { AppLayout } from "~/components/layout/app-layout";

import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { PageSkeleton } from "~/components/ui/page-skeleton";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "~/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Plus, Pencil, Trash2, Truck, Search, Loader2, Package } from "lucide-react";
import { toast } from "sonner";
import { DataTablePagination } from "~/components/ui/data-table-pagination";

const PAGE_SIZE = 20;

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireRole(request, ["admin", "purchaser"]);
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const [total, suppliers] = await Promise.all([
    db.supplier.count(),
    db.supplier.findMany({
      orderBy: { name: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { _count: { select: { supplierProducts: true } } },
    }),
  ]);
  return { user, suppliers, total, page, pageSize: PAGE_SIZE };
}

export async function action({ request }: Route.ActionArgs) {
  await requireRole(request, ["admin"]);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "delete") {
    await db.supplier.delete({ where: { id: Number(formData.get("id")) } });
    return { ok: true, intent: "delete" };
  }

  if (intent === "update") {
    const id = Number(formData.get("id"));
    const name = formData.get("name") as string;
    const contact = formData.get("contact") as string;
    const phone = formData.get("phone") as string;
    const address = formData.get("address") as string;
    const status = formData.get("status") as "active" | "inactive";

    if (!name || !contact || !phone) {
      return { error: "必填字段不能为空", intent: "update" };
    }

    await db.supplier.update({
      where: { id },
      data: { name, contact, phone, address, status },
    });
    return { ok: true, intent: "update" };
  }

  if (intent === "create") {
    const name = formData.get("name") as string;
    const contact = formData.get("contact") as string;
    const phone = formData.get("phone") as string;
    const address = formData.get("address") as string;

    if (!name || !contact || !phone) {
      return { error: "必填字段不能为空", intent: "create" };
    }

    await db.supplier.create({ data: { name, contact, phone, address } });
    return { ok: true, intent: "create" };
  }

  return { ok: false };
}

export default function SuppliersPage({ loaderData }: Route.ComponentProps) {
  const { user, suppliers, total, page, pageSize } = loaderData;
  const fetcher = useFetcher();
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editSupplier, setEditSupplier] = useState<typeof suppliers[number] | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const isDeleting = fetcher.state !== "idle";
  const isSaving = fetcher.state !== "idle";
  const navigation = useNavigation();
  const isLoading = navigation.state === "loading" && navigation.location?.pathname === "/suppliers";

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      if (fetcher.data.intent === "delete" && fetcher.data.ok) {
        toast.success("供应商已删除");
        setDeleteId(null);
      } else if (fetcher.data.intent === "update" && fetcher.data.ok) {
        toast.success("供应商已更新");
        setEditSupplier(null);
      } else if (fetcher.data.intent === "create" && fetcher.data.ok) {
        toast.success("供应商创建成功");
        setShowNew(false);
      } else if (fetcher.data.error) {
        toast.error(fetcher.data.error);
      }
    }
  }, [fetcher.state, fetcher.data]);

  const filtered = useMemo(() => {
    return suppliers.filter((s) => {
      const matchSearch = !search || s.name.includes(search) || s.contact.includes(search) || (s.phone && s.phone.includes(search));
      const matchStatus = statusFilter === "all" || s.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [suppliers, search, statusFilter]);

  return (
    <AppLayout
      user={user}
      description="管理供应商信息"
    >
      {isLoading ? <PageSkeleton columns={7} rows={6} /> : (
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <div></div>
          <Button onClick={() => setShowNew(true)}>
            <Plus className="size-4" /> 新增供应商
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <Input placeholder="搜索名称、联系人或电话..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
          </div>
          <Tabs value={statusFilter} onValueChange={setStatusFilter}>
            <TabsList className="h-9">
              <TabsTrigger value="all" className="text-xs">全部</TabsTrigger>
              <TabsTrigger value="active" className="text-xs">合作中</TabsTrigger>
              <TabsTrigger value="inactive" className="text-xs">已停用</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">ID</TableHead>
                  <TableHead>名称</TableHead>
                  <TableHead>联系人</TableHead>
                  <TableHead>电话</TableHead>
                  <TableHead>地址</TableHead>
                  <TableHead>货物</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                      <Truck className="size-8 mx-auto mb-2 opacity-50" />
                      {search || statusFilter !== "all" ? "没有匹配的供应商" : "暂无供应商数据"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-muted-foreground">{s.id}</TableCell>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>{s.contact}</TableCell>
                      <TableCell>{s.phone}</TableCell>
                      <TableCell className="text-muted-foreground">{s.address || "-"}</TableCell>
                      <TableCell>
                        {s._count.supplierProducts > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs">
                            <Package className="size-3 text-slate-400" />
                            {s._count.supplierProducts}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-300 dark:text-slate-600">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={s.status === "active" ? "default" : "secondary"}>
                          {s.status === "active" ? "合作中" : "已停用"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setEditSupplier(s)}>
                            <Pencil className="size-3.5" /> 编辑
                          </Button>
                          {user.role === "admin" && (
                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteId(s.id)}>
                              <Trash2 className="size-3.5" /> 删除
                            </Button>
                          )}
                        </div>
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

      {/* New Supplier Dialog */}
      <Dialog open={showNew} onOpenChange={(open) => { if (!open) setShowNew(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="size-4" /> 新增供应商
            </DialogTitle>
            <DialogDescription>添加新的供应商</DialogDescription>
          </DialogHeader>
          <fetcher.Form method="post" className="space-y-4">
            <input type="hidden" name="intent" value="create" />
            <div className="space-y-1.5">
              <Label htmlFor="new-name">供应商名称</Label>
              <Input id="new-name" name="name" required placeholder="请输入供应商名称" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="new-contact">联系人</Label>
                <Input id="new-contact" name="contact" required placeholder="联系人姓名" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-phone">电话</Label>
                <Input id="new-phone" name="phone" required placeholder="联系电话" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-address">地址 <span className="text-muted-foreground font-normal">(可选)</span></Label>
              <Input id="new-address" name="address" placeholder="供应商地址" />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
                {isSaving ? "创建中..." : "创建供应商"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowNew(false)}>取消</Button>
            </div>
          </fetcher.Form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editSupplier !== null} onOpenChange={(open) => { if (!open) setEditSupplier(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="size-4" /> 编辑供应商
            </DialogTitle>
            <DialogDescription>修改供应商信息</DialogDescription>
          </DialogHeader>
          {editSupplier && (
            <fetcher.Form method="post" className="space-y-4">
              <input type="hidden" name="intent" value="update" />
              <input type="hidden" name="id" value={editSupplier.id} />
              <div className="space-y-1.5">
                <Label htmlFor="edit-name">供应商名称</Label>
                <Input id="edit-name" name="name" defaultValue={editSupplier.name} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-contact">联系人</Label>
                  <Input id="edit-contact" name="contact" defaultValue={editSupplier.contact} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-phone">电话</Label>
                  <Input id="edit-phone" name="phone" defaultValue={editSupplier.phone} required />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-address">地址</Label>
                <Input id="edit-address" name="address" defaultValue={editSupplier.address || ""} />
              </div>
              <div className="space-y-1.5">
                <Label>状态</Label>
                <Select name="status" defaultValue={editSupplier.status}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">合作中</SelectItem>
                    <SelectItem value="inactive">已停用</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
                  {isSaving ? "保存中..." : "保存"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setEditSupplier(null)}>取消</Button>
              </div>
            </fetcher.Form>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => { if (!open) setDeleteId(null); }}
        title="删除供应商"
        description="确定要删除该供应商吗？此操作不可撤销。"
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
