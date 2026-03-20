import { useState, useEffect, useRef } from "react";
import { Send, Bot, User, Plus } from "lucide-react";
import { Button, MarkdownRenderer } from "@research-copilot/ui";
import { apiClient } from "../lib/client";
import type { ChatMessage, ChatSession } from "@research-copilot/types";

export default function Copilot() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiClient.chat.listSessions().then(setSessions);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadSession = async (s: ChatSession) => {
    const data = await apiClient.chat.getSession(s.id);
    setCurrentSession(data);
    setMessages(data.messages ?? []);
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
      let sessionId = currentSession?.id;
      for await (const chunk of apiClient.chat.stream({
        session_id: currentSession?.id,
        message: text,
      })) {
        if (chunk.type === "session_id") sessionId = chunk.value;
        else if (chunk.type === "delta") {
          setMessages((prev) =>
            prev.map((m) => m.id === assistantId ? { ...m, content: m.content + chunk.value } : m)
          );
        }
      }
      if (sessionId && !currentSession) {
        const updated = await apiClient.chat.listSessions();
        setSessions(updated);
        setCurrentSession({ id: sessionId } as ChatSession);
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-52 flex-shrink-0 border-r border-gray-200 flex flex-col bg-gray-50">
        <div className="p-3 border-b border-gray-200">
          <Button size="sm" variant="secondary" className="w-full"
            onClick={() => { setCurrentSession(null); setMessages([]); }}>
            <Plus className="w-4 h-4" /> 新对话
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessions.map((s) => (
            <button key={s.id} onClick={() => loadSession(s)}
              className={`w-full text-left px-2 py-2 rounded-lg text-xs transition-colors ${
                currentSession?.id === s.id ? "bg-brand-50 text-brand-700" : "hover:bg-gray-100 text-gray-600"
              }`}>
              <div className="truncate font-medium">{s.title}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-12 flex items-center px-4 border-b border-gray-200 bg-white">
          <span className="font-semibold text-sm text-gray-800">对话式 Copilot</span>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((m) => (
            <div key={m.id} className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                m.role === "user" ? "bg-brand-600" : "bg-gray-100"}`}>
                {m.role === "user"
                  ? <User className="w-3.5 h-3.5 text-white" />
                  : <Bot className="w-3.5 h-3.5 text-gray-600" />}
              </div>
              <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                m.role === "user"
                  ? "bg-brand-600 text-white"
                  : "bg-white border border-gray-200"}`}>
                {m.role === "user"
                  ? <p className="whitespace-pre-wrap">{m.content}</p>
                  : <MarkdownRenderer content={m.content || "…"} />}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        <div className="p-3 border-t border-gray-200 bg-white flex gap-2">
          <textarea
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="输入问题… (Enter 发送)"
            className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <Button onClick={handleSend} loading={sending} disabled={!input.trim()} className="h-full px-3">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
