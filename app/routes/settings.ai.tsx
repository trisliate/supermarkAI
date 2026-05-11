import { useFetcher } from "react-router";
import { useState, useEffect } from "react";
import type { Route } from "./+types/settings.ai";
import { requireRole } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { encrypt, decrypt } from "~/lib/crypto.server";
import { AppLayout } from "~/components/layout/app-layout";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { Bot, Plus, Trash2, Loader2, Zap, Settings, CheckCircle, XCircle } from "lucide-react";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { toast } from "sonner";

const providers = [
  { value: "dashscope", label: "通义千问 (DashScope)", models: ["qwen-turbo", "qwen-plus", "qwen-max", "qwen-long"] },
  { value: "deepseek", label: "DeepSeek", models: ["deepseek-chat", "deepseek-coder"] },
  { value: "glm", label: "智谱 (GLM)", models: ["glm-4-flash", "glm-4", "glm-4v"] },
  { value: "moonshot", label: "月之暗面 (Moonshot)", models: ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"] },
  { value: "ernie", label: "文心一言 (ERNIE)", models: ["ernie-speed", "ernie-lite", "ernie-4.0-8k"] },
];

const providerBaseUrls: Record<string, string> = {
  dashscope: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  deepseek: "https://api.deepseek.com/v1",
  glm: "https://open.bigmodel.cn/api/paas/v4",
  moonshot: "https://api.moonshot.cn/v1",
  ernie: "https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat",
};

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireRole(request, ["admin"]);
  const configs = await db.aIConfig.findMany({ orderBy: { createdAt: "desc" } });
  const masked = configs.map((c) => ({
    ...c,
    apiKey: "••••••••" + c.apiKey.slice(-8),
  }));
  return { user, configs: masked };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireRole(request, ["admin"]);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "create" || intent === "update") {
    const id = formData.get("id") ? Number(formData.get("id")) : null;
    const provider = formData.get("provider") as string;
    const model = formData.get("model") as string;
    const apiKeyRaw = formData.get("apiKey") as string;
    const systemPrompt = formData.get("systemPrompt") as string;

    if (!provider || !model || (!apiKeyRaw && !id)) {
      return { error: "请填写所有必填字段" };
    }

    let apiKey: string;
    if (apiKeyRaw.startsWith("••••••••")) {
      if (!id) return { error: "请输入 API Key" };
      const existing = await db.aIConfig.findUnique({ where: { id } });
      if (!existing) return { error: "配置不存在" };
      apiKey = existing.apiKey;
    } else {
      apiKey = encrypt(apiKeyRaw);
    }

    const baseUrl = providerBaseUrls[provider] || null;

    if (id) {
      await db.aIConfig.update({
        where: { id },
        data: { provider, model, apiKey, baseUrl, systemPrompt: systemPrompt || null },
      });
    } else {
      await db.aIConfig.create({
        data: { provider, model, apiKey, baseUrl, systemPrompt: systemPrompt || null },
      });
    }
    return { ok: true, intent };
  }

  if (intent === "activate") {
    const id = Number(formData.get("id"));
    await db.aIConfig.updateMany({ data: { isActive: false } });
    await db.aIConfig.update({ where: { id }, data: { isActive: true } });
    return { ok: true, intent };
  }

  if (intent === "delete") {
    const id = Number(formData.get("id"));
    await db.aIConfig.delete({ where: { id } });
    return { ok: true, intent };
  }

  if (intent === "test") {
    const id = Number(formData.get("id"));
    const config = await db.aIConfig.findUnique({ where: { id } });
    if (!config) return { error: "配置不存在" };

    try {
      const decryptedKey = decrypt(config.apiKey);
      const baseUrl = config.baseUrl || providerBaseUrls[config.provider] || "";
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${decryptedKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: "user", content: "你好" }],
          max_tokens: 10,
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        return { error: `连接失败 (${res.status}): ${errText.slice(0, 100)}` };
      }
      return { ok: true, intent: "test" };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { error: `连接错误: ${message}` };
    }
  }

  return { error: "未知操作" };
}

