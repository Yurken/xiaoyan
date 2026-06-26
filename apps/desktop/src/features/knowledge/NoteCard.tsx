import { Check, Pencil, Trash2 } from "lucide-react";
import { clsx } from "clsx";
import { Badge, Card } from "@research-copilot/ui";
import type { KnowledgeNote } from "@research-copilot/types";
import { sourceLabel, stripMarkdown } from "./notesShared";

/**
 * 知识卡片列表项。
 * - 常规模式：操作（编辑 / 删除）常驻可见，点击标题/正文打开。
 * - 选择模式：整卡可点选，右上角显示勾选框，隐藏编辑 / 删除。
 */
export default function NoteCard({
  note,
  linkedClaimCount = 0,
  interestName,
  onOpen,
  onDelete,
  selectionMode = false,
  selected = false,
  onToggleSelect,
}: {
  note: KnowledgeNote;
  linkedClaimCount?: number;
  interestName?: string;
  onOpen: (note: KnowledgeNote) => void;
  onDelete: (note: KnowledgeNote) => void;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (note: KnowledgeNote) => void;
}) {
  const activate = (event?: { stopPropagation: () => void }) => {
    event?.stopPropagation();
    if (selectionMode) onToggleSelect?.(note);
    else onOpen(note);
  };

  return (
    <Card
      padding="sm"
      className={clsx(
        "relative flex flex-col gap-3 transition-shadow",
        selectionMode && "cursor-pointer",
        selected && "ring-2 ring-apple-blue",
      )}
      onClick={selectionMode ? activate : undefined}
    >
      <div className="pr-16">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={activate}
            className="line-clamp-2 text-left text-sm font-semibold text-ink-primary transition-colors hover:text-apple-blue"
          >
            {note.title}
          </button>
          <Badge variant="default">{sourceLabel(note.source_type)}</Badge>
          {linkedClaimCount > 0 ? <Badge variant="info">图谱 {linkedClaimCount}</Badge> : null}
        </div>
        {interestName && (
          <p className="mt-1.5 text-[11px] text-apple-blue">{interestName}</p>
        )}
      </div>

      <button
        type="button"
        onClick={activate}
        className="text-left"
        aria-label={`查看 ${note.title}`}
      >
        <p className="line-clamp-4 text-xs leading-relaxed text-ink-secondary">{stripMarkdown(note.content)}</p>
      </button>

      {note.source_type !== "manual" && note.tags && note.tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-500">小妍</span>
          {note.tags.map((tag, index) => (
            <span key={`${note.id}-${tag}-${index}`} className="rc-accent-chip rounded-full px-2 py-0.5 text-[11px]">
              {tag}
            </span>
          ))}
        </div>
      )}

      <p className="mt-auto pt-1 text-xs text-ink-tertiary">
        {new Date(note.created_at).toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })}
      </p>

      {selectionMode ? (
        <div className="absolute right-3 top-3">
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
        </div>
      ) : (
        <div className="absolute right-3 top-3 flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => onOpen(note)}
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
    </Card>
  );
}
