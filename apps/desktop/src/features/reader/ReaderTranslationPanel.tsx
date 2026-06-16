import { useState } from "react";
import { Check, Copy, Eraser, Languages, Trash2 } from "lucide-react";
import type { TranslationEntry } from "./useReaderTranslation";

interface ReaderTranslationPanelProps {
  entries: TranslationEntry[];
  onRemove: (id: string) => void;
  onClear: () => void;
}

export default function ReaderTranslationPanel({ entries, onRemove, onClear }: ReaderTranslationPanelProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copy = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 1200);
  };

  return (
    <aside
      className="flex h-full w-72 shrink-0 flex-col border-l"
      style={{ background: "var(--rc-card-bg)", borderColor: "var(--rc-border)" }}
    >
      <div className="flex h-11 shrink-0 items-center gap-2 border-b px-3" style={{ borderColor: "var(--rc-border)" }}>
        <Languages className="h-4 w-4 text-apple-blue" />
        <span className="text-sm font-bold text-ink-primary">翻译</span>
        <span className="ml-auto text-xs text-ink-tertiary">{entries.length}</span>
        {entries.length > 0 ? (
          <button
            type="button"
            onClick={onClear}
            className="rounded p-1 text-ink-tertiary transition-colors hover:text-apple-red"
            title="清空翻译"
          >
            <Eraser className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {entries.length === 0 ? (
          <div
            className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 text-center"
            style={{ borderColor: "var(--rc-border)" }}
          >
            <Languages className="h-5 w-5 text-ink-tertiary" />
            <p className="text-xs leading-5 text-ink-tertiary">在 PDF 中选中文字并点击「翻译」，译文会显示在这里。</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="group rounded-xl border p-2.5"
                style={{ borderColor: "var(--rc-border)", background: "var(--rc-card-inset-bg)" }}
              >
                <div className="flex items-center gap-1.5">
                  {entry.page ? (
                    <span className="text-[11px] font-semibold text-ink-tertiary">第 {entry.page} 页</span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => onRemove(entry.id)}
                    className="ml-auto rounded p-1 text-ink-tertiary opacity-0 transition-all hover:text-apple-red group-hover:opacity-100"
                    title="删除这条翻译"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <p className="mt-1 line-clamp-3 text-[11px] leading-4 text-ink-tertiary">{entry.source}</p>

                <div className="mt-1.5 border-t pt-1.5" style={{ borderColor: "var(--rc-border)" }}>
                  {entry.status === "loading" ? (
                    <p className="text-xs text-ink-tertiary">小妍翻译中…</p>
                  ) : entry.status === "error" ? (
                    <p className="text-xs text-apple-red">{entry.error}</p>
                  ) : (
                    <>
                      <p className="whitespace-pre-wrap text-xs leading-5 text-ink-primary">{entry.result}</p>
                      <button
                        type="button"
                        onClick={() => void copy(entry.id, entry.result)}
                        className="mt-1.5 flex items-center gap-1 text-[11px] text-ink-tertiary transition-colors hover:text-apple-blue"
                      >
                        {copiedId === entry.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        {copiedId === entry.id ? "已复制" : "复制译文"}
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
