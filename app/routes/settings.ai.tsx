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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { Loader2, Zap, CheckCircle, ExternalLink, Trash2, Pencil, Plus, Eye, EyeOff, Sparkles } from "lucide-react";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { toast } from "sonner";

interface ProviderDef {
  value: string;
  label: string;
  logo: string;
  baseUrl: string;
  models: string[];
  color: string;
  website: string;
  description: string;
}

const providers: ProviderDef[] = [
  {
    value: "deepseek",
    label: "DeepSeek",
    logo: "https://s1.aigei.com/src/img/png/03/0305d15156154b85a80848ae4edd22ab.png?imageMogr2/auto-orient/thumbnail/!282x282r/gravity/Center/crop/282x282/quality/85/%7CimageView2/2/w/282&e=2051020800&token=P7S2Xpzfz11vAkASLTkfHN7Fw-oOZBecqeJaxypL:eFZ0GvEP17SkCu1zdapd0tTtlTw=",
    baseUrl: "https://api.deepseek.com/v1",
    models: ["deepseek-v4-flash", "deepseek-v4-pro", "deepseek-reasoner"],
    color: "#2563eb",
    website: "https://platform.deepseek.com",
    description: "深度求索 · 高性价比推理模型",
  },
  {
    value: "mimo",
    label: "MiMo",
    logo: "https://tse1-mm.cn.bing.net/th/id/OIP-C.exWGUuviU0ymMhb1OBiUNwHaD4?o=7rm=3&rs=1&pid=ImgDetMain&o=7&rm=3",
    baseUrl: "https://token-plan-sgp.xiaomimimo.com/anthropic",
    models: ["mimo-2.5", "mimo-2.5-pro"],
    color: "#ff6900",
    website: "https://github.com/XiaomiMiMo/MiMo",
    description: "小米 MiMo · 轻量高效",
  },
  {
    value: "qwen",
    label: "通义千问",
    logo: "https://freepnglogo.com/images/all_img/qwen-logo-a639.png",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    models: ["qwen-turbo", "qwen-plus", "qwen-max", "qwen-long"],
    color: "#7c3aed",
    website: "https://dashscope.console.aliyun.com",
    description: "阿里通义 · 多模态大模型",
  },
];

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireRole(request, ["admin"]);
  const configs = await db.aIConfig.findMany({ orderBy: { createdAt: "desc" } });
  const masked = configs.map((c) => ({
    ...c,
    apiKey: "••••••••" + c.apiKey.slice(-8),
    lastTestedAt: c.lastTestedAt?.toISOString() ?? null,
    lastTestMs: c.lastTestMs,
  }));
  return { user, configs: masked };
}

