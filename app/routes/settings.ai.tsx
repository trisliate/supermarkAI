import { useFetcher } from "react-router";
import { useState, useEffect } from "react";
import type { Route } from "./+types/settings.ai";
import { requireRole } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { encrypt, decrypt } from "~/lib/crypto.server";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { Plus, Trash2, Loader2, Zap, Settings, CheckCircle, ExternalLink } from "lucide-react";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { toast } from "sonner";

interface Provider {
  value: string;
  label: string;
  color: string;
  bgColor: string;
  models: string[];
  baseUrl: string;
  website: string;
  logo: React.ReactNode;
}

const providers: Provider[] = [
  {
    value: "dashscope", label: "通义千问", color: "text-violet-600", bgColor: "bg-violet-100 dark:bg-violet-900/30",
    models: ["qwen-turbo", "qwen-plus", "qwen-max", "qwen-long", "qwen2.5-72b-instruct"],
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", website: "https://dashscope.aliyun.com",
    logo: <svg viewBox="0 0 24 24" fill="none" className="w-full h-full p-1.5"><circle cx="12" cy="12" r="10" fill="#6d28d9"/><path d="M8 8l4 8 4-8" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="3" fill="#fff" fillOpacity="0.3"/></svg>,
  },
  {
    value: "deepseek", label: "DeepSeek", color: "text-blue-600", bgColor: "bg-blue-100 dark:bg-blue-900/30",
    models: ["deepseek-chat", "deepseek-coder", "deepseek-reasoner"],
    baseUrl: "https://api.deepseek.com/v1", website: "https://platform.deepseek.com",
    logo: <svg viewBox="0 0 24 24" fill="none" className="w-full h-full p-1.5"><circle cx="12" cy="12" r="10" fill="#2563eb"/><path d="M7 12h10M12 7v10" stroke="#fff" strokeWidth="2" strokeLinecap="round"/><circle cx="12" cy="12" r="3" fill="#fff" fillOpacity="0.25"/></svg>,
  },
  {
    value: "glm", label: "智谱清言", color: "text-cyan-600", bgColor: "bg-cyan-100 dark:bg-cyan-900/30",
    models: ["glm-4-flash", "glm-4", "glm-4v", "glm-4-long"],
    baseUrl: "https://open.bigmodel.cn/api/paas/v4", website: "https://open.bigmodel.cn",
    logo: <svg viewBox="0 0 24 24" fill="none" className="w-full h-full p-1.5"><circle cx="12" cy="12" r="10" fill="#0891b2"/><path d="M8 12a4 4 0 018 0" stroke="#fff" strokeWidth="2" strokeLinecap="round"/><circle cx="12" cy="10" r="2" fill="#fff"/></svg>,
  },
  {
    value: "moonshot", label: "月之暗面", color: "text-slate-600", bgColor: "bg-slate-100 dark:bg-slate-800",
    models: ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"],
    baseUrl: "https://api.moonshot.cn/v1", website: "https://platform.moonshot.cn",
    logo: <svg viewBox="0 0 24 24" fill="none" className="w-full h-full p-1.5"><circle cx="12" cy="12" r="10" fill="#1e293b"/><path d="M15 9a5 5 0 01-5 5" stroke="#fff" strokeWidth="2" strokeLinecap="round"/><circle cx="10" cy="10" r="4" fill="#fff" fillOpacity="0.15"/></svg>,
  },
  {
    value: "ernie", label: "文心一言", color: "text-red-600", bgColor: "bg-red-100 dark:bg-red-900/30",
    models: ["ernie-speed", "ernie-lite", "ernie-4.0-8k", "ernie-4.0-turbo-8k"],
    baseUrl: "https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat", website: "https://cloud.baidu.com",
    logo: <svg viewBox="0 0 24 24" fill="none" className="w-full h-full p-1.5"><circle cx="12" cy="12" r="10" fill="#dc2626"/><path d="M8 8c2 2 2 6 0 8M16 8c-2 2-2 6 0 8" stroke="#fff" strokeWidth="2" strokeLinecap="round"/></svg>,
  },
  {
    value: "doubao", label: "豆包", color: "text-emerald-600", bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
    models: ["doubao-pro-32k", "doubao-lite-32k", "doubao-pro-128k", "doubao-lite-128k"],
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3", website: "https://console.volcengine.com",
    logo: <svg viewBox="0 0 24 24" fill="none" className="w-full h-full p-1.5"><circle cx="12" cy="12" r="10" fill="#059669"/><circle cx="12" cy="10" r="4" fill="#fff"/><path d="M8 15c1 1 3 2 4 2s3-1 4-2" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  },
  {
    value: "hunyuan", label: "腾讯混元", color: "text-sky-600", bgColor: "bg-sky-100 dark:bg-sky-900/30",
    models: ["hunyuan-turbos-latest", "hunyuan-pro", "hunyuan-standard"],
    baseUrl: "https://api.hunyuan.cloud.tencent.com/v1", website: "https://cloud.tencent.com",
    logo: <svg viewBox="0 0 24 24" fill="none" className="w-full h-full p-1.5"><circle cx="12" cy="12" r="10" fill="#0284c7"/><path d="M12 6v12M6 12h12" stroke="#fff" strokeWidth="2" strokeLinecap="round"/><circle cx="12" cy="12" r="4" fill="#fff" fillOpacity="0.2"/></svg>,
  },
  {
    value: "yi", label: "零一万物", color: "text-orange-600", bgColor: "bg-orange-100 dark:bg-orange-900/30",
    models: ["yi-lightning", "yi-large", "yi-medium", "yi-spark"],
    baseUrl: "https://api.lingyiwanwu.com/v1", website: "https://platform.lingyiwanwu.com",
    logo: <svg viewBox="0 0 24 24" fill="none" className="w-full h-full p-1.5"><circle cx="12" cy="12" r="10" fill="#ea580c"/><path d="M12 6l2 4h4l-3 3 1 4-4-2-4 2 1-4-3-3h4z" fill="#fff"/></svg>,
  },
  {
    value: "minimax", label: "MiniMax", color: "text-pink-600", bgColor: "bg-pink-100 dark:bg-pink-900/30",
    models: ["abab6.5s-chat", "abab6.5-chat", "abab6.5g-chat"],
    baseUrl: "https://api.minimax.chat/v1", website: "https://platform.minimaxi.com",
    logo: <svg viewBox="0 0 24 24" fill="none" className="w-full h-full p-1.5"><circle cx="12" cy="12" r="10" fill="#db2777"/><rect x="7" y="9" width="3" height="6" rx="1" fill="#fff"/><rect x="14" y="9" width="3" height="6" rx="1" fill="#fff"/></svg>,
  },
  {
    value: "spark", label: "讯飞星火", color: "text-amber-600", bgColor: "bg-amber-100 dark:bg-amber-900/30",
    models: ["spark-lite", "spark-pro", "spark-max", "spark-4.0-ultra"],
    baseUrl: "https://spark-api-open.xf-yun.com/v1", website: "https://xinghuo.xfyun.cn",
    logo: <svg viewBox="0 0 24 24" fill="none" className="w-full h-full p-1.5"><circle cx="12" cy="12" r="10" fill="#d97706"/><path d="M12 6v3M12 15v3M6 12h3M15 12h3" stroke="#fff" strokeWidth="2" strokeLinecap="round"/><circle cx="12" cy="12" r="2.5" fill="#fff"/></svg>,
  },
];

