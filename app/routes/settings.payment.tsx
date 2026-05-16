import { useFetcher } from "react-router";
import { useState, useRef, useCallback } from "react";
import type { Route } from "./+types/settings.payment";
import { requireRole } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { AppLayout } from "~/components/layout/app-layout";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Loader2, CheckCircle, CreditCard, QrCode, Save, Upload, X, Smartphone, Building2, Crop } from "lucide-react";

type PaymentMode = "personal" | "sdk";

interface CropState {
  provider: string;
  image: string;
  fileName: string;
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireRole(request, ["admin"]);
  const { loadRoutePermissions } = await import("~/lib/permissions.server");
  const routePermissions = await loadRoutePermissions();

  const configs = await db.paymentConfig.findMany();
  const mode = configs.length > 0 && configs.some((c) => c.appId) ? "sdk" : "personal";

  // Check if personal QR codes exist
  const fs = await import("fs");
  const wechatExists = fs.existsSync("public/payments/wechat-qr.png");
  const alipayExists = fs.existsSync("public/payments/alipay-qr.png");

  return {
    user,
    mode,
    personalQr: { wechat: wechatExists, alipay: alipayExists },
    routePermissions,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireRole(request, ["admin"]);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "save-personal") {
    const fs = await import("fs");
    const path = await import("path");

    const qrDir = path.join(process.cwd(), "public", "payments");
    if (!fs.existsSync(qrDir)) {
      fs.mkdirSync(qrDir, { recursive: true });
    }

    for (const provider of ["wechat", "alipay"]) {
      const file = formData.get(`${provider}-qr`) as File | null;
      if (file && file.size > 0) {
        const buffer = Buffer.from(await file.arrayBuffer());
        fs.writeFileSync(path.join(qrDir, `${provider}-qr.png`), buffer);
      }

      const remove = formData.get(`${provider}-remove`);
      if (remove === "true") {
        const filePath = path.join(qrDir, `${provider}-qr.png`);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
    }

    return { success: true, message: "收款码已保存" };
  }

  if (intent === "save-sdk") {
    const provider = formData.get("provider") as string;
    const data: Record<string, any> = { provider };

    const fields = ["appId", "mchId", "apiKey", "certData", "notifyUrl"];
    for (const key of fields) {
      const value = formData.get(key) as string;
      if (value) {
        if (key === "apiKey" || key === "certData") {
          const { encrypt } = await import("~/lib/crypto.server");
          data[key] = encrypt(value);
        } else {
          data[key] = value;
        }
      }
    }

    const existing = await db.paymentConfig.findUnique({ where: { provider } });
    if (existing) {
      await db.paymentConfig.update({ where: { id: existing.id }, data });
    } else {
      await db.paymentConfig.create({ data: data as any });
    }

    return { success: true, message: `${provider === "wechat" ? "微信" : "支付宝"}SDK配置已保存` };
  }

  return { error: "未知操作" };
}

// Simple image cropper component
function ImageCropper({
  imageSrc,
  fileName,
  onCrop,
  onCancel,
}: {
  imageSrc: string;
  fileName: string;
  onCrop: (blob: Blob) => void;
  onCancel: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [cropReady, setCropReady] = useState(false);

  const handleCrop = useCallback(() => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;

    const size = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - size) / 2;
    const sy = (img.naturalHeight - size) / 2;

    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(img, sx, sy, size, size, 0, 0, 400, 400);
    canvas.toBlob((blob) => {
      if (blob) onCrop(blob);
    }, "image/png");
  }, [onCrop]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-5 w-[420px]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">裁剪收款码 - {fileName}</h3>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground mb-3">将自动居中裁剪为正方形，建议上传清晰的二维码图片</p>
        <div className="w-full aspect-square bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden flex items-center justify-center mb-4">
          <img
            ref={imgRef}
            src={imageSrc}
            alt="预览"
            className="max-w-full max-h-full object-contain"
            onLoad={() => setCropReady(true)}
          />
        </div>
        <canvas ref={canvasRef} className="hidden" />
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onCancel}>取消</Button>
          <Button className="flex-1" onClick={handleCrop} disabled={!cropReady}>
            <Crop className="w-4 h-4 mr-1.5" />
            确认裁剪
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function PaymentSettingsPage({ loaderData }: Route.ComponentProps) {
  const { user, mode: initialMode, personalQr } = loaderData;
  const fetcher = useFetcher();
  const isSaving = fetcher.state === "submitting";

  const [mode, setMode] = useState<PaymentMode>(initialMode as PaymentMode);
  const [qrImages, setQrImages] = useState<Record<string, string | null>>({
    wechat: personalQr.wechat ? "/payments/wechat-qr.png" : null,
    alipay: personalQr.alipay ? "/payments/alipay-qr.png" : null,
  });
  const [removedQr, setRemovedQr] = useState<Set<string>>(new Set());
  const [cropState, setCropState] = useState<CropState | null>(null);
  const [croppedFiles, setCroppedFiles] = useState<Record<string, File>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleFileSelect = (provider: string, file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setCropState({ provider, image: e.target?.result as string, fileName: file.name });
    };
    reader.readAsDataURL(file);
  };

