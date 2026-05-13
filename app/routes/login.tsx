import { Form, redirect, useActionData, useNavigation } from "react-router";
import { useRef, useEffect } from "react";
import type { Route } from "./+types/login";
import { login, createUserSession, getUserSession } from "~/lib/auth.server";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Store, AlertCircle, Loader2, Package, Users, Truck, BarChart3, ShieldCheck, Zap } from "lucide-react";

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

const modules = [
  { icon: Package, label: "商品与库存", desc: "实时库存监控、智能预警补货", anim: "animate-[float-1_6s_ease-in-out_infinite]", style: "top-[12%] left-[8%]" },
  { icon: Users, label: "多角色协作", desc: "店长、采购、理货、收银各司其职", anim: "animate-[float-2_7s_ease-in-out_infinite_0.5s]", style: "top-[22%] right-[10%]" },
  { icon: Truck, label: "供应链管理", desc: "供应商管理与采购流程自动化", anim: "animate-[float-3_8s_ease-in-out_infinite_1s]", style: "bottom-[28%] left-[5%]" },
  { icon: BarChart3, label: "数据驱动", desc: "销售趋势、分类分布一目了然", anim: "animate-[float-4_5s_ease-in-out_infinite_1.5s]", style: "bottom-[15%] right-[8%]" },
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
      x: number; y: number; vx: number; vy: number; r: number; o: number;
    }

    const particles: Particle[] = [];
    const count = window.innerWidth < 768 ? 30 : 60;
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 1.5 + 0.5,
        o: Math.random() * 0.3 + 0.05,
      });
    }

    let animId: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const dark = document.documentElement.classList.contains("dark");
      const c = dark ? "148, 163, 184" : "100, 116, 139";

      for (const p of particles) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${c}, ${dark ? p.o : p.o * 0.2})`;
        ctx.fill();
      }

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 100) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(${c}, ${(dark ? 0.1 : 0.03) * (1 - d / 100)})`;
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 relative flex items-center justify-center overflow-hidden transition-colors">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* Floating animation keyframes */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes float-1 { 0%,100%{transform:translateY(0) rotate(-6deg)} 50%{transform:translateY(-12px) rotate(-4deg)} }
        @keyframes float-2 { 0%,100%{transform:translateY(0) rotate(3deg)} 50%{transform:translateY(-10px) rotate(5deg)} }
        @keyframes float-3 { 0%,100%{transform:translateY(0) rotate(2deg)} 50%{transform:translateY(-14px) rotate(0deg)} }
        @keyframes float-4 { 0%,100%{transform:translateY(0) rotate(-3deg)} 50%{transform:translateY(-8px) rotate(-5deg)} }
      ` }} />

      {/* Scattered decorative module cards */}
      <div className="hidden lg:block">
        {modules.map((m) => (
          <div
            key={m.label}
            className={`absolute ${m.style} ${m.anim} bg-white/60 dark:bg-white/[0.04] backdrop-blur-sm rounded-2xl p-4 border border-slate-200/50 dark:border-white/[0.06] w-48 pointer-events-none select-none will-change-transform`}
          >
            <m.icon className="w-5 h-5 text-slate-400 dark:text-white/50 mb-2" />
            <p className="text-sm font-medium text-slate-700 dark:text-white/80 mb-0.5">{m.label}</p>
            <p className="text-[11px] text-slate-400 dark:text-white/30 leading-relaxed">{m.desc}</p>
          </div>
        ))}
      </div>

      {/* Centered login card */}
      <div className="relative z-10 w-full max-w-sm mx-4">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-slate-900 dark:bg-white flex items-center justify-center mx-auto mb-4 shadow-lg shadow-slate-900/10 dark:shadow-white/10">
            <Store className="w-7 h-7 text-white dark:text-slate-900" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">SuperMarket</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">智慧超市运营管理平台</p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-200/80 dark:border-slate-800">
          <Form method="post" className="space-y-4">
            {actionData?.error && (
              <Alert variant="destructive" className="py-2">
                <AlertCircle className="size-4" />
                <AlertDescription>{actionData.error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-xs font-medium text-slate-600 dark:text-slate-300">用户名</Label>
              <Input
                id="username" name="username" type="text" required
                placeholder="请输入用户名" className="h-10"
                autoComplete="username"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-medium text-slate-600 dark:text-slate-300">密码</Label>
              <Input
                id="password" name="password" type="password" required
                placeholder="请输入密码" className="h-10"
                autoComplete="current-password"
              />
            </div>

            <Button type="submit" disabled={isSubmitting} className="w-full h-10 font-medium">
              {isSubmitting ? <><Loader2 className="size-4 animate-spin" /> 登录中...</> : "登 录"}
            </Button>
          </Form>

          <div className="mt-5 pt-5 border-t border-slate-100 dark:border-slate-800">
            <p className="text-[10px] text-center text-slate-400 dark:text-slate-500 mb-3 uppercase tracking-wider">演示账号</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { role: "店长", user: "admin", pass: "admin123", icon: ShieldCheck, color: "text-amber-600 bg-amber-50 dark:bg-amber-950/20 dark:text-amber-400" },
                { role: "采购", user: "purchaser", pass: "123456", icon: Package, color: "text-blue-600 bg-blue-50 dark:bg-blue-950/20 dark:text-blue-400" },
                { role: "理货员", user: "keeper", pass: "123456", icon: Zap, color: "text-teal-600 bg-teal-50 dark:bg-teal-950/20 dark:text-teal-400" },
                { role: "收银员", user: "cashier", pass: "123456", icon: BarChart3, color: "text-purple-600 bg-purple-50 dark:bg-purple-950/20 dark:text-purple-400" },
              ].map((d) => (
                <button
                  key={d.role}
                  type="button"
                  onClick={() => {
                    const form = document.querySelector("form");
                    if (!form) return;
                    const userInput = form.querySelector<HTMLInputElement>('[name="username"]');
                    const passInput = form.querySelector<HTMLInputElement>('[name="password"]');
                    if (userInput) userInput.value = d.user;
                    if (passInput) passInput.value = d.pass;
                  }}
                  className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600 transition-colors text-left"
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${d.color}`}>
                    <d.icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{d.role}</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">{d.user}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-[11px] text-slate-300 dark:text-slate-700 mt-6">&copy; 2026 SuperMarket</p>
      </div>
    </div>
  );
}