function ProviderLogo({ provider, size = "md" }: { provider: Provider; size?: "sm" | "md" | "lg" }) {
  const sizeClasses = { sm: "w-7 h-7", md: "w-10 h-10", lg: "w-12 h-12" };
  return (
    <div className={`${sizeClasses[size]} rounded-xl overflow-hidden shrink-0`}>
      {provider.logo}
    </div>
  );
}

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

    const prov = providers.find((p) => p.value === provider);
    const baseUrl = prov?.baseUrl || null;

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
      const prov = providers.find((p) => p.value === config.provider);
      const baseUrl = config.baseUrl || prov?.baseUrl || "";
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
  const { configs } = loaderData;
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
    <div className="animate-fade-in">
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

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: provider list + info */}
        <div className="xl:col-span-1 space-y-4">
          {/* Available providers */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800/80 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">支持的模型供应商</h3>
            <div className="space-y-2">
              {providers.map((p) => {
                const hasConfig = configs.some((c) => c.provider === p.value);
                return (
                  <div key={p.value} className="flex items-center gap-3 py-1.5">
                    <ProviderLogo provider={p} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{p.label}</p>
                      <p className="text-[10px] text-slate-400 truncate">{p.models.slice(0, 3).join(", ")}{p.models.length > 3 ? "..." : ""}</p>
                    </div>
                    {hasConfig && (
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active config */}
          {configs.some((c) => c.isActive) && (
            <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-800 p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">当前启用</span>
              </div>
              {configs.filter((c) => c.isActive).map((c) => {
                const prov = providers.find((p) => p.value === c.provider);
                return (
                  <div key={c.id} className="flex items-center gap-2">
                    {prov && <ProviderLogo provider={prov} size="sm" />}
                    <div>
                      <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">{prov?.label || c.provider}</p>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400">{c.model}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: configs + form */}
        <div className="xl:col-span-2 space-y-4">
          {/* Config cards grid */}
          {configs.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {configs.map((config) => {
                const prov = providers.find((p) => p.value === config.provider);
                return (
                  <div
                    key={config.id}
                    className={`bg-white dark:bg-slate-900 rounded-xl border p-4 transition-all ${
                      config.isActive
                        ? "border-emerald-300 dark:border-emerald-700 ring-1 ring-emerald-200 dark:ring-emerald-800"
                        : "border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      {prov && <ProviderLogo provider={prov} />}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                            {prov?.label || config.provider}
                          </span>
                          {config.isActive && (
                            <Badge className="text-[10px] bg-emerald-500">使用中</Badge>
                          )}
                        </div>
                        <Badge variant="outline" className="text-[10px] mt-1">{config.model}</Badge>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-400 font-mono mb-3 truncate">{config.apiKey}</p>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {!config.isActive && (
                        <fetcher.Form method="post">
                          <input type="hidden" name="intent" value="activate" />
                          <input type="hidden" name="id" value={config.id} />
                          <Button type="submit" variant="outline" size="sm" className="h-7 text-[11px]" disabled={isSaving}>
                            <CheckCircle className="size-3" /> 启用
                          </Button>
                        </fetcher.Form>
                      )}
                      <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => handleEdit(config)}>
                        编辑
                      </Button>
                      <fetcher.Form method="post">
                        <input type="hidden" name="intent" value="test" />
                        <input type="hidden" name="id" value={config.id} />
                        <Button type="submit" variant="outline" size="sm" className="h-7 text-[11px]" disabled={isSaving}>
                          <Zap className="size-3" /> 测试
                        </Button>
                      </fetcher.Form>
                      <Button
                        variant="ghost" size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive ml-auto"
                        onClick={() => setDeleteId(config.id)}
                        disabled={isSaving}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty state */}
          {configs.length === 0 && !showForm && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800/80 p-8 text-center">
              <Settings className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-sm text-slate-500 dark:text-slate-400">尚未配置 AI 模型</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">点击右上角按钮添加模型配置</p>
            </div>
          )}

          {/* Add / Edit form */}
          {showForm && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800/80 p-5">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4">
                {editId ? "编辑配置" : "添加新配置"}
              </h3>
              <fetcher.Form method="post" className="space-y-4">
                <input type="hidden" name="intent" value={editId ? "update" : "create"} />
                {editId && <input type="hidden" name="id" value={editId} />}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>供应商</Label>
                    <Select name="provider" value={selectedProvider} onValueChange={(v) => { if (v) setSelectedProvider(v); }}>
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {currentProvider && (
                            <div className="flex items-center gap-2">
                              <ProviderLogo provider={currentProvider} size="sm" />
                              <span>{currentProvider.label}</span>
                            </div>
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {providers.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            <div className="flex items-center gap-2">
                              <ProviderLogo provider={p} size="sm" />
                              <span>{p.label}</span>
                            </div>
                          </SelectItem>
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
                  {currentProvider && (
                    <a
                      href={currentProvider.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto flex items-center gap-1 text-xs text-slate-400 hover:text-blue-500 transition-colors"
                    >
                      前往 {currentProvider.label} <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </fetcher.Form>
            </div>
          )}

          {/* Info */}
          <div className="bg-blue-50 dark:bg-blue-950/20 rounded-xl border border-blue-200 dark:border-blue-800 p-4">
            <p className="text-xs text-blue-600/70 dark:text-blue-400/50">
              需要在环境变量中设置 ENCRYPTION_KEY (32字节) 用于加密 API Key。所有供应商均兼容 OpenAI API 格式。
            </p>
          </div>
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
    </div>
  );
}