  const handleCropDone = (blob: Blob) => {
    if (!cropState) return;
    const file = new File([blob], `${cropState.provider}-qr.png`, { type: "image/png" });
    setCroppedFiles((prev) => ({ ...prev, [cropState.provider]: file }));
    setQrImages((prev) => ({ ...prev, [cropState.provider]: URL.createObjectURL(blob) }));
    setRemovedQr((prev) => { const next = new Set(prev); next.delete(cropState.provider); return next; });
    setCropState(null);
  };

  const handleRemoveQr = (provider: string) => {
    setQrImages((prev) => ({ ...prev, [provider]: null }));
    setRemovedQr((prev) => new Set(prev).add(provider));
    setCroppedFiles((prev) => { const next = { ...prev }; delete next[provider]; return next; });
  };

  const handleSavePersonal = () => {
    const fd = new FormData();
    fd.set("intent", "save-personal");
    for (const [provider, file] of Object.entries(croppedFiles)) {
      fd.set(`${provider}-qr`, file);
    }
    for (const provider of removedQr) {
      fd.set(`${provider}-remove`, "true");
    }
    fetcher.submit(fd, { method: "post", encType: "multipart/form-data" });
  };

  const hasPersonalChanges = Object.keys(croppedFiles).length > 0 || removedQr.size > 0;

  return (
    <AppLayout user={user} routePermissions={loaderData.routePermissions} description="配置收款方式">
      <div className="space-y-6">
        {/* Success/Error */}
        {(fetcher.data as any)?.success && (
          <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400 px-4 py-2.5 rounded-lg">
            <CheckCircle className="size-4" />
            {(fetcher.data as any).message}
          </div>
        )}
        {(fetcher.data as any)?.error && (
          <div className="text-sm text-red-600 bg-red-50 dark:bg-red-950/30 dark:text-red-400 px-4 py-2.5 rounded-lg">
            {(fetcher.data as any).error}
          </div>
        )}

        {/* Mode selector */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setMode("personal")}
            className={`rounded-xl border-2 p-4 text-left transition-all ${
              mode === "personal"
                ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
                : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${mode === "personal" ? "bg-blue-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"}`}>
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">个人收款码</p>
                <p className="text-[11px] text-muted-foreground">上传微信/支付宝个人收款码</p>
              </div>
            </div>
            <p className="text-[11px] text-slate-400">适合无商户资质的场景，收银员手动确认收款</p>
          </button>

          <button
            type="button"
            onClick={() => setMode("sdk")}
            className={`rounded-xl border-2 p-4 text-left transition-all ${
              mode === "sdk"
                ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
                : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${mode === "sdk" ? "bg-blue-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"}`}>
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">商户SDK</p>
                <p className="text-[11px] text-muted-foreground">配置微信/支付宝商户API</p>
              </div>
            </div>
            <p className="text-[11px] text-slate-400">需要商户资质，支持自动回调确认支付</p>
          </button>
        </div>

        {/* Personal QR Code Mode */}
        {mode === "personal" && (
          <div className="space-y-4">
            {["wechat", "alipay"].map((provider) => {
              const label = provider === "wechat" ? "微信支付" : "支付宝";
              const color = provider === "wechat" ? "green" : "blue";
              const qrImage = qrImages[provider];

              return (
                <div key={provider} className="bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <QrCode className={`w-4 h-4 text-${color}-500`} />
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{label}收款码</span>
                    </div>
                    {qrImage && (
                      <Button variant="ghost" size="sm" onClick={() => handleRemoveQr(provider)} className="text-xs text-red-500 hover:text-red-600">
                        <X className="w-3 h-3 mr-1" /> 移除
                      </Button>
                    )}
                  </div>

                  {qrImage ? (
                    <div className="flex items-center gap-4">
                      <div className="w-28 h-28 rounded-xl border-2 border-slate-200 dark:border-slate-700 overflow-hidden bg-white flex items-center justify-center">
                        <img
                          src={`${qrImage}${croppedFiles[provider] ? "" : `?t=${Date.now()}`}`}
                          alt={`${label}收款码`}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="flex-1 space-y-2">
                        <p className="text-xs text-emerald-600 dark:text-emerald-400">已配置</p>
                        <p className="text-[11px] text-muted-foreground">收银时将展示此收款码供顾客扫码</p>
                        <label className="cursor-pointer">
                          <span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                            <Upload className="w-3 h-3" /> 更换图片
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            ref={(el) => { fileInputRefs.current[provider] = el; }}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileSelect(provider, file);
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/10 transition-colors">
                      <Upload className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" />
                      <p className="text-sm text-slate-500">点击上传{label}收款码</p>
                      <p className="text-[11px] text-slate-400 mt-1">支持 JPG、PNG，将自动裁剪为正方形</p>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        ref={(el) => { fileInputRefs.current[provider] = el; }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileSelect(provider, file);
                        }}
                      />
                    </label>
                  )}
                </div>
              );
            })}

            <div className="flex justify-end">
              <Button onClick={handleSavePersonal} disabled={isSaving || !hasPersonalChanges}>
                {isSaving ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <Save className="size-4 mr-1.5" />}
                保存收款码
              </Button>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4">
              <p className="text-xs text-amber-700 dark:text-amber-400 font-medium mb-1">使用说明</p>
              <ul className="text-[11px] text-amber-600 dark:text-amber-500 space-y-1">
                <li>• 上传你的微信/支付宝个人收款码图片</li>
                <li>• 收银时顾客扫码后，收银员需在手机上确认到账</li>
                <li>• 确认到账后，点击「确认收款」完成结算</li>
              </ul>
            </div>
          </div>
        )}

