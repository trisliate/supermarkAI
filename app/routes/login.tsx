import { Form, redirect, useActionData, useNavigation } from "react-router";
import { useRef, useEffect } from "react";
import type { Route } from "./+types/login";
import { login, createUserSession } from "~/lib/auth.server";
import { getUserSession } from "~/lib/auth.server";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Alert, AlertDescription } from "~/components/ui/alert";
import {
  Store,
  AlertCircle,
  Loader2,
  BarChart3,
  Shield,
  TrendingUp,
  Truck,
  Package,
  Users,
  LineChart,
  ShoppingCart,
} from "lucide-react";

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

/* ------------------------------------------------------------------ */
/*  Left-side feature highlights                                       */
/* ------------------------------------------------------------------ */
const features = [
  {
    icon: Package,
    title: "库存监控",
    desc: "实时追踪商品库存，智能预警补货",
  },
  {
    icon: Users,
    title: "多角色权限",
    desc: "店长、采购、理货、收银各司其职",
  },
  {
    icon: LineChart,
    title: "销售分析",
    desc: "多维度报表助力经营决策",
  },
  {
    icon: Truck,
    title: "采购管理",
    desc: "供应商管理与采购流程自动化",
  },
];

/* ------------------------------------------------------------------ */
/*  Right-side metrics / benefits                                      */
/* ------------------------------------------------------------------ */
const metrics = [
  {
    icon: BarChart3,
    value: "30+",
    label: "数据报表",
    desc: "覆盖销售、库存、采购全链路",
  },
  {
    icon: Shield,
    value: "99.9%",
    label: "系统可用性",
    desc: "稳定可靠的服务保障",
  },
  {
    icon: TrendingUp,
    value: "40%",
    label: "效率提升",
    desc: "流程自动化减少人工操作",
  },
  {
    icon: ShoppingCart,
    value: "10000+",
    label: "日处理订单",
    desc: "轻松应对高并发收银场景",
  },
];

