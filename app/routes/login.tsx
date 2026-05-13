import { Form, redirect, useActionData, useNavigation } from "react-router";
import { useRef, useEffect } from "react";
import type { Route } from "./+types/login";
import { login, createUserSession, getUserSession } from "~/lib/auth.server";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Store, AlertCircle, Loader2, Package, Users, Truck, BarChart3, ShieldCheck, Zap, Brain, Cpu, Sparkles, Bot, Activity, Network } from "lucide-react";

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
  { icon: Brain, label: "AI 智能助手", desc: "自然语言查询、智能分析决策", anim: "animate-[float-1_5s_ease-in-out_infinite]", style: "top-[8%] left-[6%]" },
  { icon: Users, label: "多角色协作", desc: "店长、采购、理货、收银各司其职", anim: "animate-[float-2_6s_ease-in-out_infinite_0.3s]", style: "top-[18%] right-[8%]" },
  { icon: Activity, label: "数据驱动", desc: "销售趋势、库存预警一目了然", anim: "animate-[float-3_7s_ease-in-out_infinite_0.8s]", style: "bottom-[30%] left-[4%]" },
  { icon: Cpu, label: "智能补货", desc: "AI 预测销量、自动生成采购建议", anim: "animate-[float-4_5.5s_ease-in-out_infinite_1.2s]", style: "bottom-[12%] right-[6%]" },
];

