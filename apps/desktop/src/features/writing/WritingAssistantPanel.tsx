import { useEffect, useMemo, useRef, useState } from "react";
import { clsx } from "clsx";
import {
  Clipboard,
  FilePenLine,
  RefreshCcw,
  Send,
  Sparkles,
  Square,
  X,
} from "lucide-react";
import { Button, MarkdownRenderer } from "@research-copilot/ui";
import {
  WRITING_ASSISTANT_ACTIONS,
  type LatexDiagnostic,
  type LatexOutlineEntry,
  type LatexStats,
  type WritingAssistantActionId,
} from "./shared";
import { WRITING_ASSISTANT_ACTION_ICONS } from "./WritingEditorContextMenuData";
import { useWritingAssistant } from "./useWritingAssistant";

interface WritingAssistantPanelProps {
  open: boolean;
  projectName: string;
  mainTex: string;
  bibtex: string;
  notes: string;
  outline: LatexOutlineEntry[];
  diagnostics: LatexDiagnostic[];
  stats: LatexStats;
  getSelectedText: () => string;
  onApplyText: (text: string) => void;
  requestedAction?: { actionId: WritingAssistantActionId; nonce: number } | null;
  onClose: () => void;
}

export default function WritingAssistantPanel({
  open,
  projectName,
  mainTex,
  bibtex,
  notes,
  outline,
  diagnostics,
  stats,
  getSelectedText,
  onApplyText,
  requestedAction,
  onClose,
}: WritingAssistantPanelProps) {
  const [activeAction, setActiveAction] = useState<WritingAssistantActionId>("freeform");
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const handledRequestNonce = useRef(0);
  const assistant = useWritingAssistant({
    projectName,
    mainTex,
    bibtex,
    notes,
    outline,
    diagnostics,
    stats,
    getSelectedText,
  });
  const latestText = assistant.latestAssistantMessage?.content.trim() ?? "";
  const canSubmit = !assistant.sending && (input.trim() || activeAction !== "freeform");

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, 20);
    return () => window.clearTimeout(timer);
  }, [assistant.messages, open]);

  // 右键菜单触发的功能：切到对应动作；除“问小妍”外（需要用户输入）直接基于当前选区运行。
  useEffect(() => {
    if (!open || !requestedAction) return;
    if (requestedAction.nonce === handledRequestNonce.current) return;
    handledRequestNonce.current = requestedAction.nonce;
    setActiveAction(requestedAction.actionId);
    if (requestedAction.actionId !== "freeform") {
      void assistant.send(requestedAction.actionId, "");
    }
  }, [open, requestedAction, assistant]);

  const activeActionMeta = useMemo(
    () => WRITING_ASSISTANT_ACTIONS.find((action) => action.id === activeAction) ?? WRITING_ASSISTANT_ACTIONS[0],
    [activeAction],
  );

  if (!open) return null;

  const submit = () => {
    if (!canSubmit) return;
    void assistant.send(activeAction, input);
    setInput("");
  };

  return (
    <div className="fixed inset-0 z-[80] flex justify-end">
      <button
        type="button"
        aria-label="关闭小妍辅助写作"
        className="absolute inset-0 bg-black/20"
        onClick={onClose}
      />
      <aside
        className="relative flex h-full w-[28rem] max-w-[calc(100vw-1.5rem)] flex-col border-l shadow-2xl"
        style={{ background: "var(--rc-card-bg)", borderColor: "var(--rc-border)" }}
      >
        <header
          className="shrink-0 border-b px-4 py-3"
          style={{ borderColor: "var(--rc-border)", background: "var(--rc-header-bg)" }}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-apple-blue/10 text-apple-blue">
              <Sparkles className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-ink-primary">小妍辅助写作</p>
              <p className="truncate text-xs text-ink-tertiary">{projectName || "未命名文稿"}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              title="关闭"
              className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-ink-tertiary transition-colors hover:bg-white/5 hover:text-ink-secondary"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 grid grid-cols-5 gap-1.5">
            {WRITING_ASSISTANT_ACTIONS.map((action) => {
              const Icon = WRITING_ASSISTANT_ACTION_ICONS[action.id];
              const active = activeAction === action.id;
              return (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => setActiveAction(action.id)}
                  title={action.description}
                  className={clsx(
                    "flex h-14 flex-col items-center justify-center gap-1 rounded-lg border text-[11px] font-semibold transition-colors",
                    active ? "border-apple-blue/40 bg-apple-blue/10 text-apple-blue" : "text-ink-tertiary hover:bg-white/5 hover:text-ink-secondary",
                  )}
                  style={{ borderColor: active ? "rgba(0,122,255,0.35)" : "var(--rc-border)" }}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{action.title}</span>
                </button>
              );
            })}
          </div>
        </header>

        <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {assistant.messages.length === 0 ? (
            <div
              className="flex h-48 flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 text-center"
              style={{ borderColor: "var(--rc-border)" }}
            >
              <Sparkles className="h-6 w-6 text-apple-blue" />
              <p className="mt-3 text-sm font-semibold text-ink-primary">{activeActionMeta.title}</p>
              <p className="mt-1 text-xs leading-5 text-ink-tertiary">{activeActionMeta.description}</p>
            </div>
          ) : (
            assistant.messages.map((message) => (
              <article
                key={message.id}
                className={clsx(
                  "rounded-xl border px-3 py-2.5",
                  message.role === "user" ? "ml-8" : "mr-8",
                )}
                style={{
                  borderColor: "var(--rc-border)",
                  background: message.role === "user" ? "rgba(0,122,255,0.08)" : "var(--rc-card-inset-bg)",
                }}
              >
                <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-ink-tertiary">
                  {message.role === "user" ? "你" : "小妍"}
                </div>
                {message.role === "assistant" ? (
                  message.content.trim() ? (
                    <MarkdownRenderer content={message.content} className="prose-p:my-1 prose-pre:my-2" />
                  ) : (
                    <p className="text-xs text-ink-tertiary">小妍正在整理...</p>
                  )
                ) : (
                  <p className="whitespace-pre-wrap text-xs leading-5 text-ink-secondary">{message.content}</p>
                )}
              </article>
            ))
          )}
        </div>

        {assistant.error ? (
          <div className="mx-4 mb-3 rounded-lg bg-apple-red/10 px-3 py-2 text-xs text-apple-red">
            {assistant.error}
          </div>
        ) : null}

        <footer className="shrink-0 border-t p-4" style={{ borderColor: "var(--rc-border)" }}>
          <div className="mb-3 flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={!latestText || assistant.sending}
              onClick={() => onApplyText(latestText)}
            >
              <FilePenLine className="h-3.5 w-3.5" />
              写入正文
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={!latestText}
              onClick={() => void navigator.clipboard.writeText(latestText)}
            >
              <Clipboard className="h-3.5 w-3.5" />
              复制
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={assistant.reset} disabled={assistant.sending && !latestText}>
              <RefreshCcw className="h-3.5 w-3.5" />
              清空
            </Button>
            {assistant.sending ? (
              <Button type="button" size="sm" variant="ghost" onClick={assistant.cancel}>
                <Square className="h-3.5 w-3.5" />
                停止
              </Button>
            ) : null}
          </div>

          <div
            className="overflow-hidden rounded-2xl border"
            style={{ borderColor: "var(--rc-border)", background: "var(--rc-card-inset-bg)" }}
          >
            <textarea
              rows={3}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  submit();
                }
              }}
              placeholder={`${activeActionMeta.title}：补充你的具体要求`}
              className="rc-selectable min-h-20 w-full resize-none border-0 bg-transparent px-3 py-3 text-sm leading-5 text-ink-primary outline-none placeholder:text-ink-tertiary/60"
            />
            <div className="flex items-center justify-between border-t px-3 py-2" style={{ borderColor: "var(--rc-border)" }}>
              <span className="text-[11px] text-ink-tertiary">{mainTex.length.toLocaleString()} chars</span>
              <Button type="button" size="sm" onClick={submit} disabled={!canSubmit} loading={assistant.sending}>
                <Send className="h-3.5 w-3.5" />
                发送
              </Button>
            </div>
          </div>
        </footer>
      </aside>
    </div>
  );
}
