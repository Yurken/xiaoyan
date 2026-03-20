import { useState, useEffect, useRef } from "react";
import { Send, Bot, User, Plus, MessageSquare, AlertCircle } from "lucide-react";
import { MarkdownRenderer } from "@research-copilot/ui";
import { apiClient, formatErrorMessage } from "../lib/client";
import type { ChatMessage, ChatSession } from "@research-copilot/types";

export default function Copilot() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    setLoadError("");

    apiClient.chat.listSessions()
      .then((data) => {
        if (!cancelled) {
          setSessions(data);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(formatErrorMessage(error));
          setSessions([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadSession = async (s: ChatSession) => {
    try {
      setLoadError("");
      const data = await apiClient.chat.getSession(s.id);
      setCurrentSession(data);
      setMessages(data.messages ?? []);
    } catch (error) {
      setLoadError(formatErrorMessage(error));
    }
  };

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput("");
    setSending(true);

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    const assistantId = Date.now() + "_a";
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    try {
      setLoadError("");
      let sessionId = currentSession?.id;
      for await (const chunk of apiClient.chat.stream({
        session_id: currentSession?.id,
        message: text,
      })) {
        if (chunk.type === "session_id") sessionId = chunk.value;
        else if (chunk.type === "delta") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: m.content + chunk.value } : m
            )
          );
        }
      }
      if (sessionId && !currentSession) {
        const updated = await apiClient.chat.listSessions();
        setSessions(updated);
        setCurrentSession({ id: sessionId } as ChatSession);
      }
    } catch (error) {
      const message = `请求失败：${formatErrorMessage(error)}`;
      setLoadError(message);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: message } : m
        )
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-full">
      {/* Session Sidebar */}
      <div
        className="w-52 flex-shrink-0 flex flex-col"
        style={{
          background: "linear-gradient(180deg, #F0F4F8 0%, #E8ECF0 100%)",
          boxShadow: "4px 0 10px rgba(0,0,0,0.04)",
        }}
      >
        <div className="p-3 pb-2">
          <button
            onClick={() => { setCurrentSession(null); setMessages([]); }}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-2xl text-sm font-medium text-white transition-all duration-150 active:scale-[0.98]"
            style={{
              background: "linear-gradient(145deg, #1A8AFF, #0062CC)",
              boxShadow: "4px 4px 10px rgba(0,62,204,0.35), -3px -3px 8px rgba(58,155,255,0.2)",
            }}
          >
            <Plus className="w-4 h-4" />
            新对话
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-1">
          {sessions.length === 0 && (
            <div className="flex flex-col items-center py-8 gap-2">
              <MessageSquare className="w-8 h-8 text-ink-tertiary opacity-40" />
              <p className="text-xs text-ink-tertiary">暂无对话记录</p>
            </div>
          )}
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => loadSession(s)}
              className="w-full text-left px-3 py-2.5 rounded-2xl text-xs transition-all duration-150"
              style={
                currentSession?.id === s.id
                  ? {
                      background: "#E8ECF0",
                      boxShadow: "inset 3px 3px 6px #C8CDD3, inset -3px -3px 6px #FFFFFF",
                      color: "#007AFF",
                      fontWeight: 600,
                    }
                  : { color: "#3C3C43" }
              }
              onMouseEnter={(e) => {
                if (currentSession?.id !== s.id) {
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(232,236,240,0.7)";
                }
              }}
              onMouseLeave={(e) => {
                if (currentSession?.id !== s.id) {
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                }
              }}
            >
              <div className="truncate">{s.title || "新对话"}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-nm-bg">
        {/* Header */}
        <div
          className="h-12 flex items-center px-5"
          style={{
            background: "linear-gradient(180deg, #F0F4F8, #E8ECF0)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
          }}
        >
          <span className="font-semibold text-sm text-ink-primary">
            {currentSession ? "当前对话" : "新对话"}
          </span>
        </div>

        {loadError && (
          <div className="px-5 pt-4">
            <div
              className="flex items-start gap-3 rounded-2xl px-4 py-3 text-sm text-apple-red"
              style={{
                background: "#F2EAEA",
                boxShadow: "inset 2px 2px 5px rgba(180,59,48,0.14), inset -2px -2px 5px rgba(255,255,255,0.8)",
              }}
            >
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span className="break-all">{loadError}</span>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-4 pb-12">
              <div
                className="w-16 h-16 rounded-3xl flex items-center justify-center"
                style={{
                  background: "linear-gradient(145deg, #1A8AFF, #0062CC)",
                  boxShadow: "6px 6px 14px rgba(0,62,204,0.35), -4px -4px 10px rgba(58,155,255,0.25)",
                }}
              >
                <Bot className="w-8 h-8 text-white" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-ink-primary">智研 Copilot</p>
                <p className="text-sm text-ink-tertiary mt-1">你的 AI 科研助手，随时为你解答</p>
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}
            >
              {/* Avatar */}
              <div
                className="w-8 h-8 rounded-2xl flex-shrink-0 flex items-center justify-center"
                style={
                  m.role === "user"
                    ? {
                        background: "linear-gradient(145deg, #1A8AFF, #0062CC)",
                        boxShadow: "3px 3px 8px rgba(0,62,204,0.35), -2px -2px 6px rgba(58,155,255,0.2)",
                      }
                    : {
                        background: "#E8ECF0",
                        boxShadow: "3px 3px 6px #C8CDD3, -3px -3px 6px #FFFFFF",
                      }
                }
              >
                {m.role === "user"
                  ? <User className="w-4 h-4 text-white" />
                  : <Bot className="w-4 h-4 text-apple-blue" />}
              </div>

              {/* Bubble */}
              <div
                className="max-w-[78%] rounded-3xl px-4 py-3 text-sm"
                style={
                  m.role === "user"
                    ? {
                        background: "linear-gradient(145deg, #1A8AFF, #0062CC)",
                        boxShadow: "4px 4px 10px rgba(0,62,204,0.3), -3px -3px 8px rgba(58,155,255,0.2)",
                        color: "#FFFFFF",
                      }
                    : {
                        background: "linear-gradient(145deg, #F2F6FA, #E0E4E8)",
                        boxShadow: "4px 4px 10px #C8CDD3, -4px -4px 10px #FFFFFF",
                        color: "#1C1C1E",
                      }
                }
              >
                {m.role === "user"
                  ? <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                  : <MarkdownRenderer content={m.content || "…"} />}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 flex gap-3 items-end">
          <div className="flex-1">
            <textarea
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="输入问题… (Enter 发送，Shift+Enter 换行)"
              className="w-full rounded-3xl px-5 py-3 text-sm text-ink-primary placeholder:text-ink-tertiary outline-none border-0 resize-none transition-shadow duration-150"
              style={{
                background: "#E8ECF0",
                boxShadow: "inset 2px 2px 5px #C8CDD3, inset -2px -2px 5px #FFFFFF",
              }}
              onFocus={(e) => {
                e.currentTarget.style.boxShadow =
                  "inset 3px 3px 7px #C0C5CB, inset -3px -3px 7px #FFFFFF, 0 0 0 2px rgba(0,122,255,0.2)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.boxShadow =
                  "inset 2px 2px 5px #C8CDD3, inset -2px -2px 5px #FFFFFF";
              }}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 text-white transition-all duration-150 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: "linear-gradient(145deg, #1A8AFF, #0062CC)",
              boxShadow: input.trim() && !sending
                ? "4px 4px 10px rgba(0,62,204,0.4), -3px -3px 8px rgba(58,155,255,0.25)"
                : "none",
            }}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