export default function SettingsAIPage({ loaderData }: Route.ComponentProps) {
  const { user, configs } = loaderData;
  const fetcher = useFetcher();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [selectedProvider, setSelectedProvider] = useState("dashscope");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const isSaving = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      if (fetcher.data.error) {
        toast.error(fetcher.data.error);
      } else if (fetcher.data.ok) {
        if (fetcher.data.intent === "test") {
          toast.success("连接测试成功！");
        } else if (fetcher.data.intent === "delete") {
          toast.success("配置已删除");
          setDeleteId(null);
        } else {
          toast.success(editId ? "配置已更新" : "配置已创建");
          setShowForm(false);
          setEditId(null);
        }
      }
    }
  }, [fetcher.state, fetcher.data, editId]);

  const handleEdit = (config: typeof configs[0]) => {
    setEditId(config.id);
    setSelectedProvider(config.provider);
    setShowForm(true);
  };

  const handleNew = () => {
    setEditId(null);
    setSelectedProvider("dashscope");
    setShowForm(true);
  };

  const currentProvider = providers.find((p) => p.value === selectedProvider);
  const editingConfig = editId ? configs.find((c) => c.id === editId) : null;

  return (
    <AppLayout user={user}>
      <div className="max-w-3xl animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <Settings className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">AI 设置</h2>
              <p className="text-xs text-muted-foreground">配置 AI 助手的模型和 API Key</p>
            </div>
          </div>
          {!showForm && (
            <Button onClick={handleNew} size="sm">
              <Plus className="size-4" /> 添加配置
            </Button>
          )}
        </div>

        {/* Config list */}
        {configs.length > 0 && (
          <div className="space-y-3 mb-6">
            {configs.map((config) => {
              const prov = providers.find((p) => p.value === config.provider);
              return (
                <div
                  key={config.id}
                  className={`bg-white dark:bg-slate-900/50 rounded-xl border p-4 transition-all ${
                    config.isActive
                      ? "border-emerald-300 dark:border-emerald-700 ring-1 ring-emerald-200 dark:ring-emerald-800"
                      : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      config.isActive ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-slate-100 dark:bg-slate-800"
                    }`}>
                      <Bot className={`w-5 h-5 ${config.isActive ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                          {prov?.label || config.provider}
                        </span>
                        <Badge variant="outline" className="text-[10px]">{config.model}</Badge>
                        {config.isActive && (
                          <Badge className="text-[10px] bg-emerald-500">使用中</Badge>
                        )}
                      </div>
                      <span className="text-xs text-slate-400 font-mono mt-0.5 block">{config.apiKey}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {!config.isActive && (
                        <fetcher.Form method="post">
                          <input type="hidden" name="intent" value="activate" />
                          <input type="hidden" name="id" value={config.id} />
                          <Button type="submit" variant="outline" size="sm" className="h-8 text-xs" disabled={isSaving}>
                            <CheckCircle className="size-3" /> 启用
                          </Button>
                        </fetcher.Form>
                      )}
                      <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => handleEdit(config)}>
                        编辑
                      </Button>
                      <fetcher.Form method="post">
                        <input type="hidden" name="intent" value="test" />
                        <input type="hidden" name="id" value={config.id} />
                        <Button type="submit" variant="outline" size="sm" className="h-8 text-xs" disabled={isSaving}>
                          <Zap className="size-3" /> 测试
                        </Button>
                      </fetcher.Form>
                      <Button
                        variant="ghost" size="sm"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(config.id)}
                        disabled={isSaving}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {configs.length === 0 && !showForm && (
          <div className="bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 p-8 text-center mb-6">
            <Bot className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-500 dark:text-slate-400">尚未配置 AI 模型</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">点击上方按钮添加 LLM 配置</p>
          </div>
        )}

        {/* Add / Edit form */}
        {showForm && (
          <div className="bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 p-6 mb-6">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4">
              {editId ? "编辑配置" : "添加新配置"}
            </h3>
            <fetcher.Form method="post" className="space-y-4">
              <input type="hidden" name="intent" value={editId ? "update" : "create"} />
              {editId && <input type="hidden" name="id" value={editId} />}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>供应商</Label>
                  <Select name="provider" value={selectedProvider} onValueChange={(v) => { if (v) setSelectedProvider(v); }}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {providers.map((p) => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>模型</Label>
                  <Select name="model" defaultValue={editingConfig?.model || currentProvider?.models[0]}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {currentProvider?.models.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>API Key</Label>
                <Input
                  name="apiKey"
                  type="password"
                  placeholder={editId ? "留空保持不变" : "输入 API Key"}
                  className="font-mono text-sm"
                  defaultValue={editId ? configs.find((c) => c.id === editId)?.apiKey : ""}
                />
              </div>

              <div className="space-y-2">
                <Label>系统提示词 <span className="text-muted-foreground">(可选)</span></Label>
                <Textarea
                  name="systemPrompt"
                  placeholder="自定义 AI 助手的行为和角色..."
                  className="min-h-[80px] text-sm"
                  defaultValue={editingConfig?.systemPrompt || ""}
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
                  {editId ? "更新配置" : "添加配置"}
                </Button>
                <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditId(null); }}>
                  取消
                </Button>
              </div>
            </fetcher.Form>
          </div>
        )}

        {/* Info */}
        <div className="bg-blue-50 dark:bg-blue-950/20 rounded-xl border border-blue-200 dark:border-blue-800 p-4">
          <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">支持的 LLM 供应商</h4>
          <div className="grid grid-cols-2 gap-2 text-xs text-blue-700 dark:text-blue-400">
            {providers.map((p) => (
              <div key={p.value} className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                {p.label}
              </div>
            ))}
          </div>
          <p className="text-xs text-blue-600/70 dark:text-blue-400/50 mt-3">
            需要在环境变量中设置 ENCRYPTION_KEY (32字节) 用于加密 API Key
          </p>
        </div>
      </div>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => { if (!open) setDeleteId(null); }}
        title="删除配置"
        description="确定要删除该 AI 配置吗？此操作不可撤销。"
        confirmText="删除"
        loading={isSaving}
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
