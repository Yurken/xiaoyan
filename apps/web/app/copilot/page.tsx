"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { MessageSquare, Send, Plus, Trash2, Bot, User } from "lucide-react";
import { Card, Button, Badge, MarkdownRenderer } from "@research-copilot/ui";
import { chatApi } from "@/lib/client";
import type { ChatSession, ChatMessage } from "@research-copilot/types";

function CopilotContent() {
  const searchParams = useSearchParams();
  const contextType = searchParams.get("context_type") || "general";
  const contextId = searchParams.get("context_id") || undefined;
  const contextTitle = searchParams.get("title") || "";

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => { scrollToBottom(); }, [messages]);

  const loadSessions = async () => {
    try {
      const data = await chatApi.listSessions() as ChatSession[];
      setSessions(data);
    } finally {
      setLoadingSessions(false);
    }
  };

  useEffect(() => { loadSessions(); }, []);

  const loadSession = async (session: ChatSession) => {
    try {
      const data = await chatApi.getSession(session.id) as ChatSession;
      setCurrentSession(data);
      setMessages(data.messages || []);
    } catch {}
  };

  const handleNewChat = () => {
    setCurrentSession(null);
    setMessages([]);
  };

  const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await chatApi.deleteSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (currentSession?.id === id) {
        setCurrentSession(null);
        setMessages([]);
      }
    } catch {}
  };

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    const userMessage = input.trim();
    setInput("");
    setSending(true);

    const tempUserMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: userMessage,
      sources: undefined,
      created_at: new Date().toISOString(),
    };
    const assistantId = Date.now().toString() + "_a";
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      sources: undefined,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg, assistantMsg]);

    try {
      let sessionId = currentSession?.id;

      for await (const chunk of chatApi.stream({
        session_id: currentSession?.id,
        message: userMessage,
        context_type: contextType,
        context_id: contextId,
      })) {
        if (chunk.type === "session_id") {
          sessionId = chunk.value;
        } else if (chunk.type === "delta") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: m.content + chunk.value } : m
            )
          );
        }
      }

      if (sessionId && !currentSession) {
        await loadSessions();
        setCurrentSession({ id: sessionId } as ChatSession);
      }
    } catch (e) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: `抱歉，发生了错误：${e instanceof Error ? e.message : "未知错误"}` }
            : m
        )
      );
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-full">
      {/* Sessions sidebar */}
      <div className="w-56 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-3 border-b border-gray-200">
          <Button onClick={handleNewChat} size="sm" variant="secondary" className="w-full">
            <Plus className="w-4 h-4" />
            新对话
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loadingSessions ? (
            <div className="text-xs text-gray-400 text-center py-4">加载中...</div>
          ) : sessions.length === 0 ? (
            <div className="text-xs text-gray-400 text-center py-4">还没有对话记录</div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                onClick={() => loadSession(session)}
                className={`group flex items-start gap-2 p-2.5 rounded-lg cursor-pointer transition-colors ${
                  currentSession?.id === session.id ? "bg-brand-50 text-brand-700" : "hover:bg-gray-100 text-gray-700"
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{session.title}</div>
                  <div className="text-xs text-gray-400">{session.updated_at ? new Date(session.updated_at).toLocaleDateString("zh-CN") : new Date(session.created_at).toLocaleDateString("zh-CN")}</div>
                </div>
                <button
                  onClick={(e) => handleDeleteSession(session.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-500 transition-all flex-shrink-0"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="h-14 flex items-center px-6 border-b border-gray-200 bg-white gap-3">
          <MessageSquare className="w-5 h-5 text-rose-500" />
          <div className="flex-1">
            <span className="font-semibold text-gray-900">对话式 Copilot</span>
            {contextType !== "general" && contextTitle && (
              <Badge variant="info" className="ml-2 text-xs">{contextTitle}</Badge>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <Bot className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="font-semibold text-gray-700 mb-2">开始对话</h3>
              <p className="text-sm text-gray-500 max-w-sm">
                {contextType === "paper"
                  ? "围绕当前论文提问，AI 会优先从论文内容中寻找答案"
                  : "可以问我任何科研相关的问题，我会结合你的知识库来回答"}
              </p>
              <div className="mt-6 space-y-2 w-full max-w-sm">
                {[
                  contextType === "paper" ? "这篇论文的核心创新点是什么？" : "帮我解释一下注意力机制",
                  contextType === "paper" ? "实验是在哪些数据集上进行的？" : "联邦学习和集中式学习的区别是什么？",
                  contextType === "paper" ? "这篇论文有什么局限性？" : "如何选择合适的基线方法？",
                ].map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(suggestion)}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                msg.role === "user" ? "bg-brand-600" : "bg-gray-100"
              }`}>
                {msg.role === "user"
                  ? <User className="w-4 h-4 text-white" />
                  : <Bot className="w-4 h-4 text-gray-600" />
                }
              </div>
              <div className={`max-w-[80%] ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col gap-1`}>
                <div className={`rounded-2xl px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-brand-600 text-white rounded-tr-sm"
                    : "bg-white border border-gray-200 rounded-tl-sm"
                }`}>
                  {msg.role === "user"
                    ? <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    : <MarkdownRenderer content={msg.content} />
                  }
                </div>
                {msg.sources && msg.sources.length > 0 && msg.role === "assistant" && (
                  <div className="flex flex-wrap gap-1 ml-1">
                    {msg.sources.slice(0, 3).map((s, i) => (
                      <span key={i} title={s.content}
                        className="text-xs text-gray-400 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-full truncate max-w-[150px]">
                        📄 {s.source || `来源 ${i + 1}`}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                <Bot className="w-4 h-4 text-gray-600" />
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-gray-200 bg-white">
          <div className="flex gap-3 items-end">
            <textarea
              ref={inputRef}
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入问题... (Enter 发送，Shift+Enter 换行)"
              className="flex-1 resize-none rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 focus:bg-white transition-colors"
            />
            <Button
              onClick={handleSend}
              loading={sending}
              disabled={!input.trim()}
              size="md"
              className="flex-shrink-0 h-12 px-4"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CopilotPage() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-400">加载中...</div>}>
      <CopilotContent />
    </Suspense>
  );
}
