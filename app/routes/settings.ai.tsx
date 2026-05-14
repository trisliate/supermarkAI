import { useFetcher } from "react-router";
import { useState, useEffect, useCallback } from "react";
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
import { Loader2, Zap, CheckCircle, ExternalLink, Trash2, Pencil, Plus, Eye, EyeOff, Settings, Server, Code, Wifi, WifiOff, Clock } from "lucide-react";
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
  defaultProtocol: "openai" | "anthropic";
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
    defaultProtocol: "openai",
  },
  {
    value: "openai",
    label: "OpenAI",
    logo: "https://cdn.worldvectorlogo.com/logos/openai-2.svg",
    baseUrl: "https://api.openai.com/v1",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
    color: "#10a37f",
    website: "https://platform.openai.com",
    description: "OpenAI · GPT 系列模型",
    defaultProtocol: "openai",
  },
  {
    value: "anthropic",
    label: "Anthropic",
    logo: "https://ts4.tc.mm.bing.net/th/id/OIP-C.4h_PSQu0OZy9Q3NL0rHlowHaHa?rs=1&pid=ImgDetMain&o=7&rm=3",
    baseUrl: "https://api.anthropic.com",
    models: ["claude-sonnet-4-20250514", "claude-haiku-4-20250414", "claude-3-5-sonnet-20241022"],
    color: "#d97706",
    website: "https://console.anthropic.com",
    description: "Anthropic · Claude 系列模型",
    defaultProtocol: "anthropic",
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
    defaultProtocol: "anthropic",
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
    defaultProtocol: "openai",
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
    const protocol = (formData.get("protocol") as string) || "openai";

    if (!provider || !model || (!apiKeyRaw && !id)) {
      return { error: "请填写所有必填字段" };
    }

    let apiKey: string;
    if (apiKeyRaw.startsWith("••••••••")) {
      if (!id) return { error: "请输入 API Key" };
      const existing = await db.aIConfig.findUnique({ where: { id } });
      if (!existing) return { error: "配置不存在" };
      // Re-encrypt if stored key is plain text (not in iv:tag:ciphertext format)
      const isEncrypted = existing.apiKey.split(":").length === 3 && existing.apiKey.split(":").every((p: string) => /^[0-9a-f]+$/i.test(p));
      apiKey = isEncrypted ? existing.apiKey : encrypt(existing.apiKey);
    } else {
      apiKey = encrypt(apiKeyRaw);
    }

    if (id) {
      await db.aIConfig.update({
        where: { id },
        data: { provider, model, apiKey, baseUrl: baseUrl || null, protocol, systemPrompt: systemPrompt || null },
      });
    } else {
      await db.aIConfig.create({
        data: { provider, model, apiKey, baseUrl: baseUrl || null, protocol, systemPrompt: systemPrompt || null },
      });
    }
    return { ok: true, intent };
  }

  if (intent === "activate") {
    const id = Number(formData.get("id"));
    const config = await db.aIConfig.findUnique({ where: { id } });
    if (!config) return { error: "配置不存在", intent: "activate" };
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

    const pDef = providers.find((p) => p.value === config.provider);
    const protocol = config.protocol || pDef?.defaultProtocol || "openai";

    try {
      const decryptedKey = decrypt(config.apiKey);
      const baseUrl = config.baseUrl || pDef?.baseUrl || "";
      const start = Date.now();

      let res: Response;
      if (protocol === "anthropic") {
        res = await fetch(`${baseUrl}/v1/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": decryptedKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: config.model,
            messages: [{ role: "user", content: "你好" }],
            max_tokens: 10,
          }),
        });
      } else {
        res = await fetch(`${baseUrl}/chat/completions`, {
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
      }

      const elapsed = Date.now() - start;
      if (!res.ok) {
        const errText = await res.text();
        return { error: `连接失败 (${res.status}): ${errText.slice(0, 200)}` };
      }
      const data = await res.json();
      let reply = "";
      if (protocol === "anthropic") {
        reply = data.content?.[0]?.text || "";
      } else {
        reply = data.choices?.[0]?.message?.content || "";
      }
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
  const [customBaseUrl, setCustomBaseUrl] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [protocol, setProtocol] = useState<"openai" | "anthropic">("openai");
  const [customProviderName, setCustomProviderName] = useState("");
  const [jsonConfig, setJsonConfig] = useState("");
  const [jsonMode, setJsonMode] = useState(false);
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
          setJsonConfig("");
          setCustomBaseUrl("");
          setCustomModel("");
          setCustomProviderName("");
        }
      }
    }
  }, [fetcher.state, fetcher.data, editId]);

  const activeConfig = configs.find((c) => c.isActive);
  const getProviderConfigs = (provider: string) => configs.filter((c) => c.provider === provider);
  const getProviderDef = (value: string) => providers.find((p) => p.value === value);

  const editingConfig = editId ? configs.find((c) => c.id === editId) : null;

  // Sync form state to JSON
  const formToJson = useCallback(() => {
    const pDef = activeProvider ? getProviderDef(activeProvider) : null;
    const obj: Record<string, string> = {
      provider: activeProvider || "",
      model: customModel || pDef?.models[0] || "",
      protocol,
      baseUrl: customBaseUrl || pDef?.baseUrl || "",
    };
    if (customProviderName) obj.customProviderName = customProviderName;
    setJsonConfig(JSON.stringify(obj, null, 2));
  }, [activeProvider, customModel, protocol, customBaseUrl, customProviderName]);

  // Parse JSON to form
  const jsonToForm = useCallback((json: string) => {
    try {
      const parsed = JSON.parse(json);
      if (parsed.provider && parsed.provider !== "custom") {
        setActiveProvider(parsed.provider);
        const pDef = getProviderDef(parsed.provider);
        if (pDef) {
          setProtocol((parsed.protocol as "openai" | "anthropic") || pDef.defaultProtocol);
          setCustomBaseUrl(parsed.baseUrl || "");
          setCustomModel(parsed.model || "");
        }
      } else if (parsed.provider === "custom") {
        setActiveProvider("custom");
        setCustomProviderName(parsed.customProviderName || "");
        setProtocol((parsed.protocol as "openai" | "anthropic") || "openai");
        setCustomBaseUrl(parsed.baseUrl || "");
        setCustomModel(parsed.model || "");
      }
    } catch {
      // ignore parse errors while typing
    }
  }, []);

  const isCustom = activeProvider === "custom";
  const pDef = activeProvider ? getProviderDef(activeProvider) : null;
  const allModels = pDef?.models || [];

  function getLatencyHealth(ms: number | null): { label: string; color: string; Icon: typeof Wifi } {
    if (ms === null) return { label: "未测试", color: "text-slate-400", Icon: WifiOff };
    if (ms < 1000) return { label: "优", color: "text-emerald-600 dark:text-emerald-400", Icon: Wifi };
    if (ms < 3000) return { label: "良", color: "text-amber-600 dark:text-amber-400", Icon: Wifi };
    return { label: "差", color: "text-red-600 dark:text-red-400", Icon: Wifi };
  }

  return (
    <AppLayout user={user} description="配置 AI 模型供应商和 API Key">
    <div className="animate-fade-in h-full flex flex-col">

      {/* Top: provider cards */}
      <div className="flex gap-2 pb-4 overflow-x-auto shrink-0">
        {[...providers, { value: "custom", label: "自定义", logo: "", baseUrl: "", models: [], color: "#6b7280", website: "", description: "自由配置任何供应商", defaultProtocol: "openai" as const }].map((p) => {
          const pConfigs = p.value === "custom" ? configs.filter((c) => !providers.some((pp) => pp.value === c.provider)) : getProviderConfigs(p.value);
          const hasActive = pConfigs.some((c) => c.isActive);
          const isSelected = activeProvider === p.value;

          return (
            <button
              key={p.value}
              onClick={() => { setActiveProvider(p.value); setEditId(null); setShowNewForm(false); setJsonConfig(""); setCustomBaseUrl(""); setCustomModel(""); setCustomProviderName(""); if (p.value !== "custom") setProtocol(p.defaultProtocol); }}
              className={`relative flex items-center gap-2.5 px-4 py-2.5 rounded-xl border-2 transition-all whitespace-nowrap shrink-0 ${
                isSelected
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900"
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${hasActive ? "bg-emerald-500" : pConfigs.length > 0 ? "bg-amber-400" : "bg-slate-300 dark:bg-slate-600"}`} />
              {p.value === "custom" ? (
                <Server className="w-4 h-4 text-slate-500" />
              ) : (
                <div className="w-6 h-6 rounded overflow-hidden bg-slate-50 dark:bg-slate-800 flex items-center justify-center shrink-0">
                  <img src={p.logo} alt="" className="w-5 h-5 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                </div>
              )}
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{p.label}</span>
              {pConfigs.length > 0 && (
                <span className="text-[10px] text-slate-400">{pConfigs.length}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main content */}
      {activeProvider ? (
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left: existing configs list */}
          <div className="lg:col-span-1 space-y-3 overflow-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {isCustom ? "自定义配置" : `${pDef?.label || ""} 配置`}
              </h3>
              {!showNewForm && !editId && (
                <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => { setShowNewForm(true); setEditId(null); setJsonConfig(""); setCustomBaseUrl(""); setCustomModel(""); }}>
                  <Plus className="size-3" /> 新增
                </Button>
              )}
            </div>

            {/* Config cards */}
            {(isCustom ? configs.filter((c) => !providers.some((pp) => pp.value === c.provider)) : getProviderConfigs(activeProvider)).map((config) => {
              return (
                <div
                  key={config.id}
                  className={`rounded-xl border p-3 transition-all ${
                    config.isActive
                      ? "border-emerald-300 dark:border-emerald-700 ring-1 ring-emerald-200 dark:ring-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20"
                      : "border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{config.model}</span>
                    {config.isActive && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">使用中</span>
                    )}
                    {(() => {
                      const health = getLatencyHealth(config.lastTestMs);
                      return (
                        <span className={`flex items-center gap-0.5 text-[10px] font-medium ${health.color} ml-auto`}>
                          <health.Icon className="size-3" />
                          {health.label}
                          {config.lastTestMs !== null && <span className="text-slate-400 font-normal">({config.lastTestMs}ms)</span>}
                        </span>
                      );
                    })()}
                  </div>
                  <p className="text-[10px] text-slate-400 font-mono mb-1.5">{config.apiKey}</p>
                  {config.lastTestedAt && (
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mb-1.5 flex items-center gap-1">
                      <Clock className="size-3" />
                      上次测试: {new Date(config.lastTestedAt).toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  )}
                  <div className="flex items-center gap-1">
                    {!config.isActive && (
                      <fetcher.Form method="post">
                        <input type="hidden" name="intent" value="activate" />
                        <input type="hidden" name="id" value={config.id} />
                        <Button type="submit" variant="outline" size="sm" className="h-6 text-[10px] px-2" disabled={isSaving}>
                          <CheckCircle className="size-2.5" /> 启用
                        </Button>
                      </fetcher.Form>
                    )}
                    <Button variant="outline" size="sm" className="h-6 text-[10px] px-2" onClick={() => { setEditId(config.id); setShowNewForm(false); setJsonConfig(""); setCustomBaseUrl(config.baseUrl || ""); setCustomModel(config.model); setProtocol((config.protocol as "openai" | "anthropic") || "openai"); }}>
                      <Pencil className="size-2.5" /> 编辑
                    </Button>
                    <fetcher.Form method="post">
                      <input type="hidden" name="intent" value="test" />
                      <input type="hidden" name="id" value={config.id} />
                      <Button type="submit" variant="outline" size="sm" className="h-6 text-[10px] px-2" disabled={isSaving}>
                        <Zap className="size-2.5" /> 测速
                      </Button>
                    </fetcher.Form>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:text-destructive ml-auto" onClick={() => setDeleteId(config.id)} disabled={isSaving}>
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </div>
              );
            })}

            {(isCustom ? configs.filter((c) => !providers.some((pp) => pp.value === c.provider)) : getProviderConfigs(activeProvider)).length === 0 && !showNewForm && !editId && (
              <p className="text-xs text-slate-400 text-center py-4">暂无配置，点击"新增"添加</p>
            )}

            {/* Provider info */}
            {pDef && (
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                <p className="font-medium text-slate-700 dark:text-slate-300">{pDef.label}</p>
                <p>Base URL: <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">{pDef.baseUrl}</code></p>
                <p>模型: {pDef.models.join(", ")}</p>
                <a href={pDef.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                  前往官网 <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
            )}
          </div>

          {/* Right: config form */}
          <div className="lg:col-span-2 overflow-auto">
            {(showNewForm || editId) ? (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {editId ? "编辑配置" : "新增配置"}
                  </h3>
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
                    <button onClick={() => setJsonMode(false)} className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${!jsonMode ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm" : "text-slate-500"}`}>
                      <Settings className="size-3 inline mr-1" /> 表单
                    </button>
                    <button onClick={() => { setJsonMode(true); formToJson(); }} className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${jsonMode ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm" : "text-slate-500"}`}>
                      <Code className="size-3 inline mr-1" /> JSON
                    </button>
                  </div>
                </div>

                {!jsonMode ? (
                  /* Visual form */
                  <fetcher.Form method="post" className="space-y-4">
                    <input type="hidden" name="intent" value={editId ? "update" : "create"} />
                    {editId && <input type="hidden" name="id" value={editId} />}
                    <input type="hidden" name="provider" value={isCustom ? customProviderName : activeProvider} />
                    <input type="hidden" name="protocol" value={protocol} />
                    <input type="hidden" name="baseUrl" value={customBaseUrl || pDef?.baseUrl || ""} />

                    {isCustom && (
                      <div className="space-y-1.5">
                        <Label>供应商名称</Label>
                        <Input value={customProviderName} onChange={(e) => setCustomProviderName(e.target.value)} placeholder="例如: my-llm-provider" />
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label>协议</Label>
                        <Select value={protocol} onValueChange={(v) => setProtocol(v as "openai" | "anthropic")}>
                          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="openai">OpenAI Compatible</SelectItem>
                            <SelectItem value="anthropic">Anthropic</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>模型</Label>
                        {allModels.length > 0 ? (
                          <div className="space-y-1">
                            <Select value={customModel || allModels[0]} onValueChange={(v) => setCustomModel(v ?? "")}>
                              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {allModels.map((m) => (
                                  <SelectItem key={m} value={m}>{m}</SelectItem>
                                ))}
                                <SelectItem value="__custom__">自定义模型...</SelectItem>
                              </SelectContent>
                            </Select>
                            {customModel === "__custom__" && (
                              <Input value="" onChange={(e) => setCustomModel(e.target.value)} placeholder="输入模型名称" className="font-mono text-xs" />
                            )}
                          </div>
                        ) : (
                          <Input value={customModel} onChange={(e) => setCustomModel(e.target.value)} placeholder="输入模型名称" className="font-mono text-xs" />
                        )}
                        <input type="hidden" name="model" value={customModel === "__custom__" ? "" : customModel} />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label>API Key</Label>
                      <div className="relative">
                        <Input
                          name="apiKey"
                          type={showApiKey ? "text" : "password"}
                          placeholder={editId ? "留空保持不变" : "输入 API Key"}
                          className="font-mono text-sm pr-10"
                          defaultValue={editId ? configs.find((c) => c.id === editId)?.apiKey : ""}
                        />
                        <button type="button" onClick={() => setShowApiKey(!showApiKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                          {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label>Base URL</Label>
                      <Input
                        value={customBaseUrl}
                        onChange={(e) => setCustomBaseUrl(e.target.value)}
                        placeholder={pDef?.baseUrl || "https://api.example.com/v1"}
                        className="font-mono text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label>系统提示词 <span className="text-muted-foreground font-normal">(可选)</span></Label>
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
                      <Button type="button" variant="outline" onClick={() => { setEditId(null); setShowNewForm(false); setJsonConfig(""); setCustomBaseUrl(""); setCustomModel(""); setCustomProviderName(""); }}>
                        取消
                      </Button>
                    </div>
                  </fetcher.Form>
                ) : (
                  /* JSON editor */
                  <div className="space-y-4">
                    <Textarea
                      value={jsonConfig}
                      onChange={(e) => { setJsonConfig(e.target.value); jsonToForm(e.target.value); }}
                      className="min-h-[320px] font-mono text-xs"
                      placeholder={`{\n  "provider": "deepseek",\n  "model": "deepseek-v4-flash",\n  "protocol": "openai",\n  "baseUrl": "https://api.deepseek.com/v1",\n  "apiKey": "sk-xxx"\n}`}
                    />
                    <p className="text-[10px] text-slate-400">支持 provider, baseUrl, apiKey, model, protocol, systemPrompt, customProviderName 字段</p>
                    <Button
                      type="button"
                      disabled={isSaving}
                      onClick={() => {
                        try {
                          const parsed = JSON.parse(jsonConfig);
                          const fd = new FormData();
                          fd.set("intent", editId ? "update" : "create");
                          if (editId) fd.set("id", String(editId));
                          fd.set("provider", parsed.provider === "custom" ? (parsed.customProviderName || "custom") : (parsed.provider || activeProvider || ""));
                          fd.set("model", parsed.model || "");
                          fd.set("apiKey", parsed.apiKey || "");
                          fd.set("baseUrl", parsed.baseUrl || "");
                          fd.set("protocol", parsed.protocol || "openai");
                          fd.set("systemPrompt", parsed.systemPrompt || "");
                          fetcher.submit(fd, { method: "post" });
                        } catch {
                          toast.error("JSON 格式错误");
                        }
                      }}
                    >
                      {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
                      {editId ? "更新配置" : "添加配置"}
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              /* Empty state */
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <Settings className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm">选择左侧配置进行编辑，或点击"新增"添加配置</p>
                <p className="text-xs mt-1">所有 API Key 均经过 AES-256 加密存储</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
          <Server className="w-12 h-12 mb-3 opacity-30" />
          <p className="text-sm">点击上方供应商卡片开始配置</p>
          <p className="text-xs mt-1">支持 OpenAI Compatible 和 Anthropic 两种协议</p>
        </div>
      )}

      {/* Global active indicator */}
      {activeConfig && (() => {
        const health = getLatencyHealth(activeConfig.lastTestMs);
        return (
          <div className="mt-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-800 p-3 flex items-center gap-3 shrink-0">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <p className="text-xs text-emerald-700 dark:text-emerald-300">
              当前激活: <span className="font-medium">{getProviderDef(activeConfig.provider)?.label || activeConfig.provider}</span> · {activeConfig.model}
            </p>
            <div className={`flex items-center gap-1 text-[11px] font-medium ${health.color} ml-auto`}>
              <health.Icon className="size-3.5" />
              {health.label}
              {activeConfig.lastTestMs !== null && <span className="text-slate-400 font-normal">{activeConfig.lastTestMs}ms</span>}
            </div>
          </div>
        );
      })()}

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
    </div>
    </AppLayout>
  );
}