export default function LoginPage() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const canvasRef = useRef<HTMLCanvasElement>(null);

  /* Particle animation — full effect in dark mode, subtle in light mode */
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
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      opacity: number;
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

      const darkNow = document.documentElement.classList.contains("dark");
      const particleColor = darkNow ? "148, 163, 184" : "100, 116, 139";
      const lineColor = darkNow ? "148, 163, 184" : "100, 116, 139";

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${particleColor}, ${darkNow ? p.opacity : p.opacity * 0.25})`;
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
            const baseOpacity = darkNow ? 0.12 : 0.04;
            ctx.strokeStyle = `rgba(${lineColor}, ${baseOpacity * (1 - dist / 120)})`;
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
      <div className="absolute inset-0 bg-gradient-to-br from-blue-100/40 via-transparent to-indigo-100/40 dark:from-blue-950/20 dark:via-transparent dark:to-indigo-950/20" />

      {/* ============================================================ */}
      {/*  Three-column layout: left features | center form | right stats */}
      {/* ============================================================ */}
      <div className="relative z-10 flex w-full max-w-7xl items-center justify-center px-4 lg:px-8 gap-8">

        {/* ---------------------------------------------------------- */}
        {/*  Left decorative panel (lg+)                                */}
        {/* ---------------------------------------------------------- */}
        <aside className="hidden lg:flex flex-col gap-5 w-72 xl:w-80 animate-slide-left">
          <div className="mb-2">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
              核心功能
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5">
              全方位超市运营管理
            </p>
          </div>

          {features.map((f, i) => (
            <div
              key={f.title}
              className="group flex items-start gap-3.5 rounded-xl p-3.5
                         bg-white/60 dark:bg-white/[0.03]
                         border border-slate-200/80 dark:border-white/[0.06]
                         backdrop-blur-sm
                         hover:bg-white/80 dark:hover:bg-white/[0.06]
                         hover:border-slate-300 dark:hover:border-white/10
                         transition-all duration-200
                         shadow-sm dark:shadow-none"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div
                className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center
                            bg-blue-50 dark:bg-blue-500/10
                            border border-blue-200/60 dark:border-blue-500/20
                            text-blue-600 dark:text-blue-400
                            group-hover:bg-blue-100 dark:group-hover:bg-blue-500/15
                            transition-colors"
              >
                <f.icon className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  {f.title}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5 leading-relaxed">
                  {f.desc}
                </p>
              </div>
            </div>
          ))}
        </aside>

        {/* ---------------------------------------------------------- */}
        {/*  Center — login form                                        */}
        {/* ---------------------------------------------------------- */}
        <div className="w-full max-w-sm animate-fade-in">
          {/* Logo + Title */}
          <div className="text-center mb-8">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center backdrop-blur-sm mx-auto mb-4
                          bg-slate-100 dark:bg-white/10
                          border border-slate-200 dark:border-white/10"
            >
              <Store className="w-7 h-7 text-slate-700 dark:text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              超市管理系统
            </h1>
            <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">
              Retail Management Platform
            </p>
          </div>

          {/* Login Card */}
          <div
            className="backdrop-blur-xl rounded-2xl p-6 shadow-xl
                        bg-white/70 dark:bg-white/[0.05]
                        border border-slate-200/80 dark:border-white/10
                        shadow-slate-200/50 dark:shadow-2xl"
          >
            <Form method="post" className="space-y-4">
              {actionData?.error && (
                <Alert
                  variant="destructive"
                  className="bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 py-2"
                >
                  <AlertCircle className="size-4" />
                  <AlertDescription>{actionData.error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-1.5">
                <Label
                  htmlFor="username"
                  className="text-slate-500 dark:text-slate-400 text-xs"
                >
                  用户名
                </Label>
                <Input
                  id="username"
                  name="username"
                  type="text"
                  required
                  placeholder="请输入用户名"
                  className="h-10
                             bg-white/80 dark:bg-white/5
                             border-slate-200 dark:border-white/10
                             text-slate-900 dark:text-white
                             placeholder:text-slate-400 dark:placeholder:text-slate-600
                             focus:bg-white dark:focus:bg-white/10
                             focus:border-slate-300 dark:focus:border-white/20"
                  autoComplete="username"
                />
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="password"
                  className="text-slate-500 dark:text-slate-400 text-xs"
                >
                  密码
                </Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  placeholder="请输入密码"
                  className="h-10
                             bg-white/80 dark:bg-white/5
                             border-slate-200 dark:border-white/10
                             text-slate-900 dark:text-white
                             placeholder:text-slate-400 dark:placeholder:text-slate-600
                             focus:bg-white dark:focus:bg-white/10
                             focus:border-slate-300 dark:focus:border-white/20"
                  autoComplete="current-password"
                />
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-10 font-medium
                           bg-slate-900 dark:bg-white
                           text-white dark:text-slate-900
                           hover:bg-slate-800 dark:hover:bg-slate-100"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> 登录中...
                  </>
                ) : (
                  "登 录"
                )}
              </Button>

              {/* Demo accounts */}
              <div className="pt-2">
                <p className="text-center text-[10px] text-slate-400 dark:text-slate-600 mb-2">
                  演示账号
                </p>
                <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                  {[
                    { role: "店长", user: "admin", pass: "admin123" },
                    { role: "采购", user: "purchaser", pass: "123456" },
                    { role: "理货员", user: "keeper", pass: "123456" },
                    { role: "收银员", user: "cashier", pass: "123456" },
                  ].map((d) => (
                    <div
                      key={d.role}
                      className="rounded px-2 py-1.5
                                 bg-slate-50 dark:bg-white/[0.03]
                                 border border-slate-100 dark:border-transparent"
                    >
                      <span className="text-slate-500 dark:text-slate-500">
                        {d.role}
                      </span>
                      <span className="font-mono text-slate-700 dark:text-slate-400 ml-1">
                        {d.user}/{d.pass}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Form>
          </div>

          <p className="text-center text-[10px] text-slate-400 dark:text-slate-700 mt-6">
            &copy; 2026 SuperMarket
          </p>
        </div>

        {/* ---------------------------------------------------------- */}
        {/*  Right decorative panel (lg+)                               */}
        {/* ---------------------------------------------------------- */}
        <aside className="hidden lg:flex flex-col gap-5 w-72 xl:w-80 animate-slide-right">
          <div className="mb-2">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
              为什么选择我们
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5">
              数据驱动的智慧零售
            </p>
          </div>

          {metrics.map((m, i) => (
            <div
              key={m.label}
              className="group flex items-start gap-3.5 rounded-xl p-3.5
                         bg-white/60 dark:bg-white/[0.03]
                         border border-slate-200/80 dark:border-white/[0.06]
                         backdrop-blur-sm
                         hover:bg-white/80 dark:hover:bg-white/[0.06]
                         hover:border-slate-300 dark:hover:border-white/10
                         transition-all duration-200
                         shadow-sm dark:shadow-none"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div
                className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center
                            bg-emerald-50 dark:bg-emerald-500/10
                            border border-emerald-200/60 dark:border-emerald-500/20
                            text-emerald-600 dark:text-emerald-400
                            group-hover:bg-emerald-100 dark:group-hover:bg-emerald-500/15
                            transition-colors"
              >
                <m.icon className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-base font-bold text-slate-800 dark:text-slate-100">
                    {m.value}
                  </span>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {m.label}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5 leading-relaxed">
                  {m.desc}
                </p>
              </div>
            </div>
          ))}
        </aside>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.6s ease-out both;
        }
        @keyframes slide-left {
          from { opacity: 0; transform: translateX(-24px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes slide-right {
          from { opacity: 0; transform: translateX(24px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-slide-left {
          animation: slide-left 0.7s ease-out both;
        }
        .animate-slide-right {
          animation: slide-right 0.7s ease-out both;
        }
      `,
        }}
      />
    </div>
  );
}
