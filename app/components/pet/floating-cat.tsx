import { useState, useEffect, useCallback, useRef } from "react";

interface PetSkin {
  id: string;
  name: string;
  emoji: string;
  walkFrames: string[];
  sleepFrames: string[];
  jumpFace: string;
  tips: string[];
  color: string; // accent color for bubble
}

const skins: PetSkin[] = [
  {
    id: "cat",
    name: "小猫咪",
    emoji: "🐱",
    walkFrames: [
      "∧,,,∧\n(  ̳• · • ̳)\n/    づ♡",
      "∧,,,∧\n(  ̳· · ̳)\n/    づ♡",
      "∧,,,∧\n(  ̳• · • ̳)\n/    づ♡",
      "∧,,,∧\n(  ̳· · ̳)\n/    づ♡",
    ],
    sleepFrames: [
      "∧,,,∧\n(  - · -  ) zzZ\n/    づ♡",
      "∧,,,∧\n(  - · -  )  zZ\n/    づ♡",
    ],
    jumpFace: "≽ ^ • ⩊ • ^ ≼",
    tips: [
      "记得检查库存哦~",
      "今天也要加油！",
      "辛苦了，喝杯水吧~",
      "有客人来了~",
      "库存还充足吗？",
      "商品快过期了要记得检查~",
      "保持微笑服务~",
      "你是最棒的！",
    ],
    color: "pink",
  },
  {
    id: "doraemon",
    name: "哆啦A梦",
    emoji: "🔔",
    walkFrames: [
      " ●ω● \n /|  |\\\n /  ⌒\\",
      " ●ω● \n  /| |\\\n  / ⌒\\",
      " ●ω● \n /|  |\\\n /  ⌒\\",
      " ●ω● \n  /| |\\\n  / ⌒\\",
    ],
    sleepFrames: [
      " ●─● \n /|  |\\\n /  ⌒\\ zzZ",
      " ●─● \n  /| |\\\n  / ⌒\\  zZ",
    ],
    jumpFace: " ●▽● \n /|  |\\\n /  ⌒\\",
    tips: [
      "任意门~想去哪就去哪！",
      "记忆面包~背下所有商品！",
      "竹蜻蜓~飞到仓库去看看！",
      "时光机~回到昨天查账单！",
      "四次元口袋~什么都有！",
      "铜锣烧~给我一个嘛~",
      "我是哆啦A梦！",
      "小夫~你又胖了！",
    ],
    color: "blue",
  },
  {
    id: "shiba",
    name: "柴犬",
    emoji: "🐕",
    walkFrames: [
      "  /\\_/\\  \n ( o.o ) \n  > ^ <  ",
      "  /\\_/\\  \n ( o.o ) \n  / ^ \\  ",
      "  /\\_/\\  \n ( o.o ) \n  > ^ <  ",
      "  /\\_/\\  \n ( o.o ) \n  / ^ \\  ",
    ],
    sleepFrames: [
      "  /\\_/\\  \n ( -.- )  zzZ\n  > ^ <  ",
      "  /\\_/\\  \n ( -.- )   zZ\n  / ^ \\  ",
    ],
    jumpFace: "  /\\_/\\  \n ( ★ω★ ) \n  > ^ <  ",
    tips: [
      "汪！今天生意怎么样？",
      "汪汪！有新订单了！",
      "嘿嘿~库存充足！",
      "汪！该补货了！",
      "主人辛苦了~汪！",
      "一起去散步吧~汪！",
      "汪！有人来了！",
      "柴犬在此！汪！",
    ],
    color: "amber",
  },
  {
    id: "rabbit",
    name: "小兔兔",
    emoji: "🐰",
    walkFrames: [
      "  (\\(\\  \n ( -.-)\n o_(\")(\")",
      "  (\\(\\  \n ( .-.)\n o_(\")(\")",
      "  (\\(\\  \n ( -.-)\n o_(\")(\")",
      "  (\\(\\  \n ( .-.)\n o_(\")(\")",
    ],
    sleepFrames: [
      "  (\\(\\  \n ( --)  zzZ\n o_(\")(\")",
      "  (\\(\\  \n ( --)   zZ\n o_(\")(\")",
    ],
    jumpFace: "  (\\(\\  \n ( ^.^)\n o_(\")(\")",
    tips: [
      "胡萝卜好好吃~",
      "今天要乖乖工作哦~",
      "蹦蹦跳跳~加油！",
      "兔兔来帮你啦~",
      "库存够不够呀？",
      "记得喝水哦~",
      "兔兔最喜欢你了！",
      "一起努力吧~",
    ],
    color: "rose",
  },
];

const STORAGE_KEY = "pet-skin-id";

type CatState = "walking" | "sleeping" | "jumping" | "dragging";

export function FloatingCat() {
  const [skinId, setSkinId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(STORAGE_KEY) || "cat";
    }
    return "cat";
  });
  const [state, setState] = useState<CatState>("walking");
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [walkOffset, setWalkOffset] = useState(0);
  const [direction, setDirection] = useState(1);
  const [bubble, setBubble] = useState<string | null>(null);
  const [frame, setFrame] = useState(0);
  const [initialized, setInitialized] = useState(false);
  const [showSkinMenu, setShowSkinMenu] = useState(false);

  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number; moved: boolean } | null>(null);

  const skin = skins.find((s) => s.id === skinId) || skins[0];

  // Persist skin choice
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, skinId);
  }, [skinId]);

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

  // Click handler
  const handleClick = useCallback(() => {
    if (dragRef.current?.moved) return;

    if (state === "sleeping") {
      setState("walking");
      setBubble("喵~ 我醒了！");
      setTimeout(() => setBubble(null), 2500);
      return;
    }
    setState("jumping");
    const tip = skin.tips[Math.floor(Math.random() * skin.tips.length)];
    setBubble(tip);
    setTimeout(() => {
      setState("walking");
      setBubble(null);
    }, 3000);
  }, [state, skin]);

  // Right-click handler for skin menu
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setShowSkinMenu((prev) => !prev);
  }, []);

  const selectSkin = useCallback((id: string) => {
    setSkinId(id);
    setShowSkinMenu(false);
    setBubble(`变身！我是${skins.find((s) => s.id === id)?.name}！`);
    setTimeout(() => setBubble(null), 2500);
  }, []);

  const catFace = (() => {
    if (state === "sleeping") return skin.sleepFrames[Math.floor(Date.now() / 1000) % skin.sleepFrames.length];
    if (state === "jumping" || state === "dragging") return skin.jumpFace;
    return skin.walkFrames[frame % skin.walkFrames.length];
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

      {/* Skin selector menu */}
      {showSkinMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowSkinMenu(false)} />
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full z-50 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-2 min-w-[140px]">
            <p className="text-[10px] text-slate-400 px-2 mb-1.5">选择皮肤</p>
            <div className="space-y-0.5">
              {skins.map((s) => (
                <button
                  key={s.id}
                  onClick={() => selectSkin(s.id)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                    s.id === skinId
                      ? "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400"
                      : "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  <span className="text-base">{s.emoji}</span>
                  <span>{s.name}</span>
                  {s.id === skinId && <span className="ml-auto text-[10px]">✓</span>}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Pet */}
      <button
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        className={`block text-center cursor-grab active:cursor-grabbing transition-transform hover:scale-110 ${
          state === "jumping" ? "animate-cat-jump" : ""
        } ${state === "sleeping" ? "opacity-70" : ""}`}
        style={{ transform: direction === -1 ? "scaleX(-1)" : "scaleX(1)" }}
        title="拖拽移动 · 单击互动 · 右键换肤"
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
