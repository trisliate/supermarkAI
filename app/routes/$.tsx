import { Link, useNavigate } from "react-router";
import { useEffect, useRef } from "react";
import { Home, ArrowLeft, Store, Sparkles } from "lucide-react";

export default function NotFoundPage() {
  const navigate = useNavigate();
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
    const count = window.innerWidth < 768 ? 20 : 40;
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
        r: Math.random() * 1.5 + 0.5,
        o: Math.random() * 0.2 + 0.05,
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
            ctx.strokeStyle = `rgba(${c}, ${(dark ? 0.08 : 0.02) * (1 - d / 100)})`;
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
        @keyframes float-404 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-20px)} }
        @keyframes pulse-ring { 0%{transform:scale(1);opacity:0.6} 100%{transform:scale(2.5);opacity:0} }
        @keyframes spin-slow { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
        @keyframes fade-in-up { 0%{opacity:0;transform:translateY(20px)} 100%{opacity:1;transform:translateY(0)} }
      ` }} />

      <div className="relative z-10 text-center px-4 max-w-lg mx-4">
        {/* Logo icon */}
        <div className="relative inline-flex items-center justify-center mb-8">
          <div className="absolute w-14 h-14 rounded-2xl bg-blue-500/20 animate-[pulse-ring_2s_ease-out_infinite]" />
          <div className="absolute w-14 h-14 rounded-2xl bg-blue-500/20 animate-[pulse-ring_2s_ease-out_infinite_0.5s]" />
          <div className="absolute w-20 h-20 rounded-full border border-dashed border-blue-300/30 dark:border-blue-500/20 animate-[spin-slow_12s_linear_infinite]" />
          <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 dark:from-white dark:to-slate-200 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Store className="w-7 h-7 text-white dark:text-slate-900" />
          </div>
        </div>

        {/* 404 number */}
        <div className="animate-[float-404_4s_ease-in-out_infinite] mb-6">
          <h1 className="text-[120px] sm:text-[160px] font-black leading-none tracking-tight bg-gradient-to-b from-slate-200 to-slate-300/50 dark:from-slate-700 dark:to-slate-800/50 bg-clip-text text-transparent select-none">
            404
          </h1>
        </div>

        {/* Message */}
        <div style={{ animation: "fade-in-up 0.6s ease-out 0.2s both" }}>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white mb-2">
            页面走丢了
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
            你要找的页面不存在或已被移除，请检查链接是否正确
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-center gap-3" style={{ animation: "fade-in-up 0.6s ease-out 0.4s both" }}>
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            返回上一页
          </button>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 transition-all shadow-lg shadow-blue-500/25"
          >
            <Home className="w-4 h-4" />
            回到首页
          </Link>
        </div>

        {/* Footer */}
        <div className="mt-12 flex items-center justify-center gap-1.5" style={{ animation: "fade-in-up 0.6s ease-out 0.6s both" }}>
          <Sparkles className="w-3 h-3 text-blue-400 animate-pulse" />
          <p className="text-[11px] text-slate-300 dark:text-slate-700">&copy; 2026 SuperMarket</p>
          <Sparkles className="w-3 h-3 text-blue-400 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
