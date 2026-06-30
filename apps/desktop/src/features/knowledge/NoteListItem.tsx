import { useNavigate } from "react-router-dom";
import { clsx } from "clsx";
import { Check, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@research-copilot/ui";
import type { KnowledgeNote } from "@research-copilot/types";
import { sourceLabel, stripMarkdown } from "./notesShared";

interface NoteListItemProps {
  note: KnowledgeNote;
  linkedClaimCount?: number;
  interestName?: string;
  onDelete: (note: KnowledgeNote) => void;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (note: KnowledgeNote) => void;
}

export default function NoteListItem({
  note,
  linkedClaimCount = 0,
  interestName,
  onDelete,
  selectionMode = false,
  selected = false,
  onToggleSelect,
}: NoteListItemProps) {
  const navigate = useNavigate();

  const openNote = (event?: { stopPropagation: () => void }) => {
    event?.stopPropagation();
    if (selectionMode) onToggleSelect?.(note);
    else navigate(`/notes/${note.id}`, { state: { note, linkedClaimCount } });
  };

  return (
    <div
      className={clsx(
        "group relative flex items-center gap-3 rounded-xl border border-nm-dark/10 bg-white/50 px-4 py-3 transition-colors",
        selectionMode && "cursor-pointer",
        selected && "ring-2 ring-apple-blue",
        !selectionMode && "hover:bg-white/70",
      )}
      onClick={selectionMode ? openNote : undefined}
    >
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openNote}
            className="truncate text-left text-sm font-semibold text-ink-primary transition-colors hover:text-apple-blue"
          >
            {note.title}
          </button>
          <Badge variant="default">{sourceLabel(note.source_type)}</Badge>
          {linkedClaimCount > 0 ? <Badge variant="info">图谱 {linkedClaimCount}</Badge> : null}
          {interestName && (
            <span className="text-[11px] text-apple-blue">{interestName}</span>
          )}
        </div>
        <button type="button" onClick={openNote} className="block w-full text-left">
          <p className="mt-1 truncate text-xs leading-relaxed text-ink-secondary">
            {stripMarkdown(note.content)}
          </p>
        </button>
      </div>

      <div className="flex flex-shrink-0 items-center gap-3">
        <span className="text-xs text-ink-tertiary">
          {new Date(note.created_at).toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })}
        </span>
        {selectionMode ? (
          <span
            className={clsx(
              "flex h-5 w-5 items-center justify-center rounded-md border transition-colors",
              selected
                ? "border-apple-blue bg-apple-blue text-white"
                : "border-nm-dark/25 bg-white/60 text-transparent",
            )}
          >
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          </span>
        ) : (
          <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              onClick={openNote}
              className="rounded-lg p-1.5 text-ink-tertiary transition-colors hover:bg-black/5 hover:text-ink-primary"
              aria-label={`编辑 ${note.title}`}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(note)}
              className="rounded-lg p-1.5 text-ink-tertiary transition-colors hover:bg-apple-red/10 hover:text-apple-red"
              aria-label={`删除 ${note.title}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
