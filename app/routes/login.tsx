import { Form, redirect, useActionData, useNavigation } from "react-router";
import { useRef, useEffect } from "react";
import type { Route } from "./+types/login";
import { login, createUserSession } from "~/lib/auth.server";
import { getUserSession } from "~/lib/auth.server";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Store, AlertCircle, Loader2, BarChart3, Shield, TrendingUp, Truck } from "lucide-react";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getUserSession(request);
  if (user) throw redirect("/dashboard");
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;

  if (!username || !password) {
    return { error: "请输入用户名和密码" };
  }

  const user = await login(username, password);
  if (!user) {
    return { error: "用户名或密码错误" };
  }

  return createUserSession(user.id, "/dashboard");
}

const features = [
  { icon: BarChart3, text: "实时库存监控", desc: "库存变动一目了然" },
  { icon: Shield, text: "多角色权限管理", desc: "店长 / 采购 / 理货 / 收银" },
  { icon: TrendingUp, text: "销售数据分析", desc: "热销排行与趋势洞察" },
  { icon: Truck, text: "采购供应链管理", desc: "供应商到入库全流程" },
];

export default function LoginPage() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    interface Particle {
      x: number; y: number; vx: number; vy: number;
      radius: number; opacity: number;
    }

    const particles: Particle[] = [];
    const count = window.innerWidth < 768 ? 40 : 80;

    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: Math.random() * 1.5 + 0.5,
        opacity: Math.random() * 0.4 + 0.1,
      });
    }

    let animId: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(148, 163, 184, ${p.opacity})`;
        ctx.fill();
      }

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(148, 163, 184, ${0.12 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 relative flex items-center justify-center overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      <div className="absolute inset-0 bg-gradient-to-br from-blue-950/20 via-transparent to-indigo-950/20" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-600/5 blur-[120px] rounded-full" />

      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative z-10 w-full max-w-lg px-6">
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-white/10">
              <Store className="w-6 h-6 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">超市管理系统</h1>
          <p className="text-slate-400 text-sm mt-2">Retail Management Platform</p>
        </div>

        <div
          className="bg-white/[0.05] backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl animate-fade-in"
          style={{ animationDelay: "0.15s" }}
        >
          <h2 className="text-xl font-bold text-white mb-1">欢迎回来</h2>
          <p className="text-sm text-slate-400 mb-4">请输入你的账户信息</p>

          <Form method="post" className="space-y-4">
            {actionData?.error && (
              <Alert variant="destructive" className="bg-red-500/10 border-red-500/20 text-red-400 py-2.5">
                <AlertCircle className="size-4" />
                <AlertDescription>{actionData.error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="username" className="text-slate-300 text-sm font-medium">用户名</Label>
              <Input
                id="username" name="username" type="text" required
                placeholder="请输入用户名"
                className="h-11 bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:bg-white/10 focus:border-white/20"
                autoComplete="username"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300 text-sm font-medium">密码</Label>
              <Input
                id="password" name="password" type="password" required
                placeholder="请输入密码"
                className="h-11 bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:bg-white/10 focus:border-white/20"
                autoComplete="current-password"
              />
            </div>

            <Button
              type="submit" disabled={isSubmitting}
              className="w-full h-11 bg-white text-slate-900 hover:bg-slate-100 font-medium transition-all"
            >
              {isSubmitting ? (
                <><Loader2 className="size-4 animate-spin" /> 登录中...</>
              ) : "登 录"}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-[10px]">
                <span className="bg-transparent px-3 text-slate-500">演示账号</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { role: "店长", user: "admin", pass: "admin123" },
                { role: "采购", user: "purchaser", pass: "123456" },
                { role: "理货员", user: "keeper", pass: "123456" },
                { role: "收银员", user: "cashier", pass: "123456" },
              ].map((d) => (
                <div key={d.role} className="bg-white/[0.03] border border-white/5 rounded-lg px-3 py-2">
                  <p className="text-slate-500 mb-0.5">{d.role}</p>
                  <p className="font-mono text-slate-300 text-[11px]">{d.user} / {d.pass}</p>
                </div>
              ))}
            </div>
          </Form>

          <div className="mt-5 pt-4 border-t border-white/10 grid grid-cols-2 gap-2">
            {features.map(({ icon: Icon, text, desc }) => (
              <div key={text} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.03]">
                <Icon className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] text-slate-300 font-medium truncate">{text}</p>
                  <p className="text-[10px] text-slate-600 truncate">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-[11px] text-slate-700 mt-6 animate-fade-in" style={{ animationDelay: "0.3s" }}>
          &copy; 2026 SuperMarket &middot; v1.0
        </p>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.6s ease-out both;
        }
      ` }} />
    </div>
  );
}