export async function action({ request }: Route.ActionArgs) {
  await requireRole(request, ["admin"]);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "create" || intent === "update") {
    const id = formData.get("id") ? Number(formData.get("id")) : null;
    const provider = formData.get("provider") as string;
    const model = formData.get("model") as string;
    const apiKeyRaw = formData.get("apiKey") as string;
    const systemPrompt = formData.get("systemPrompt") as string;
    const baseUrl = formData.get("baseUrl") as string;

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

    if (id) {
      await db.aIConfig.update({
        where: { id },
        data: { provider, model, apiKey, baseUrl: baseUrl || null, systemPrompt: systemPrompt || null },
      });
    } else {
      await db.aIConfig.create({
        data: { provider, model, apiKey, baseUrl: baseUrl || null, systemPrompt: systemPrompt || null },
      });
    }
    return { ok: true, intent };
  }

  if (intent === "activate") {
    const id = Number(formData.get("id"));
    const config = await db.aIConfig.findUnique({ where: { id } });
    if (!config) return { error: "配置不存在", intent: "activate" };
    if (!config.lastTestedAt) return { error: "请先测试连接成功后再启用", intent: "activate" };
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
    if (config.lastTestedAt < thirtyMinAgo) return { error: "测试已过期，请重新测试连接", intent: "activate" };
    await db.aIConfig.updateMany({ data: { isActive: false } });
    await db.aIConfig.update({ where: { id }, data: { isActive: true } });
    return { ok: true, intent: "activate" };
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
      const baseUrl = config.baseUrl || providers.find((p) => p.value === config.provider)?.baseUrl || "";
      const start = Date.now();
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
      const elapsed = Date.now() - start;
      if (!res.ok) {
        const errText = await res.text();
        return { error: `连接失败 (${res.status}): ${errText.slice(0, 100)}` };
      }
      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || "";
      await db.aIConfig.update({ where: { id }, data: { lastTestedAt: new Date(), lastTestMs: elapsed } });
      return { ok: true, intent: "test", elapsed, reply: reply.slice(0, 50) };
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
  const [activeProvider, setActiveProvider] = useState<string | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const isSaving = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      if (fetcher.data.error) {
        toast.error(fetcher.data.error);
      } else if (fetcher.data.ok) {
        if (fetcher.data.intent === "test") {
          const ms = fetcher.data.elapsed;
          const reply = fetcher.data.reply;
          toast.success(`连接成功 · ${ms}ms${reply ? ` · "${reply}"` : ""}`);
        } else if (fetcher.data.intent === "delete") {
          toast.success("配置已删除");
          setDeleteId(null);
        } else {
          toast.success(editId ? "配置已更新" : "配置已创建");
          setEditId(null);
          setShowNewForm(false);
        }
      }
    }
  }, [fetcher.state, fetcher.data, editId]);

  const activeConfig = configs.find((c) => c.isActive);
  const getProviderConfigs = (provider: string) => configs.filter((c) => c.provider === provider);
  const getProviderDef = (value: string) => providers.find((p) => p.value === value);

  const editingConfig = editId ? configs.find((c) => c.id === editId) : null;

  return (
    <AppLayout user={user}>
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">AI 设置</h2>
          <p className="text-xs text-muted-foreground">配置 AI 模型供应商和 API Key，为智能助手提供能力</p>
        </div>
      </div>

      {/* Provider cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        {providers.map((p) => {
          const pConfigs = getProviderConfigs(p.value);
          const hasActive = pConfigs.some((c) => c.isActive);
          const isSelected = activeProvider === p.value || (!activeProvider && editingConfig?.provider === p.value);

          return (
            <button
              key={p.value}
              onClick={() => { setActiveProvider(p.value); setEditId(null); setShowNewForm(false); }}
              className={`relative bg-white dark:bg-slate-900 rounded-xl border-2 p-4 text-left transition-all hover:shadow-md ${
                isSelected
                  ? "border-primary shadow-sm"
                  : "border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700"
              }`}
            >
              {/* Status dot */}
              <div className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full ${
                hasActive ? "bg-emerald-500" : pConfigs.length > 0 ? "bg-amber-400" : "bg-slate-300 dark:bg-slate-600"
              }`} />

              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
                  <img
                    src={p.logo}
                    alt={p.label}
                    className="w-8 h-8 object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white">{p.label}</h3>
                  <p className="text-[10px] text-slate-400">{p.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] text-slate-400">
                  {pConfigs.length > 0 ? `${pConfigs.length} 个配置` : "未配置"}
                </span>
                {hasActive && (
                  <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">· 使用中</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Active provider section */}
      {activeProvider && (() => {
        const pDef = getProviderDef(activeProvider)!;
        const pConfigs = getProviderConfigs(activeProvider);
        const isEditing = editId !== null || showNewForm;

        return (
          <div className="space-y-4 animate-fade-in">
            {/* Existing configs */}
            {pConfigs.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pConfigs.map((config) => (
                  <div
                    key={config.id}
                    className={`bg-white dark:bg-slate-900 rounded-xl border p-4 transition-all ${
                      config.isActive
                        ? "border-emerald-300 dark:border-emerald-700 ring-1 ring-emerald-200 dark:ring-emerald-800"
                        : "border-slate-200/80 dark:border-slate-800/80"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md overflow-hidden bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
                          <img src={pDef.logo} alt="" className="w-5 h-5 object-contain" />
                        </div>
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{config.model}</span>
                        {config.isActive && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                            使用中
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-400 font-mono mb-3">{config.apiKey}</p>

                    <div className="flex items-center gap-1.5">
                      {!config.isActive && (
                        <fetcher.Form method="post">
                          <input type="hidden" name="intent" value="activate" />
                          <input type="hidden" name="id" value={config.id} />
                          <Button type="submit" variant="outline" size="sm" className="h-7 text-[11px]" disabled={isSaving}>
                            <CheckCircle className="size-3" /> 启用
                          </Button>
                        </fetcher.Form>
                      )}
                      <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => { setEditId(config.id); setShowNewForm(false); }}>
                        <Pencil className="size-3" /> 编辑
                      </Button>
                      <fetcher.Form method="post">
                        <input type="hidden" name="intent" value="test" />
                        <input type="hidden" name="id" value={config.id} />
                        <Button type="submit" variant="outline" size="sm" className="h-7 text-[11px]" disabled={isSaving}>
                          <Zap className="size-3" /> 测速
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
                ))}
              </div>
            )}

            {/* Add new config button */}
            {!isEditing && (
              <button
                onClick={() => { setShowNewForm(true); setEditId(null); }}
                className="w-full bg-white dark:bg-slate-900 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 p-5 flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-primary hover:border-primary/40 transition-colors"
              >
                <Plus className="w-4 h-4" />
                添加 {pDef.label} 配置
              </button>
            )}

            {/* Config form */}
            {isEditing && (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800/80 p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-lg overflow-hidden bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
                    <img src={pDef.logo} alt="" className="w-6 h-6 object-contain" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {editId ? "编辑配置" : `添加 ${pDef.label} 配置`}
                  </h3>
                </div>
                <fetcher.Form method="post" className="space-y-4 max-w-lg">
                  <input type="hidden" name="intent" value={editId ? "update" : "create"} />
                  {editId && <input type="hidden" name="id" value={editId} />}
                  <input type="hidden" name="provider" value={activeProvider} />
                  <input type="hidden" name="baseUrl" value={pDef.baseUrl} />

                  <div className="space-y-2">
                    <Label>模型</Label>
                    <Select name="model" defaultValue={editingConfig?.model || pDef.models[0]}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {pDef.models.map((m) => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>API Key</Label>
                    <div className="relative">
                      <Input
                        name="apiKey"
                        type={showApiKey ? "text" : "password"}
                        placeholder={editId ? "留空保持不变" : `输入 ${pDef.label} API Key`}
                        className="font-mono text-sm pr-10"
                        defaultValue={editId ? configs.find((c) => c.id === editId)?.apiKey : ""}
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                      >
                        {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
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
                    <Button type="button" variant="outline" onClick={() => { setEditId(null); setShowNewForm(false); }}>
                      取消
                    </Button>
                    <a
                      href={pDef.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto flex items-center gap-1 text-xs text-slate-400 hover:text-primary transition-colors"
                    >
                      前往 {pDef.label} <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </fetcher.Form>
              </div>
            )}

            {/* Provider info */}
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg overflow-hidden bg-white dark:bg-slate-700 flex items-center justify-center shrink-0">
                <img src={pDef.logo} alt="" className="w-6 h-6 object-contain" />
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
                <p className="font-medium text-slate-700 dark:text-slate-300">{pDef.label}</p>
                <p>Base URL: <code className="text-[11px] bg-slate-100 dark:bg-slate-700 px-1 py-0.5 rounded">{pDef.baseUrl}</code></p>
                <p>支持模型: {pDef.models.join(", ")}</p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* No provider selected */}
      {!activeProvider && !editingConfig && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800/80 p-8 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">点击上方供应商卡片开始配置</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">所有 API Key 均经过 AES-256 加密存储</p>
        </div>
      )}

      {/* Global active indicator */}
      {activeConfig && (
        <div className="mt-6 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-800 p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <div>
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
              当前激活: {getProviderDef(activeConfig.provider)?.label || activeConfig.provider} · {activeConfig.model}
            </p>
            <p className="text-xs text-emerald-600/70 dark:text-emerald-400/50">AI 助手将使用此配置响应请求</p>
          </div>
        </div>
      )}

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
        .animate-fade-in { animation: fade-in 0.3s ease-out both; }
      ` }} />
    </div>
    </AppLayout>
  );
}