const aiOrbs = [
  { anim: "animate-[orb-1_8s_ease-in-out_infinite]", style: "top-[35%] left-[15%]", size: "w-3 h-3", color: "bg-blue-400" },
  { anim: "animate-[orb-2_10s_ease-in-out_infinite_1s]", style: "top-[60%] right-[12%]", size: "w-2.5 h-2.5", color: "bg-cyan-400" },
  { anim: "animate-[orb-3_7s_ease-in-out_infinite_2s]", style: "top-[15%] left-[35%]", size: "w-2 h-2", color: "bg-indigo-400" },
  { anim: "animate-[orb-4_9s_ease-in-out_infinite_0.5s]", style: "bottom-[25%] left-[25%]", size: "w-3.5 h-3.5", color: "bg-violet-400" },
  { anim: "animate-[orb-5_6s_ease-in-out_infinite_1.5s]", style: "top-[45%] right-[25%]", size: "w-2 h-2", color: "bg-emerald-400" },
  { anim: "animate-[orb-6_11s_ease-in-out_infinite_0.8s]", style: "bottom-[40%] right-[30%]", size: "w-2.5 h-2.5", color: "bg-amber-400" },
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
        @keyframes float-1 { 0%,100%{transform:translateY(0) rotate(-8deg) scale(1)} 25%{transform:translateY(-18px) rotate(-3deg) scale(1.03)} 50%{transform:translateY(-24px) rotate(2deg) scale(1.05)} 75%{transform:translateY(-10px) rotate(-5deg) scale(1.02)} }
        @keyframes float-2 { 0%,100%{transform:translateY(0) rotate(5deg) scale(1)} 30%{transform:translateY(-20px) rotate(8deg) scale(1.04)} 60%{transform:translateY(-28px) rotate(0deg) scale(1.06)} 80%{transform:translateY(-8px) rotate(3deg) scale(1.01)} }
        @keyframes float-3 { 0%,100%{transform:translateY(0) rotate(3deg) scale(1)} 35%{transform:translateY(-22px) rotate(-2deg) scale(1.05)} 65%{transform:translateY(-30px) rotate(6deg) scale(1.07)} 85%{transform:translateY(-6px) rotate(1deg) scale(1.02)} }
        @keyframes float-4 { 0%,100%{transform:translateY(0) rotate(-5deg) scale(1)} 20%{transform:translateY(-15px) rotate(-8deg) scale(1.03)} 50%{transform:translateY(-26px) rotate(3deg) scale(1.06)} 70%{transform:translateY(-12px) rotate(-2deg) scale(1.02)} }
        @keyframes orb-1 { 0%,100%{transform:translate(0,0) scale(1);opacity:0.4} 25%{transform:translate(30px,-40px) scale(1.5);opacity:0.8} 50%{transform:translate(-20px,-60px) scale(0.8);opacity:0.3} 75%{transform:translate(40px,-20px) scale(1.3);opacity:0.7} }
        @keyframes orb-2 { 0%,100%{transform:translate(0,0) scale(1);opacity:0.3} 33%{transform:translate(-40px,30px) scale(1.8);opacity:0.9} 66%{transform:translate(20px,-50px) scale(0.6);opacity:0.2} }
        @keyframes orb-3 { 0%,100%{transform:translate(0,0) scale(1);opacity:0.5} 20%{transform:translate(50px,20px) scale(1.2);opacity:0.7} 40%{transform:translate(-30px,-40px) scale(0.9);opacity:0.3} 60%{transform:translate(20px,50px) scale(1.6);opacity:0.8} 80%{transform:translate(-40px,10px) scale(0.7);opacity:0.4} }
        @keyframes orb-4 { 0%,100%{transform:translate(0,0) scale(1);opacity:0.6} 50%{transform:translate(-50px,-30px) scale(1.4);opacity:0.9} }
        @keyframes orb-5 { 0%,100%{transform:translate(0,0) scale(1);opacity:0.3} 25%{transform:translate(-20px,40px) scale(1.7);opacity:0.8} 50%{transform:translate(30px,20px) scale(0.5);opacity:0.2} 75%{transform:translate(-10px,-30px) scale(1.3);opacity:0.6} }
        @keyframes orb-6 { 0%,100%{transform:translate(0,0) scale(1);opacity:0.4} 30%{transform:translate(40px,-20px) scale(1.5);opacity:0.8} 60%{transform:translate(-30px,40px) scale(0.7);opacity:0.3} }
        @keyframes pulse-ring { 0%{transform:scale(1);opacity:0.6} 100%{transform:scale(2.5);opacity:0} }
        @keyframes spin-slow { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
      ` }} />

      {/* AI orbs - glowing floating particles */}
      <div className="hidden md:block">
        {aiOrbs.map((orb, i) => (
          <div
            key={i}
            className={`absolute ${orb.style} ${orb.anim} ${orb.size} ${orb.color} rounded-full blur-[2px] pointer-events-none will-change-transform`}
          />
        ))}
      </div>

      {/* Scattered decorative module cards */}
      <div className="hidden lg:block">
        {modules.map((m) => (
          <div
            key={m.label}
            className={`absolute ${m.style} ${m.anim} bg-white/60 dark:bg-white/[0.04] backdrop-blur-sm rounded-3xl p-4 border border-slate-200/50 dark:border-white/[0.06] w-48 pointer-events-none select-none will-change-transform`}
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
          <div className="relative inline-flex items-center justify-center mb-5">
            {/* Pulse rings */}
            <div className="absolute w-14 h-14 rounded-2xl bg-blue-500/20 animate-[pulse-ring_2s_ease-out_infinite]" />
            <div className="absolute w-14 h-14 rounded-2xl bg-blue-500/20 animate-[pulse-ring_2s_ease-out_infinite_0.5s]" />
            {/* Spinning outer ring */}
            <div className="absolute w-20 h-20 rounded-full border border-dashed border-blue-300/30 dark:border-blue-500/20 animate-[spin-slow_12s_linear_infinite]" />
            <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 dark:from-white dark:to-slate-200 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Store className="w-7 h-7 text-white dark:text-slate-900" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">SuperMarket</h1>
          <div className="flex items-center justify-center gap-1.5 mt-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
            <p className="text-sm text-slate-500 dark:text-slate-400">AI 驱动的智慧超市运营管理平台</p>
            <Sparkles className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-200/80 dark:border-slate-800">
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
                placeholder="请输入用户名" className="h-10 dark:bg-slate-800"
                autoComplete="username"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-medium text-slate-600 dark:text-slate-300">密码</Label>
              <Input
                id="password" name="password" type="password" required
                placeholder="请输入密码" className="h-10 dark:bg-slate-800"
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
                { role: "店长", user: "admin", pass: "admin123", icon: ShieldCheck, color: "text-amber-600 bg-amber-50 dark:bg-amber-950/20 dark:text-amber-400", ai: "全功能 + AI 助手" },
                { role: "采购", user: "purchaser", pass: "123456", icon: Package, color: "text-blue-600 bg-blue-50 dark:bg-blue-950/20 dark:text-blue-400", ai: "智能补货建议" },
                { role: "理货员", user: "keeper", pass: "123456", icon: Zap, color: "text-teal-600 bg-teal-50 dark:bg-teal-950/20 dark:text-teal-400", ai: "库存预警" },
                { role: "收银员", user: "cashier", pass: "123456", icon: BarChart3, color: "text-purple-600 bg-purple-50 dark:bg-purple-950/20 dark:text-purple-400", ai: "热销分析" },
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
                  className="flex items-center gap-2.5 p-2.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-sm transition-all text-left group"
                >
                  <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${d.color} group-hover:scale-110 transition-transform`}>
                    <d.icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{d.role}</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">{d.user}</p>
                  </div>
                  <div className="ml-auto shrink-0">
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      {d.ai}
                    </span>
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