        {/* SDK Mode */}
        {mode === "sdk" && (
          <div className="space-y-4">
            {[
              {
                value: "wechat", label: "微信支付", color: "green",
                fields: [
                  { key: "appId", label: "AppID", placeholder: "微信公众号或小程序的 AppID", required: true },
                  { key: "mchId", label: "商户号", placeholder: "微信支付商户号 (mch_id)", required: true },
                  { key: "apiKey", label: "APIv3 密钥", placeholder: "32 位 APIv3 密钥", required: true },
                  { key: "certData", label: "商户证书", placeholder: "apiclient_key.pem 内容", required: true, textarea: true },
                  { key: "notifyUrl", label: "回调地址", placeholder: "https://yourdomain.com/api/payment" },
                ],
              },
              {
                value: "alipay", label: "支付宝", color: "blue",
                fields: [
                  { key: "appId", label: "AppID", placeholder: "支付宝开放平台 AppID", required: true },
                  { key: "apiKey", label: "应用私钥", placeholder: "应用私钥 (PKCS1 或 PKCS8)", required: true },
                  { key: "notifyUrl", label: "回调地址", placeholder: "https://yourdomain.com/api/payment" },
                ],
              },
            ].map((provider) => (
              <div key={provider.value} className="bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{provider.label} SDK</span>
                </div>
                <div className="p-4 space-y-3">
                  {provider.fields.map((field) => (
                    <div key={field.key} className="space-y-1">
                      <Label className="text-xs">
                        {field.label}
                        {field.required && <span className="text-red-500 ml-0.5">*</span>}
                      </Label>
                      {field.textarea ? (
                        <textarea
                          placeholder={field.placeholder}
                          rows={3}
                          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary/20 outline-none font-mono"
                        />
                      ) : (
                        <Input
                          type={field.key === "apiKey" ? "password" : "text"}
                          placeholder={field.placeholder}
                          className="h-9 text-sm"
                        />
                      )}
                    </div>
                  ))}
                  <div className="flex justify-end pt-2">
                    <Button size="sm">
                      <Save className="size-4 mr-1.5" />
                      保存{provider.label}配置
                    </Button>
                  </div>
                </div>
              </div>
            ))}

            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/50 rounded-xl p-4">
              <p className="text-xs text-blue-700 dark:text-blue-400 font-medium mb-1">商户SDK说明</p>
              <ul className="text-[11px] text-blue-600 dark:text-blue-500 space-y-1">
                <li>• 需要已开通微信支付/支付宝商户账号</li>
                <li>• 配置后系统将自动生成支付二维码</li>
                <li>• 支付结果通过回调自动确认，无需人工操作</li>
                <li>• API密钥和证书将加密存储</li>
              </ul>
            </div>
          </div>
        )}

        {/* Crop modal */}
        {cropState && (
          <ImageCropper
            imageSrc={cropState.image}
            fileName={cropState.fileName}
            onCrop={handleCropDone}
            onCancel={() => setCropState(null)}
          />
        )}
      </div>
    </AppLayout>
  );
}
