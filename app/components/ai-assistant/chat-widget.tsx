import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  X, Send, Minus, Maximize2,
  Sparkles, CheckCircle, XCircle, ChevronDown, MessageSquare, Plus,
  Clock, Settings2, Bot, Menu, Zap, History, Cpu, ArrowRight,
  Search, BarChart3, HelpCircle, StopCircle,
} from "lucide-react";

interface ConfirmField {
  key: string;
  label: string;
  type: string;
  options?: string[];
  required?: boolean;
}

interface Message {
  id: number;
  role: "user" | "assistant";
  title?: string;
  content: string;
  type?: "text" | "table" | "navigate" | "confirm";
  data?: Record<string, unknown>[];
  navigateTo?: string;
  retryQuery?: string;
  needsConfirmation?: boolean;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  fields?: ConfirmField[];
}

interface ChatSession {
  id: number;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface ModelConfig {
  id: number;
  provider: string;
  model: string;
  isActive: boolean;
  lastTestOk: boolean | null;
}

const quickQuestions = [
  { text: "哪些商品缺货了？", icon: Search },
  { text: "今天卖了多少？", icon: BarChart3 },
  { text: "什么卖得好？", icon: BarChart3 },
  { text: "热销排行", icon: BarChart3 },
  { text: "本月采购多少？", icon: BarChart3 },
  { text: "帮助", icon: HelpCircle },
];

const DEFAULT_W = 460;
const DEFAULT_H = 620;
const MIN_W = 360;
const MIN_H = 480;

function loadSize(): { w: number; h: number } {
  if (typeof window === "undefined") return { w: DEFAULT_W, h: DEFAULT_H };
  try {
    const raw = localStorage.getItem("ai-chat-size");
    if (raw) {
      const s = JSON.parse(raw);
      if (typeof s.w === "number" && typeof s.h === "number") return s;
    }
  } catch { /* ignore */ }
  return { w: DEFAULT_W, h: DEFAULT_H };
}

interface ChatWidgetProps {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  user: { id: number; name: string; hasAvatar: boolean };
}

export function ChatWidget({ isOpen, onOpen, onClose, user }: ChatWidgetProps) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 0,
      role: "assistant",
      content: "你好！我是超市智能助手\n\n可以帮你查询库存、销售、供应商等信息，试试问我：",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [initialized, setInitialized] = useState(false);
  const [confirmEdits, setConfirmEdits] = useState<Record<number, Record<string, string>>>({});
  const [size, setSize] = useState(loadSize);

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarView, setSidebarView] = useState<"history" | "models">("history");
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [activeModel, setActiveModel] = useState<ModelConfig | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number; moved: boolean } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; startW: number; startH: number; edge: "corner" | "right" | "bottom" } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isOpen && !isMinimized) inputRef.current?.focus();
  }, [isOpen, isMinimized]);

  useEffect(() => {
    if (!initialized && isOpen) {
      const s = loadSize();
      setPos({ x: window.innerWidth - s.w - 16, y: window.innerHeight - s.h - 16 });
      setInitialized(true);
    }
  }, [initialized, isOpen]);

  // Load models and sessions when opened
  useEffect(() => {
    if (isOpen) {
      loadModels();
      loadSessions();
    }
  }, [isOpen]);

  const loadModels = async () => {
    try {
      const res = await fetch("/api/assistant?action=models");
      if (res.ok) {
        const data = await res.json();
        setModels(data.configs || []);
        setActiveModel(data.active || null);
      }
    } catch { /* ignore */ }
  };

  const loadSessions = async () => {
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_sessions" }),
      });
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch { /* ignore */ }
  };

  const loadSession = async (sid: number) => {
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "load_session", sessionId: sid }),
      });
      if (res.ok) {
        const data = await res.json();
        const msgs: Message[] = data.session.messages.map((m: Record<string, unknown>, i: number) => ({
          id: Date.now() + i,
          role: m.role,
          content: m.content as string,
          type: (m.type as string) || "text",
          data: m.data as Record<string, unknown>[] | undefined,
          navigateTo: m.navigateTo as string | undefined,
        }));
        setMessages(msgs.length > 0 ? msgs : [{ id: 0, role: "assistant", content: "这是一个空对话。" }]);
        setCurrentSessionId(sid);
      }
    } catch { /* ignore */ }
  };

  const deleteSession = async (sid: number) => {
    try {
      await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_session", sessionId: sid }),
      });
      setSessions((prev) => prev.filter((s) => s.id !== sid));
      if (currentSessionId === sid) {
        clearMessages();
      }
    } catch { /* ignore */ }
  };

  const switchModel = async (configId: number) => {
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "switch_model", configId }),
      });
      if (res.ok) {
        const data = await res.json();
        setActiveModel(models.find((m) => m.id === configId) || null);
        setModels((prev) => prev.map((m) => ({ ...m, isActive: m.id === configId })));
      }
    } catch { /* ignore */ }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = { id: Date.now(), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const history = messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: text, messages: history, sessionId: currentSessionId }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // Update session ID if new
      if (data.sessionId && !currentSessionId) {
        setCurrentSessionId(data.sessionId);
        loadSessions();
      }

      const assistantMsg: Message = {
        id: Date.now() + 1,
        role: "assistant",
        title: data.title,
        content: data.content,
        type: data.type,
        data: data.data,
        navigateTo: data.navigateTo,
        needsConfirmation: data.needsConfirmation,
        toolName: data.toolName,
        toolArgs: data.toolArgs,
        fields: data.fields,
      };
      setMessages((prev) => [...prev, assistantMsg]);

      // Initialize edit values for confirm messages
      if (data.needsConfirmation && data.toolArgs) {
        setConfirmEdits((prev) => ({
          ...prev,
          [Date.now() + 1]: Object.fromEntries(
            Object.entries(data.toolArgs).map(([k, v]) => [k, String(v ?? "")])
          ),
        }));
      }

      // Auto-navigate if type is navigate (full reload to show fresh data)
      if (data.type === "navigate" && data.navigateTo) {
        setTimeout(() => {
          window.location.href = data.navigateTo;
        }, 1200);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setMessages((prev) => [
          ...prev,
          { id: Date.now() + 1, role: "assistant", content: "已停止回答。", type: "text" },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { id: Date.now() + 1, role: "assistant", content: "请求失败，请稍后再试。", type: "text", retryQuery: text },
        ]);
      }
    } finally {
      abortRef.current = null;
      setIsLoading(false);
    }
  };

  const confirmTool = async (msg: Message) => {
    if (!msg.toolName) return;
    const edits = confirmEdits[msg.id] || {};
    const args = { ...msg.toolArgs, ...edits };

    setMessages((prev) =>
      prev.map((m) => m.id === msg.id ? { ...m, needsConfirmation: false, content: "正在执行..." } : m)
    );
    setIsLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmedTool: msg.toolName, confirmedArgs: args, sessionId: currentSessionId }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const resultMsg: Message = {
        id: Date.now(),
        role: "assistant",
        title: data.title,
        content: data.content,
        type: data.type,
        data: data.data,
        navigateTo: data.navigateTo,
      };
      setMessages((prev) => prev.map((m) => m.id === msg.id ? resultMsg : m));

      // Auto-navigate after confirmed write operation (full reload to show fresh data)
      if (data.navigateTo) {
        const successMsg = data.content || "操作成功";
        document.cookie = `flash-message=${encodeURIComponent(JSON.stringify({ type: "success", message: successMsg }))}; Path=/; Max-Age=10; SameSite=Lax`;
        // Show navigating indicator in chat
        const resultId = resultMsg.id;
        setMessages((prev) => prev.map((m) =>
          m.id === resultId ? { ...m, content: successMsg + "\n\n正在跳转...", navigateTo: undefined } : m
        ));
        setTimeout(() => {
          window.location.href = data.navigateTo;
        }, 1200);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setMessages((prev) =>
          prev.map((m) => m.id === msg.id ? { ...m, content: "已停止执行。" } : m)
        );
      } else {
        setMessages((prev) =>
          prev.map((m) => m.id === msg.id ? { ...m, content: "执行失败，请稍后再试。" } : m)
        );
      }
    } finally {
      abortRef.current = null;
      setIsLoading(false);
    }
  };

  const cancelTool = (msgId: number) => {
    setMessages((prev) =>
      prev.map((m) => m.id === msgId ? { ...m, needsConfirmation: false, content: "操作已取消。" } : m)
    );
  };

  const stopGeneration = () => {
    abortRef.current?.abort();
  };

  const updateConfirmField = (msgId: number, key: string, value: string) => {
    setConfirmEdits((prev) => ({
      ...prev,
      [msgId]: { ...(prev[msgId] || {}), [key]: value },
    }));
  };

  const clearMessages = () => {
    setMessages([{
      id: 0,
      role: "assistant",
      content: "你好！我是超市智能助手\n\n可以帮你查询库存、销售、供应商等信息，试试问我：",
    }]);
    setConfirmEdits({});
    setCurrentSessionId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleOpen = () => {
    if (!initialized) {
      const s = loadSize();
      setPos({ x: window.innerWidth - s.w - 16, y: window.innerHeight - s.h - 16 });
      setInitialized(true);
    }
    setIsMinimized(false);
    onOpen();
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (!initialized) return;
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
        setPos({
          x: Math.max(0, Math.min(window.innerWidth - size.w, dragRef.current.startPosX + dx)),
          y: Math.max(0, Math.min(window.innerHeight - 100, dragRef.current.startPosY + dy)),
        });
      }
    };

    const handleMouseUp = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }, [pos, initialized]);

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
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - size.w, dragRef.current.startPosX + dx)),
        y: Math.max(0, Math.min(window.innerHeight - 100, dragRef.current.startPosY + dy)),
      });
    }
  }, [size.w]);

  const handleTouchEnd = useCallback(() => {
    dragRef.current = null;
  }, []);

  const handleResizeStart = useCallback((e: React.MouseEvent, edge: "corner" | "right" | "bottom") => {
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = { startX: e.clientX, startY: e.clientY, startW: size.w, startH: size.h, edge };

    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      const maxW = Math.min(900, window.innerWidth - pos.x);
      const maxH = window.innerHeight - pos.y - 50;
      let newW = resizeRef.current.startW;
      let newH = resizeRef.current.startH;
      if (resizeRef.current.edge === "corner" || resizeRef.current.edge === "right") {
        newW = Math.max(MIN_W, Math.min(maxW, resizeRef.current.startW + (ev.clientX - resizeRef.current.startX)));
      }
      if (resizeRef.current.edge === "corner" || resizeRef.current.edge === "bottom") {
        newH = Math.max(MIN_H, Math.min(maxH, resizeRef.current.startH + (ev.clientY - resizeRef.current.startY)));
      }
      setSize({ w: newW, h: newH });
    };

    const onUp = () => {
      resizeRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      setSize((prev) => {
        try { localStorage.setItem("ai-chat-size", JSON.stringify(prev)); } catch { /* ignore */ }
        return prev;
      });
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [size, pos]);

  const providerLabels: Record<string, string> = {
    deepseek: "DeepSeek", openai: "OpenAI", anthropic: "Anthropic",
    mimo: "MiMo", qwen: "通义千问", glm: "智谱", moonshot: "月之暗面",
    ernie: "文心一言", doubao: "豆包", hunyuan: "混元", yi: "零一万物",
    minimax: "MiniMax", spark: "讯飞星火",
  };

  return (
    <>
      {/* Minimized bar */}
      {isOpen && isMinimized && (
        <div
          className="fixed z-50 cursor-move"
          style={{ left: pos.x, top: pos.y }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg px-4 py-2.5 flex items-center gap-2.5 min-w-[200px]">
            <div className="w-7 h-7 bg-primary/10 rounded-lg flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200 flex-1">AI 助手</span>
            <button onClick={() => setIsMinimized(false)} className="w-7 h-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors text-slate-400">
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors text-slate-400">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Chat window */}
      {isOpen && !isMinimized && (
        <div
          className="fixed bg-gradient-to-b from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex z-50 overflow-hidden"
          style={{ left: pos.x, top: pos.y, width: sidebarOpen ? size.w + 260 : size.w, height: size.h }}
        >
          {/* Sidebar */}
          {sidebarOpen && (
            <div className="w-[260px] border-r border-slate-200 dark:border-slate-700 flex flex-col shrink-0 bg-slate-50/80 dark:bg-slate-900/50">
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center gap-1">
                <button
                  onClick={() => setSidebarView("history")}
                  className={`flex-1 px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${sidebarView === "history" ? "bg-primary text-primary-foreground" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"}`}
                >
                  <History className="w-3 h-3 inline mr-1" />
                  对话记录
                </button>
                <button
                  onClick={() => setSidebarView("models")}
                  className={`flex-1 px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${sidebarView === "models" ? "bg-primary text-primary-foreground" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"}`}
                >
                  <Cpu className="w-3 h-3 inline mr-1" />
                  模型
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {sidebarView === "history" && (
                  <>
                    <button
                      onClick={clearMessages}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-primary hover:bg-primary/10 rounded-lg transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      新建对话
                    </button>
                    {sessions.map((s) => (
                      <div key={s.id} className="group flex items-center gap-1">
                        <button
                          onClick={() => loadSession(s.id)}
                          className={`flex-1 text-left px-3 py-2 text-xs rounded-lg transition-colors truncate ${currentSessionId === s.id ? "bg-primary/10 text-primary" : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"}`}
                        >
                          <Clock className="w-3 h-3 inline mr-1.5 opacity-50" />
                          {s.title}
                        </button>
                        <button
                          onClick={() => deleteSession(s.id)}
                          className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center text-slate-400 hover:text-red-500 transition-all"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {sessions.length === 0 && (
                      <p className="text-xs text-slate-400 text-center py-4">暂无对话记录</p>
                    )}
                  </>
                )}

                {sidebarView === "models" && (
                  <>
                    {models.filter((m) => m.lastTestOk === true || m.isActive).map((m) => (
                      <button
                        key={m.id}
                        onClick={() => m.lastTestOk ? switchModel(m.id) : undefined}
                        disabled={!m.lastTestOk}
                        className={`w-full text-left px-3 py-2.5 rounded-lg text-xs transition-colors ${
                          m.isActive
                            ? "bg-primary/10 border border-primary/30"
                            : m.lastTestOk
                              ? "hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent cursor-pointer"
                              : "opacity-50 border border-transparent cursor-not-allowed"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-slate-700 dark:text-slate-200">
                            {providerLabels[m.provider] || m.provider}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {m.lastTestOk === false && <span className="text-[10px] text-red-400">未通过测试</span>}
                            {m.isActive && <span className="text-[10px] text-primary font-medium">当前</span>}
                          </div>
                        </div>
                        <div className="text-slate-400 mt-0.5">{m.model}</div>
                      </button>
                    ))}
                    {models.filter((m) => m.lastTestOk === true || m.isActive).length === 0 && (
                      <p className="text-xs text-slate-400 text-center py-4">暂无可用模型，请先在设置中测试连接</p>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Main chat area */}
          <div className="flex flex-col flex-1 min-w-0">
            {/* Header */}
            <div
              className="bg-slate-50/80 dark:bg-slate-800/50 px-4 py-3 flex items-center justify-between shrink-0 cursor-move select-none"
              style={{ borderBottom: "1px solid transparent", borderImage: "linear-gradient(to right, transparent, var(--primary), transparent) 1" }}
              onMouseDown={handleMouseDown}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="w-7 h-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors text-slate-400"
                >
                  <Menu className="w-4 h-4" />
                </button>
                <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-4.5 h-4.5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-slate-800 dark:text-white">AI 助手</h3>
                  <p className="text-[10px] text-slate-400">
                    {activeModel ? `${providerLabels[activeModel.provider] || activeModel.provider} · ${activeModel.model}` : "未配置模型"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={clearMessages}
                  className="w-7 h-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors text-slate-400"
                  title="新对话"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setIsMinimized(true)}
                  className="w-7 h-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors text-slate-400"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <button
                  onClick={onClose}
                  className="w-7 h-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors text-slate-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                        : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-tl-sm"
                    }`}
                  >
                    {msg.title && msg.role === "assistant" && (
                      <p className="font-semibold text-xs text-primary mb-1.5">{msg.title}</p>
                    )}

                    {/* Markdown content */}
                    <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-2 prose-table:text-xs prose-table:my-2 prose-th:px-2 prose-th:py-1 prose-td:px-2 prose-td:py-1 prose-code:text-xs prose-code:bg-slate-100 dark:prose-code:bg-slate-700 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:text-xs prose-pre:p-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>

                    {/* Retry button */}
                    {msg.retryQuery && (
                      <button
                        onClick={() => sendMessage(msg.retryQuery!)}
                        className="mt-2 text-xs text-primary hover:text-primary/80 underline"
                      >
                        重新发送
                      </button>
                    )}

                    {/* Navigation button */}
                    {msg.navigateTo && msg.type === "navigate" && (
                      <button
                        onClick={() => { navigate(msg.navigateTo!); onClose(); }}
                        className="mt-2.5 flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-colors"
                      >
                        <ArrowRight className="w-3 h-3" />
                        前往页面
                      </button>
                    )}

                    {/* Confirmation form */}
                    {msg.type === "confirm" && msg.needsConfirmation && msg.fields && (
                      <div className="mt-2.5 space-y-2">
                        {msg.fields.map((field) => {
                          const edits = confirmEdits[msg.id] || {};
                          const value = edits[field.key] ?? String(msg.toolArgs?.[field.key] ?? "");
                          return (
                            <div key={field.key} className="space-y-0.5">
                              <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                {field.label}
                                {field.required && <span className="text-red-400 ml-0.5">*</span>}
                              </label>
                              {field.type === "select" && field.options ? (
                                <select
                                  value={value}
                                  onChange={(e) => updateConfirmField(msg.id, field.key, e.target.value)}
                                  className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-primary/30"
                                >
                                  {field.options.map((opt) => (
                                    <option key={opt} value={opt}>
                                      {opt === "IN" ? "入库" : opt === "OUT" ? "出库" : opt === "active" ? "启用" : opt === "inactive" ? "停用" : opt}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  type={field.type === "number" ? "number" : "text"}
                                  value={value}
                                  onChange={(e) => updateConfirmField(msg.id, field.key, e.target.value)}
                                  className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-primary/30"
                                />
                              )}
                            </div>
                          );
                        })}
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => confirmTool(msg)}
                            className="flex items-center gap-1.5 px-4 py-1.5 text-xs bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors font-medium"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            确认执行
                          </button>
                          <button
                            onClick={() => cancelTool(msg.id)}
                            className="flex items-center gap-1.5 px-4 py-1.5 text-xs bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            取消
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Table data */}
                    {msg.type === "table" && msg.data && msg.data.length > 0 && (
                      <div className="mt-2.5 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-slate-100 dark:bg-slate-700/50">
                              {Object.keys(msg.data[0]).map((key) => (
                                <th key={key} className="text-left px-2.5 py-1.5 font-semibold text-slate-600 dark:text-slate-300">{key}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {msg.data.map((row, i) => (
                              <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                {Object.values(row).map((val, j) => (
                                  <td key={j} className="px-2.5 py-1.5">{String(val)}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="w-7 h-7 rounded-full shrink-0 mt-0.5 overflow-hidden">
                      {user.hasAvatar ? (
                        <img src={`/api/avatar?userId=${user.id}`} alt={user.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-slate-900 text-xs font-bold">
                          {user.name.charAt(0)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                  <div className="bg-white dark:bg-slate-800 rounded-2xl rounded-tl-sm shadow-sm px-4 py-3 flex items-center gap-1.5">
                    <div className="bounce-dot w-2 h-2 rounded-full bg-primary" />
                    <div className="bounce-dot w-2 h-2 rounded-full bg-primary" />
                    <div className="bounce-dot w-2 h-2 rounded-full bg-primary" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick questions */}
            {messages.length <= 1 && (
              <div className="px-4 pb-2 flex flex-wrap gap-2">
                {quickQuestions.map((q) => {
                  const QIcon = q.icon;
                  return (
                    <button
                      key={q.text}
                      onClick={() => sendMessage(q.text)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors"
                    >
                      <QIcon className="w-3 h-3" />
                      {q.text}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Input */}
            <div className="p-3 border-t border-slate-200 dark:border-slate-700 shrink-0">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="输入你的问题..."
                  className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none focus:ring-2 focus:ring-primary/20 shadow-sm"
                />
                <button
                  onClick={() => isLoading ? stopGeneration() : sendMessage(input)}
                  disabled={!isLoading && !input.trim()}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                    isLoading
                      ? "bg-red-500 text-white hover:bg-red-600"
                      : "bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  }`}
                >
                  {isLoading ? <StopCircle className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Resize handles */}
            <div className="absolute top-0 right-0 w-1.5 h-full cursor-ew-resize z-10" onMouseDown={(e) => handleResizeStart(e, "right")} />
            <div className="absolute bottom-0 left-0 w-full h-1.5 cursor-ns-resize z-10" onMouseDown={(e) => handleResizeStart(e, "bottom")} />
            <div className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize z-10 group" onMouseDown={(e) => handleResizeStart(e, "corner")}>
              <div className="absolute bottom-1 right-1 w-2 h-2 border-r-2 border-b-2 border-slate-300 dark:border-slate-600 group-hover:border-primary transition-colors" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
