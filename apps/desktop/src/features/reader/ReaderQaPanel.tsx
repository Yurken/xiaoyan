import { ArrowUp, ChevronRight, MessageCircleQuestion, Trash2 } from "lucide-react";
import { MarkdownRenderer } from "@research-copilot/ui";
import { useEffect, useRef, useState } from "react";
import type { ReaderQaMessage } from "./useReaderQuestionAnswer";

interface ReaderQaPanelProps {
  width: number;
  currentPage: number;
  messages: ReaderQaMessage[];
  sending: boolean;
  error: string;
  onAsk: (question: string, page: number) => void;
  onClear: () => void;
  onCollapse: () => void;
  onDragStart: (event: React.MouseEvent) => void;
}

const suggestions = ["这篇论文的核心贡献是什么？", "当前方法依赖哪些关键假设？", "实验结果支持了什么结论？"];

export default function ReaderQaPanel({
  width,
  currentPage,
  messages,
  sending,
  error,
  onAsk,
  onClear,
  onCollapse,
  onDragStart,
}: ReaderQaPanelProps) {
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const submit = () => {
    const value = input.trim();
    if (!value || sending) return;
    setInput("");
    onAsk(value, currentPage);
  };

  return (
    <aside className="relative flex h-full shrink-0 flex-col border-l" style={{ width, background: "var(--rc-card-bg)", borderColor: "var(--rc-border)" }}>
      <div className="flex h-11 shrink-0 items-center gap-2 border-b px-3" style={{ borderColor: "var(--rc-border)" }}>
        <MessageCircleQuestion className="h-4 w-4 text-apple-blue" />
        <span className="text-sm font-semibold text-ink-primary">论文问答</span>
        <span className="text-[10px] text-ink-tertiary">第 {currentPage} 页</span>
        <button type="button" onClick={onClear} disabled={messages.length === 0} className="ml-auto text-ink-tertiary hover:text-apple-red disabled:opacity-30" title="清空问答">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={onCollapse} className="text-ink-tertiary hover:text-ink-secondary" title="收起问答">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {messages.length === 0 ? (
          <div className="pt-6">
            <p className="mb-4 text-center text-xs leading-5 text-ink-tertiary">小妍会结合当前论文原文与页码回答，并明确区分原文依据和推断。</p>
            <div className="space-y-1.5">
              {suggestions.map((suggestion) => (
                <button key={suggestion} type="button" onClick={() => onAsk(suggestion, currentPage)} className="w-full rounded-lg border px-3 py-2 text-left text-xs text-ink-secondary hover:text-apple-blue" style={{ borderColor: "var(--rc-border)" }}>
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            <div ref={endRef} />
          </div>
        )}
        {error ? <p className="mt-3 text-xs text-apple-red">{error}</p> : null}
      </div>

      <div className="shrink-0 border-t p-3" style={{ borderColor: "var(--rc-border)" }}>
        <div className="flex items-end gap-2 rounded-xl border p-2" style={{ borderColor: "var(--rc-border)", background: "var(--rc-card-inset-bg)" }}>
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            rows={2}
            placeholder="询问这篇论文…"
            className="rc-selectable min-h-10 flex-1 resize-none bg-transparent text-xs leading-5 text-ink-primary outline-none"
          />
          <button type="button" onClick={submit} disabled={!input.trim() || sending} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-apple-blue text-white disabled:opacity-40" title="发送问题">
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="absolute left-0 top-0 z-10 h-full w-1.5 cursor-col-resize transition-colors hover:bg-apple-blue/30" onMouseDown={onDragStart} />
    </aside>
  );
}

function MessageBubble({ message }: { message: ReaderQaMessage }) {
  const user = message.role === "user";
  return (
    <div className={user ? "ml-8" : "mr-2"}>
      <div
        className={`rounded-xl px-3 py-2 text-xs leading-5 ${user ? "whitespace-pre-wrap" : ""}`}
        style={user
          ? { background: "var(--rc-accent)", color: "white" }
          : { background: "var(--rc-card-inset-bg)", color: "var(--rc-text-primary)" }}
      >
        {user ? (
          message.content
        ) : message.content ? (
          <MarkdownRenderer
            content={message.content}
            className="rc-chat-markdown text-xs leading-5 prose-headings:my-2 prose-headings:text-sm prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-pre:my-2"
          />
        ) : message.status === "loading" ? (
          "正在阅读论文…"
        ) : null}
      </div>
      <span className={`mt-1 block text-[10px] text-ink-tertiary ${user ? "text-right" : ""}`}>第 {message.page} 页</span>
    </div>
  );
}
