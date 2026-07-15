import { useNavigate } from "react-router-dom";
import { Check, Eye, Trash2 } from "lucide-react";
import { clsx } from "clsx";
import type { KnowledgeNote } from "@research-copilot/types";

interface NoteCompactRowProps {
  note: KnowledgeNote;
  linkedClaimCount?: number;
  onDelete: (note: KnowledgeNote) => void;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (note: KnowledgeNote) => void;
}

export default function NoteCompactRow({
  note,
  linkedClaimCount = 0,
  onDelete,
  selectionMode = false,
  selected = false,
  onToggleSelect,
}: NoteCompactRowProps) {
  const navigate = useNavigate();

  const openNote = (event?: { stopPropagation: () => void }) => {
    event?.stopPropagation();
    if (selectionMode) {
      onToggleSelect?.(note);
      return;
    }
    navigate(`/notes/${note.id}`, { state: { note, linkedClaimCount } });
  };

  return (
    <article
      data-testid="note-compact-row"
      className={clsx(
        "group flex min-w-0 items-center gap-3 rounded-2xl border px-3 py-2.5 transition-colors",
        selectionMode && "cursor-pointer",
        selected && "ring-2 ring-apple-blue",
      )}
      style={{
        background: "var(--rc-card-bg)",
        borderColor: "var(--rc-card-outline)",
        boxShadow: "var(--rc-card-shadow)",
      }}
      onClick={selectionMode ? openNote : undefined}
    >
      <button
        type="button"
        onClick={openNote}
        className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-ink-primary transition-colors hover:text-apple-blue"
      >
        {note.title}
      </button>

      {selectionMode ? (
        <span
          aria-label={selected ? "已选择" : "未选择"}
          className={clsx(
            "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border transition-colors",
            selected ? "border-apple-blue bg-apple-blue text-white" : "text-transparent",
          )}
          style={selected ? undefined : { borderColor: "var(--rc-border)", background: "var(--rc-card-inset-bg)" }}
        >
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
        </span>
      ) : (
        <div className="flex flex-shrink-0 items-center gap-1" aria-label={`${note.title} 的操作`}>
          <button
            type="button"
            onClick={openNote}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-ink-tertiary transition-colors hover:text-apple-blue"
            title="打开笔记"
            aria-label={`打开 ${note.title}`}
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(note)}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-ink-tertiary transition-colors hover:text-[var(--rc-apple-red,#FF3B30)]"
            title="删除笔记"
            aria-label={`删除 ${note.title}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}
    </article>
  );
}
