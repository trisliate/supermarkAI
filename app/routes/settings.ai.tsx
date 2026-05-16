import { useFetcher } from "react-router";
import { useState, useEffect } from "react";
import type { Route } from "./+types/settings.ai";
import { requireRole } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { AppLayout } from "~/components/layout/app-layout";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "~/components/ui/dialog";
import {
  Loader2, Zap, CheckCircle, ExternalLink, Trash2, Pencil, Plus,
  Eye, EyeOff, Wifi, WifiOff, Clock, Bot, Globe, Server, Cpu,
  Sparkles, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "~/lib/utils";

interface ProviderDef {
  value: string;
  label: string;
  logo: string;
  icon: typeof Bot;
  baseUrl: string;
  models: string[];
  color: string;
  bgClass: string;
  borderClass: string;
  website: string;
  description: string;
  defaultProtocol: "openai" | "anthropic";
}

const providers: ProviderDef[] = [
  {
    value: "deepseek",
    label: "DeepSeek",
    logo: "https://s1.aigei.com/src/img/png/03/0305d15156154b85a80848ae4edd22ab.png?imageMogr2/auto-orient/thumbnail/!282x282r/gravity/Center/crop/282x282/quality/85/%7CimageView2/2/w/282&e=2051020800&token=P7S2Xpzfz11vAkASLTkfHN7Fw-oOZBecqeJaxypL:eFZ0GvEP17SkCu1zdapd0tTtlTw=",
    icon: Cpu,
    baseUrl: "https://api.deepseek.com/v1/chat/completions",
    models: ["deepseek-v4-flash", "deepseek-v4-pro", "deepseek-reasoner"],
    color: "text-blue-600",
    bgClass: "bg-blue-50 dark:bg-blue-950/30",
    borderClass: "border-blue-200 dark:border-blue-800",
    website: "https://platform.deepseek.com",
    description: "高性价比推理模型",
    defaultProtocol: "openai",
  },
  {
    value: "openai",
    label: "OpenAI",
    logo: "https://cdn.worldvectorlogo.com/logos/openai-2.svg",
    icon: Sparkles,
    baseUrl: "https://api.openai.com/v1/chat/completions",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
    color: "text-emerald-600",
    bgClass: "bg-emerald-50 dark:bg-emerald-950/30",
    borderClass: "border-emerald-200 dark:border-emerald-800",
    website: "https://platform.openai.com",
    description: "GPT 系列模型",
    defaultProtocol: "openai",
  },
  {
    value: "anthropic",
    label: "Anthropic",
    logo: "https://ts4.tc.mm.bing.net/th/id/OIP-C.4h_PSQu0OZy9Q3NL0rHlowHaHa?rs=1&pid=ImgDetMain&o=7&rm=3",
    icon: Bot,
    baseUrl: "https://api.anthropic.com/v1/messages",
    models: ["claude-sonnet-4-20250514", "claude-haiku-4-20250414", "claude-3-5-sonnet-20241022"],
    color: "text-amber-600",
    bgClass: "bg-amber-50 dark:bg-amber-950/30",
    borderClass: "border-amber-200 dark:border-amber-800",
    website: "https://console.anthropic.com",
    description: "Claude 系列模型",
    defaultProtocol: "anthropic",
  },
  {
    value: "mimo",
    label: "MiMo",
    logo: "https://tse1-mm.cn.bing.net/th/id/OIP-C.exWGUuviU0ymMhb1OBiUNwHaD4?o=7rm=3&rs=1&pid=ImgDetMain&o=7&rm=3",
    icon: Zap,
    baseUrl: "https://token-plan-sgp.xiaomimimo.com/anthropic/v1/messages",
    models: ["mimo-v2.5", "mimo-v2.5-pro"],
    color: "text-orange-600",
    bgClass: "bg-orange-50 dark:bg-orange-950/30",
    borderClass: "border-orange-200 dark:border-orange-800",
    website: "https://github.com/XiaomiMiMo/MiMo",
    description: "小米轻量高效模型",
    defaultProtocol: "anthropic",
  },
  {
    value: "qwen",
    label: "通义千问",
    logo: "https://freepnglogo.com/images/all_img/qwen-logo-a639.png",
    icon: Globe,
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    models: ["qwen-turbo", "qwen-plus", "qwen-max", "qwen-long"],
    color: "text-violet-600",
    bgClass: "bg-violet-50 dark:bg-violet-950/30",
    borderClass: "border-violet-200 dark:border-violet-800",
    website: "https://dashscope.console.aliyun.com",
    description: "阿里多模态大模型",
    defaultProtocol: "openai",
  },
];

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireRole(request, ["admin"]);
  const { loadRoutePermissions } = await import("~/lib/permissions.server");
  const routePermissions = await loadRoutePermissions();
  const configs = await db.aIConfig.findMany({ orderBy: { createdAt: "desc" } });
  const masked = configs.map((c) => ({
    ...c,
    apiKey: "••••••••" + c.apiKey.slice(-8),
    lastTestedAt: c.lastTestedAt?.toISOString() ?? null,
    lastTestMs: c.lastTestMs,
    lastTestOk: c.lastTestOk,
  }));
  return { user, configs: masked, routePermissions };
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
    const { encrypt: enc } = await import("~/lib/crypto.server");
    if (apiKeyRaw.startsWith("••••••••")) {
      if (!id) return { error: "请输入 API Key" };
      const existing = await db.aIConfig.findUnique({ where: { id } });
      if (!existing) return { error: "配置不存在" };
      const isEncrypted = existing.apiKey.split(":").length === 3 && existing.apiKey.split(":").every((p: string) => /^[0-9a-f]+$/i.test(p));
      apiKey = isEncrypted ? existing.apiKey : enc(existing.apiKey);
    } else {
      apiKey = enc(apiKeyRaw);
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
      const { decrypt } = await import("~/lib/crypto.server");
      const decryptedKey = decrypt(config.apiKey);
      const baseUrl = config.baseUrl || pDef?.baseUrl || "";
      const start = Date.now();

      let res: Response;
      if (protocol === "anthropic") {
        res = await fetch(baseUrl, {
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
        res = await fetch(baseUrl, {
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
        await db.aIConfig.update({ where: { id }, data: { lastTestedAt: new Date(), lastTestMs: null, lastTestOk: false } });
        return { error: `连接失败 (${res.status}): ${errText.slice(0, 200)}` };
      }
      const data = await res.json();
      let reply = "";
      if (protocol === "anthropic") {
        reply = data.content?.[0]?.text || "";
      } else {
        reply = data.choices?.[0]?.message?.content || "";
      }
      await db.aIConfig.update({ where: { id }, data: { lastTestedAt: new Date(), lastTestMs: elapsed, lastTestOk: true } });
      return { ok: true, intent: "test", elapsed, reply: reply.slice(0, 50) };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { error: `连接错误: ${message}` };
    }
  }

  return { error: "未知操作" };
}

function getLatencyInfo(ms: number | null, ok?: boolean | null) {
  if (ok === false) return { label: "异常", color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/30", Icon: WifiOff };
  if (ms === null) return { label: "未测试", color: "text-slate-400", bg: "bg-slate-50 dark:bg-slate-800/50", Icon: WifiOff };
  if (ms < 1000) return { label: "优", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/30", Icon: Wifi };
  if (ms < 3000) return { label: "良", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/30", Icon: Wifi };
  return { label: "差", color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/30", Icon: Wifi };
}

function getProviderDef(value: string) {
  return providers.find((p) => p.value === value);
}

export default function SettingsAIPage({ loaderData }: Route.ComponentProps) {
  const { user, configs } = loaderData;
  const fetcher = useFetcher();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);

  // Form state
  const [formProvider, setFormProvider] = useState("");
  const [formModel, setFormModel] = useState("");
  const [formProtocol, setFormProtocol] = useState<"openai" | "anthropic">("openai");
  const [formBaseUrl, setFormBaseUrl] = useState("");
  const [formCustomProvider, setFormCustomProvider] = useState("");

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
        } else if (fetcher.data.intent === "activate") {
          toast.success("已切换激活配置");
        } else {
          toast.success(editId ? "配置已更新" : "配置已创建");
          setEditId(null);
          setDialogOpen(false);
        }
      }
    }
  }, [fetcher.state, fetcher.data, editId]);

  const activeConfig = configs.find((c) => c.isActive);

  function openCreateDialog(providerValue?: string) {
    const pv = providerValue || "deepseek";
    const pDef = getProviderDef(pv);
    setEditId(null);
    setFormProvider(pv);
    setFormModel(pDef?.models[0] || "");
    setFormProtocol(pDef?.defaultProtocol || "openai");
    setFormBaseUrl("");
    setFormCustomProvider("");
    setShowApiKey(false);
    setDialogOpen(true);
  }

  function openEditDialog(config: typeof configs[0]) {
    setEditId(config.id);
    setFormProvider(config.provider);
    setFormModel(config.model);
    setFormProtocol((config.protocol as "openai" | "anthropic") || "openai");
    setFormBaseUrl(config.baseUrl || "");
    setFormCustomProvider(providers.some((p) => p.value === config.provider) ? "" : config.provider);
    setShowApiKey(false);
    setDialogOpen(true);
  }

  const isCustom = formProvider === "custom";
  const currentPDef = formProvider ? getProviderDef(formProvider) : null;
  const allModels = currentPDef?.models || [];

  // Group configs by provider, sorted by: has configs first, then by name
  const providerGroups = providers
    .map((p) => ({
      ...p,
      configs: configs.filter((c) => c.provider === p.value),
    }))
    .sort((a, b) => {
      if (a.configs.length > 0 && b.configs.length === 0) return -1;
      if (a.configs.length === 0 && b.configs.length > 0) return 1;
      return 0;
    });
  const customConfigs = configs.filter((c) => !providers.some((p) => p.value === c.provider));

  return (
    <AppLayout user={user} routePermissions={loaderData.routePermissions} description="配置 AI 模型供应商和 API Key">
      <div className="space-y-6 animate-fade-in">

        {/* Active config banner */}
        {activeConfig ? (
          <Card className={cn("border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20")}>
            <CardContent className="py-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0">
                <CheckCircle className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                  当前激活: {getProviderDef(activeConfig.provider)?.label || activeConfig.provider} · {activeConfig.model}
                </p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                  AI 助手正在使用此配置
                </p>
              </div>
              {(() => {
                const h = getLatencyInfo(activeConfig.lastTestMs, activeConfig.lastTestOk);
                return (
                  <Badge variant="outline" className={cn("gap-1 shrink-0", h.color, h.bg)}>
                    <h.Icon className="size-3" />
                    {h.label}
                    {activeConfig.lastTestMs !== null && ` · ${activeConfig.lastTestMs}ms`}
                  </Badge>
                );
              })()}
            </CardContent>
          </Card>
        ) : (
          <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
            <CardContent className="py-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">未配置 AI 模型</p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">请添加并激活一个 AI 配置以启用智能助手功能</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Provider sections */}
        {providerGroups.map((group) => {
          const Icon = group.icon;
          return (
            <div key={group.value}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className={cn("w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center", group.bgClass)}>
                    <img src={group.logo} alt="" className="w-6 h-6 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; (e.target as HTMLImageElement).parentElement!.querySelector('.fallback-icon')!.classList.remove('hidden'); }} />
                    <Icon className={cn("w-4 h-4 fallback-icon hidden", group.color)} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">{group.label}</h3>
                    <p className="text-[11px] text-muted-foreground">{group.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a href={group.website} target="_blank" rel="noopener noreferrer" className="text-[11px] text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-0.5">
                    官网 <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                  <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => openCreateDialog(group.value)}>
                    <Plus className="size-3" /> 添加
                  </Button>
                </div>
              </div>

              {group.configs.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {group.configs.map((config) => {
                    const health = getLatencyInfo(config.lastTestMs, config.lastTestOk);
                    return (
                      <Card key={config.id} className={cn(
                        "transition-all",
                        config.isActive
                          ? "border-emerald-300 dark:border-emerald-700 ring-1 ring-emerald-200 dark:ring-emerald-800"
                          : "hover:border-slate-300 dark:hover:border-slate-600"
                      )}>
                        <CardContent className="p-4 space-y-3">
                          {/* Header */}
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-sm font-semibold font-mono">{config.model}</p>
                              <div className="flex items-center gap-1.5 mt-1">
                                {config.isActive && (
                                  <Badge variant="default" className="text-[10px] px-1.5 py-0">使用中</Badge>
                                )}
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                                  {config.protocol || "openai"}
                                </Badge>
                              </div>
                            </div>
                            <div className={cn("flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg", health.bg, health.color)}>
                              <health.Icon className="size-3" />
                              {health.label}
                            </div>
                          </div>

                          {/* API Key */}
                          <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground bg-slate-50 dark:bg-slate-800/50 rounded-lg px-2.5 py-1.5">
                            <span className="truncate">{config.apiKey}</span>
                          </div>

                          {/* Meta */}
                          {config.lastTestedAt && (
                            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Clock className="size-2.5" />
                              上次测试: {new Date(config.lastTestedAt).toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                              {config.lastTestMs !== null && ` · ${config.lastTestMs}ms`}
                            </p>
                          )}

                          {/* Actions */}
                          <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
                            {!config.isActive && (
                              <fetcher.Form method="post">
                                <input type="hidden" name="intent" value="activate" />
                                <input type="hidden" name="id" value={config.id} />
                                <Button type="submit" variant="outline" size="sm" className="h-7 text-[11px]" disabled={isSaving}>
                                  <CheckCircle className="size-3" /> 启用
                                </Button>
                              </fetcher.Form>
                            )}
                            <fetcher.Form method="post">
                              <input type="hidden" name="intent" value="test" />
                              <input type="hidden" name="id" value={config.id} />
                              <Button type="submit" variant="outline" size="sm" className="h-7 text-[11px]" disabled={isSaving}>
                                <Zap className="size-3" /> 测试
                              </Button>
                            </fetcher.Form>
                            <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => openEditDialog(config)}>
                              <Pencil className="size-3" /> 编辑
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive ml-auto"
                              onClick={() => setDeleteId(config.id)}
                              disabled={isSaving}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <div className="border border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-6 text-center">
                  <p className="text-xs text-muted-foreground">暂无 {group.label} 配置</p>
                </div>
              )}
            </div>
          );
        })}

        {/* Custom providers */}
        {customConfigs.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <Server className="w-4 h-4 text-slate-500" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">自定义供应商</h3>
                  <p className="text-[11px] text-muted-foreground">自由配置任何 AI 供应商</p>
                </div>
              </div>
              <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => { setFormProvider("custom"); openCreateDialog(); }}>
                <Plus className="size-3" /> 添加
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {customConfigs.map((config) => {
                const health = getLatencyInfo(config.lastTestMs, config.lastTestOk);
                return (
                  <Card key={config.id} className={cn(
                    "transition-all",
                    config.isActive
                      ? "border-emerald-300 dark:border-emerald-700 ring-1 ring-emerald-200 dark:ring-emerald-800"
                      : "hover:border-slate-300 dark:hover:border-slate-600"
                  )}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-semibold font-mono">{config.model}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            {config.isActive && <Badge variant="default" className="text-[10px] px-1.5 py-0">使用中</Badge>}
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{config.provider}</Badge>
                          </div>
                        </div>
                        <div className={cn("flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg", health.bg, health.color)}>
                          <health.Icon className="size-3" />
                          {health.label}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground bg-slate-50 dark:bg-slate-800/50 rounded-lg px-2.5 py-1.5">
                        <span className="truncate">{config.apiKey}</span>
                      </div>
                      <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
                        {!config.isActive && (
                          <fetcher.Form method="post">
                            <input type="hidden" name="intent" value="activate" />
                            <input type="hidden" name="id" value={config.id} />
                            <Button type="submit" variant="outline" size="sm" className="h-7 text-[11px]" disabled={isSaving}>
                              <CheckCircle className="size-3" /> 启用
                            </Button>
                          </fetcher.Form>
                        )}
                        <fetcher.Form method="post">
                          <input type="hidden" name="intent" value="test" />
                          <input type="hidden" name="id" value={config.id} />
                          <Button type="submit" variant="outline" size="sm" className="h-7 text-[11px]" disabled={isSaving}>
                            <Zap className="size-3" /> 测试
                          </Button>
                        </fetcher.Form>
                        <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => openEditDialog(config)}>
                          <Pencil className="size-3" /> 编辑
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive ml-auto"
                          onClick={() => setDeleteId(config.id)}
                          disabled={isSaving}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Security note */}
        <p className="text-center text-[11px] text-muted-foreground pt-2">
          所有 API Key 均经过 AES-256-GCM 加密存储，不会明文保存
        </p>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); setEditId(null); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? "编辑配置" : "添加 AI 配置"}</DialogTitle>
            <DialogDescription>
              {editId ? "修改当前 AI 模型配置" : "配置新的 AI 模型供应商"}
            </DialogDescription>
          </DialogHeader>
          <fetcher.Form method="post" className="space-y-4">
            <input type="hidden" name="intent" value={editId ? "update" : "create"} />
            {editId && <input type="hidden" name="id" value={editId} />}
            <input type="hidden" name="provider" value={isCustom ? formCustomProvider : formProvider} />
            <input type="hidden" name="protocol" value={formProtocol} />
            <input type="hidden" name="baseUrl" value={formBaseUrl || currentPDef?.baseUrl || ""} />
            <input type="hidden" name="model" value={formModel === "__custom__" ? "" : formModel} />

            {/* Provider select */}
            <div className="space-y-1.5">
              <Label>供应商</Label>
              <Select value={formProvider} onValueChange={(v) => {
                if (!v) return;
                setFormProvider(v);
                const p = getProviderDef(v);
                if (p) {
                  setFormModel(p.models[0]);
                  setFormProtocol(p.defaultProtocol);
                  setFormBaseUrl("");
                }
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {providers.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label} — {p.description}</SelectItem>
                  ))}
                  <SelectItem value="custom">自定义供应商</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isCustom && (
              <div className="space-y-1.5">
                <Label>供应商名称</Label>
                <Input value={formCustomProvider} onChange={(e) => setFormCustomProvider(e.target.value)} placeholder="例如: my-llm" />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>协议</Label>
                <Select value={formProtocol} onValueChange={(v) => { if (v) setFormProtocol(v as "openai" | "anthropic"); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI Compatible</SelectItem>
                    <SelectItem value="anthropic">Anthropic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>模型</Label>
                {allModels.length > 0 ? (
                  <Select value={formModel} onValueChange={(v) => { if (v) setFormModel(v); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {allModels.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                      <SelectItem value="__custom__">自定义模型...</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={formModel} onChange={(e) => setFormModel(e.target.value)} placeholder="模型名称" className="font-mono text-xs" />
                )}
              </div>
            </div>

            {formModel === "__custom__" && (
              <div className="space-y-1.5">
                <Label>自定义模型名称</Label>
                <Input value="" onChange={(e) => setFormModel(e.target.value)} placeholder="输入模型名称" className="font-mono text-xs" />
              </div>
            )}

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
                <button type="button" onClick={() => setShowApiKey(!showApiKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Base URL <span className="text-muted-foreground font-normal">(可选)</span></Label>
              <Input
                value={formBaseUrl}
                onChange={(e) => setFormBaseUrl(e.target.value)}
                placeholder={currentPDef?.baseUrl || "https://api.example.com/v1"}
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label>系统提示词 <span className="text-muted-foreground font-normal">(可选)</span></Label>
              <Textarea
                name="systemPrompt"
                placeholder="自定义 AI 助手的行为和角色..."
                className="min-h-[80px] text-sm"
                defaultValue={editId ? configs.find((c) => c.id === editId)?.systemPrompt || "" : ""}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={isSaving} className="flex-1">
                {isSaving ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                {editId ? "更新配置" : "添加配置"}
              </Button>
              <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); setEditId(null); }}>
                取消
              </Button>
            </div>
          </fetcher.Form>
        </DialogContent>
      </Dialog>

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
    </AppLayout>
  );
}
