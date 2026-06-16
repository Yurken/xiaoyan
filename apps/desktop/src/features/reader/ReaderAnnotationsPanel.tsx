import { Highlighter, Trash2, Underline } from "lucide-react";
import { HIGHLIGHT_COLORS, type PaperNote } from "./readerTypes";

interface ReaderAnnotationsPanelProps {
  notes: PaperNote[];
  loading: boolean;
  onJumpToPage: (page: number) => void;
  onDelete: (id: string) => void;
}

export default function ReaderAnnotationsPanel({ notes, loading, onJumpToPage, onDelete }: ReaderAnnotationsPanelProps) {
  const sorted = [...notes].sort((a, b) => a.page - b.page || a.created_at.localeCompare(b.created_at));

  return (
    <aside
      className="flex h-full w-72 shrink-0 flex-col border-l"
      style={{ background: "var(--rc-card-bg)", borderColor: "var(--rc-border)" }}
    >
      <div className="flex h-11 shrink-0 items-center gap-2 border-b px-3" style={{ borderColor: "var(--rc-border)" }}>
        <Highlighter className="h-4 w-4 text-apple-blue" />
        <span className="text-sm font-bold text-ink-primary">批注</span>
        <span className="ml-auto text-xs text-ink-tertiary">{notes.length}</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {loading ? (
          <p className="px-1 py-6 text-center text-xs text-ink-tertiary">加载中…</p>
        ) : sorted.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 text-center" style={{ borderColor: "var(--rc-border)" }}>
            <Highlighter className="h-5 w-5 text-ink-tertiary" />
            <p className="text-xs leading-5 text-ink-tertiary">在 PDF 中选中文字，即可高亮、下划线或翻译。</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {sorted.map((note) => {
              const color = HIGHLIGHT_COLORS[note.highlight_color];
              return (
                <li
                  key={note.id}
                  className="group rounded-xl border p-2.5 transition-colors hover:border-apple-blue/30"
                  style={{ borderColor: "var(--rc-border)", background: "var(--rc-card-inset-bg)" }}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: color.bg, border: `1.5px solid ${color.border}` }} />
                    {note.style === "underline" ? (
                      <Underline className="h-3 w-3 text-ink-tertiary" />
                    ) : (
                      <Highlighter className="h-3 w-3 text-ink-tertiary" />
                    )}
                    <button
                      type="button"
                      onClick={() => onJumpToPage(note.page)}
                      className="text-[11px] font-semibold text-ink-tertiary transition-colors hover:text-apple-blue"
                    >
                      第 {note.page} 页
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(note.id)}
                      className="ml-auto rounded p-1 text-ink-tertiary opacity-0 transition-all hover:text-apple-red group-hover:opacity-100"
                      title="删除批注"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {note.highlight_text ? (
                    <button
                      type="button"
                      onClick={() => onJumpToPage(note.page)}
                      className="mt-1.5 block w-full text-left"
                    >
                      <p className="line-clamp-3 text-xs leading-5 text-ink-secondary">{note.highlight_text}</p>
                    </button>
                  ) : null}
                  {note.content ? (
                    <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-ink-tertiary">{note.content}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
