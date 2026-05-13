import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { X, Send, User, Loader2, Minus, Maximize2, Trash2, ExternalLink, Sparkles, CheckCircle, XCircle } from "lucide-react";

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

const quickQuestions = [
  "哪些商品缺货了？",
  "今天卖了多少？",
  "什么卖得好？",
  "帮助",
];

const DEFAULT_W = 380;
const DEFAULT_H = 520;
const MIN_W = 300;
const MIN_H = 400;

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
}

export function ChatWidget({ isOpen, onOpen, onClose }: ChatWidgetProps) {
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number; moved: boolean } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; startW: number; startH: number; edge: "corner" | "right" | "bottom" } | null>(null);

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

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = { id: Date.now(), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const history = messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: text, messages: history }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
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
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, role: "assistant", content: "请求失败，请稍后再试。", type: "text", retryQuery: text },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const confirmTool = async (msg: Message) => {
    if (!msg.toolName) return;
    const edits = confirmEdits[msg.id] || {};
    const args = { ...msg.toolArgs, ...edits };

    // Mark this message as no longer needing confirmation
    setMessages((prev) =>
      prev.map((m) => m.id === msg.id ? { ...m, needsConfirmation: false, content: "正在执行..." } : m)
    );
    setIsLoading(true);

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmedTool: msg.toolName, confirmedArgs: args }),
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
      };
      setMessages((prev) => prev.map((m) => m.id === msg.id ? resultMsg : m));
    } catch {
      setMessages((prev) =>
        prev.map((m) => m.id === msg.id ? { ...m, content: "执行失败，请稍后再试。" } : m)
      );
    } finally {
      setIsLoading(false);
    }
  };

  const cancelTool = (msgId: number) => {
    setMessages((prev) =>
      prev.map((m) => m.id === msgId ? { ...m, needsConfirmation: false, content: "操作已取消。" } : m)
    );
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

  const handleResizeStart = useCallback((e: React.MouseEvent, edge: "corner" | "right" | "bottom") => {
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = { startX: e.clientX, startY: e.clientY, startW: size.w, startH: size.h, edge };

    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      const maxW = Math.min(800, window.innerWidth - pos.x);
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
      // Persist to localStorage
      setSize((prev) => {
        try { localStorage.setItem("ai-chat-size", JSON.stringify(prev)); } catch { /* ignore */ }
        return prev;
      });
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [size, pos]);

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
            <button
              onClick={() => setIsMinimized(false)}
              className="w-7 h-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors text-slate-400"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors text-slate-400"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Chat window */}
      {isOpen && !isMinimized && (
        <div
          className="fixed bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col z-50 overflow-hidden"
          style={{ left: pos.x, top: pos.y, width: size.w, height: size.h }}
        >
          {/* Header */}
          <div
            className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between shrink-0 cursor-move select-none"
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                <Sparkles className="w-4.5 h-4.5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-slate-800 dark:text-white">AI 助手</h3>
                <p className="text-[10px] text-slate-400">智能问答 · 数据查询</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={clearMessages}
                className="w-7 h-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors text-slate-400"
                title="清空对话"
              >
                <Trash2 className="w-3.5 h-3.5" />
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
              <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                {msg.role === "assistant" && (
                  <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 rounded-tl-sm border-l-2 border-primary/40"
                  }`}
                >
                  {msg.title && msg.role === "assistant" && (
                    <p className="font-semibold text-xs text-primary mb-1">{msg.title}</p>
                  )}
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>

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
                  {msg.navigateTo && (
                    <button
                      onClick={() => { navigate(msg.navigateTo!); onClose(); }}
                      className="mt-2 flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                      前往页面
                    </button>
                  )}

                  {/* Confirmation form */}
                  {msg.type === "confirm" && msg.needsConfirmation && msg.fields && (
                    <div className="mt-2 space-y-2">
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
                                className="w-full px-2 py-1 text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md outline-none focus:ring-1 focus:ring-primary/30"
                              >
                                {field.options.map((opt) => (
                                  <option key={opt} value={opt}>{opt === "IN" ? "入库" : opt === "OUT" ? "出库" : opt}</option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type={field.type === "number" ? "number" : "text"}
                                value={value}
                                onChange={(e) => updateConfirmField(msg.id, field.key, e.target.value)}
                                className="w-full px-2 py-1 text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md outline-none focus:ring-1 focus:ring-primary/30"
                              />
                            )}
                          </div>
                        );
                      })}
                      <div className="flex gap-1.5 pt-1">
                        <button
                          onClick={() => confirmTool(msg)}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
                        >
                          <CheckCircle className="w-3 h-3" />
                          确认执行
                        </button>
                        <button
                          onClick={() => cancelTool(msg.id)}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                        >
                          <XCircle className="w-3 h-3" />
                          取消
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Table data */}
                  {msg.type === "table" && msg.data && msg.data.length > 0 && (
                    <div className="mt-2 overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-700">
                            {Object.keys(msg.data[0]).map((key) => (
                              <th key={key} className="text-left py-1 pr-2 font-medium text-slate-500">{key}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {msg.data.map((row, i) => (
                            <tr key={i}>
                              {Object.values(row).map((val, j) => (
                                <td key={j} className="py-1 pr-2">{String(val)}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="w-6 h-6 rounded-md bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-3.5 h-3.5 text-slate-500" />
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl rounded-tl-sm border-l-2 border-primary/40 px-3 py-2">
                  <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick questions */}
          {messages.length <= 1 && (
            <div className="px-4 pb-2 flex flex-wrap gap-1.5">
              {quickQuestions.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="px-2.5 py-1 text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full hover:bg-primary/10 hover:text-primary transition-colors"
                >
                  {q}
                </button>
              ))}
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
                className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none focus:ring-2 focus:ring-primary/30 border border-slate-200 dark:border-slate-700"
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isLoading}
                className="w-9 h-9 bg-primary text-primary-foreground rounded-lg flex items-center justify-center hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Resize handles */}
          {/* Right edge */}
          <div
            className="absolute top-0 right-0 w-1.5 h-full cursor-ew-resize z-10"
            onMouseDown={(e) => handleResizeStart(e, "right")}
          />
          {/* Bottom edge */}
          <div
            className="absolute bottom-0 left-0 w-full h-1.5 cursor-ns-resize z-10"
            onMouseDown={(e) => handleResizeStart(e, "bottom")}
          />
          {/* Corner handle */}
          <div
            className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize z-10 group"
            onMouseDown={(e) => handleResizeStart(e, "corner")}
          >
            <div className="absolute bottom-1 right-1 w-2 h-2 border-r-2 border-b-2 border-slate-300 dark:border-slate-600 group-hover:border-primary transition-colors" />
          </div>
        </div>
      )}
    </>
  );
}
