import { useState, useEffect, useCallback, useRef } from "react";

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

type CatState = "walking" | "sleeping" | "jumping" | "dragging";

interface FloatingCatProps {
  onDoubleClick: () => void;
}

export function FloatingCat({ onDoubleClick }: FloatingCatProps) {
  const [state, setState] = useState<CatState>("walking");
  const [pos, setPos] = useState({ x: 0, y: 0 }); // offset from initial position
  const [walkOffset, setWalkOffset] = useState(0);
  const [direction, setDirection] = useState(1);
  const [bubble, setBubble] = useState<string | null>(null);
  const [frame, setFrame] = useState(0);
  const [initialized, setInitialized] = useState(false);

  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number; moved: boolean } | null>(null);
  const clickTimerRef = useRef<number | null>(null);

  // Initialize position to bottom-right area
  useEffect(() => {
    if (!initialized) {
      setPos({ x: window.innerWidth - 80, y: window.innerHeight - 140 });
      setInitialized(true);
    }
  }, [initialized]);

  // Walking animation (left-right oscillation)
  useEffect(() => {
    if (state !== "walking") return;

    const walkInterval = setInterval(() => {
      setWalkOffset((prev) => {
        const next = prev + direction * 1.2;
        if (next > 30) { setDirection(-1); return 30; }
        if (next < -30) { setDirection(1); return -30; }
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

  // Mouse drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPosX: pos.x,
      startPosY: pos.y,
      moved: false,
    };

    const handleMouseMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        dragRef.current.moved = true;
        setState("dragging");
        setPos({
          x: Math.max(0, Math.min(window.innerWidth - 60, dragRef.current.startPosX + dx)),
          y: Math.max(0, Math.min(window.innerHeight - 60, dragRef.current.startPosY + dy)),
        });
      }
    };

    const handleMouseUp = () => {
      if (dragRef.current?.moved) {
        setState("walking");
      }
      dragRef.current = null;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }, [pos]);

  // Touch drag handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    dragRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      startPosX: pos.x,
      startPosY: pos.y,
      moved: false,
    };
  }, [pos]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragRef.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - dragRef.current.startX;
    const dy = touch.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      dragRef.current.moved = true;
      setState("dragging");
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - 60, dragRef.current.startPosX + dx)),
        y: Math.max(0, Math.min(window.innerHeight - 60, dragRef.current.startPosY + dy)),
      });
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (dragRef.current?.moved) {
      setState("walking");
    }
    dragRef.current = null;
  }, []);

  // Click handler with double-click detection
  const handleClick = useCallback(() => {
    if (dragRef.current?.moved) return;

    if (clickTimerRef.current) {
      // Double click detected
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      onDoubleClick();
      return;
    }

    clickTimerRef.current = window.setTimeout(() => {
      clickTimerRef.current = null;
      // Single click action
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
    }, 250);
  }, [state, onDoubleClick]);

  const catFace = (() => {
    if (state === "sleeping") return sleepingFrames[Math.floor(Date.now() / 1000) % sleepingFrames.length];
    if (state === "jumping" || state === "dragging") return "≽ ^ • ⩊ • ^ ≼";
    return walkFrames[frame % walkFrames.length];
  })();

  if (!initialized) return null;

  return (
    <div
      className="fixed z-40 select-none"
      style={{ left: pos.x + walkOffset, top: pos.y }}
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
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleClick}
        className={`block text-center cursor-grab active:cursor-grabbing transition-transform hover:scale-110 ${
          state === "jumping" ? "animate-cat-jump" : ""
        } ${state === "sleeping" ? "opacity-70" : ""}`}
        style={{ transform: direction === -1 ? "scaleX(-1)" : "scaleX(1)" }}
        title="拖拽移动 · 单击互动 · 双击打开助手"
      >
        <div className="text-2xl leading-none select-none" style={{ fontFamily: "monospace" }}>
          {catFace}
        </div>
        {state === "sleeping" && (
          <div className="text-[10px] text-slate-400 dark:text-slate-500 animate-pulse mt-0.5">z z z</div>
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
