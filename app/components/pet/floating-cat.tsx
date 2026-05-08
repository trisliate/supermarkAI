import { useState, useEffect, useCallback } from "react";

const tips = [
  "记得检查库存哦~",
  "今天也要加油！",
  "辛苦了，喝杯水吧~",
  "有客人来了~",
  "库存还充足吗？",
  "商品快过期了要记得检查~",
  "保持微笑服务~",
  "你是最棒的！",
];

type CatState = "walking" | "sleeping" | "jumping";

export function FloatingCat() {
  const [state, setState] = useState<CatState>("walking");
  const [position, setPosition] = useState(0); // 0-100, percentage
  const [direction, setDirection] = useState(1); // 1 = right, -1 = left
  const [bubble, setBubble] = useState<string | null>(null);
  const [frame, setFrame] = useState(0);

  // Walking animation
  useEffect(() => {
    if (state !== "walking") return;

    const walkInterval = setInterval(() => {
      setPosition((prev) => {
        const next = prev + direction * 0.8;
        if (next > 85) { setDirection(-1); return 85; }
        if (next < 0) { setDirection(1); return 0; }
        return next;
      });
      setFrame((f) => (f + 1) % 4);
    }, 200);

    return () => clearInterval(walkInterval);
  }, [state, direction]);

  // Sleep after idle
  useEffect(() => {
    if (state !== "walking") return;
    const timer = setTimeout(() => setState("sleeping"), 30000);
    return () => clearTimeout(timer);
  }, [state]);

  // Frame animation for walking
  useEffect(() => {
    if (state !== "walking") return;
    const anim = setInterval(() => setFrame((f) => (f + 1) % 4), 300);
    return () => clearInterval(anim);
  }, [state]);

  const handleClick = useCallback(() => {
    if (state === "sleeping") {
      setState("walking");
      setBubble("喵~ 我醒了！");
      setTimeout(() => setBubble(null), 2500);
      return;
    }

    setState("jumping");
    const tip = tips[Math.floor(Math.random() * tips.length)];
    setBubble(tip);
    setTimeout(() => {
      setState("walking");
      setBubble(null);
    }, 3000);
  }, [state]);

  const catFace = (() => {
    if (state === "sleeping") return sleepingFrames[Math.floor(Date.now() / 1000) % sleepingFrames.length];
    if (state === "jumping") return "≽ ^ • ⩊ • ^ ≼";
    return walkFrames[frame % walkFrames.length];
  })();

  return (
    <div
      className="fixed bottom-24 right-6 z-40 select-none"
      style={{ transform: `translateX(${(position - 50) * 0.5}px)` }}
    >
      {/* Bubble */}
      {bubble && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap">
          <div className="bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs px-3 py-1.5 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 relative">
            {bubble}
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white dark:bg-slate-800 border-r border-b border-slate-200 dark:border-slate-700 rotate-45" />
          </div>
        </div>
      )}

      {/* Cat */}
      <button
        onClick={handleClick}
        className={`block text-center cursor-pointer transition-transform hover:scale-110 ${
          state === "jumping" ? "animate-cat-jump" : ""
        } ${state === "sleeping" ? "opacity-70" : ""}`}
        style={{ transform: direction === -1 ? "scaleX(-1)" : "scaleX(1)" }}
        title="点击我互动"
      >
        <div className="text-2xl leading-none select-none" style={{ fontFamily: "monospace" }}>
          {catFace}
        </div>
        {state === "sleeping" && (
          <div className="text-[10px] text-slate-400 animate-pulse mt-0.5">z z z</div>
        )}
      </button>
    </div>
  );
}

const walkFrames = [
  "∧,,,∧\n(  ̳• · • ̳)\n/    づ♡",
  "∧,,,∧\n(  ̳· · ̳)\n/    づ♡",
  "∧,,,∧\n(  ̳• · • ̳)\n/    づ♡",
  "∧,,,∧\n(  ̳· · ̳)\n/    づ♡",
];

const sleepingFrames = [
  "∧,,,∧\n(  - · -  ) zzZ\n/    づ♡",
  "∧,,,∧\n(  - · -  )  zZ\n/    づ♡",
];
