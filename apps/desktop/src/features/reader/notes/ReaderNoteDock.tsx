import "./note-dock.css";
import { ChevronLeft, ChevronRight, StickyNote } from "lucide-react";
import { useEffect, useRef } from "react";
import type { NoteDockSide, PaperNote } from "../readerTypes";
import { NOTE_DOCK_RAIL_WIDTH, type NoteDockMode } from "./dockLayout";
import ReaderNoteCard from "./ReaderNoteCard";

interface ReaderNoteDockProps {
  side: NoteDockSide;
  mode: NoteDockMode;
  width: number;
  notes: PaperNote[];
  /** 空间不足被自动收起（与用户手动收起区分，只影响提示文案）。 */
  autoCollapsed: boolean;
  activeNoteId: string | null;
  flashNoteId: string | null;
  onWidthChange: (width: number) => void;
  onExpand: () => void;
  onCollapse: () => void;
  onHoverNote: (note: PaperNote | null) => void;
  onLocate: (note: PaperNote) => void;
  onMoveSide: (note: PaperNote) => void;
  onUpdateContent: (note: PaperNote, content: string) => void;
  onDelete: (note: PaperNote) => void;
  /** 悬停细缝：细线持续显示；离开：恢复自动隐藏。 */
  onIndicatorHold: () => void;
  onIndicatorRelease: () => void;
}

export default function ReaderNoteDock({
  side,
  mode,
  width,
  notes,
  autoCollapsed,
  activeNoteId,
  flashNoteId,
  onWidthChange,
  onExpand,
  onCollapse,
  onHoverNote,
  onLocate,
  onMoveSide,
  onUpdateContent,
  onDelete,
  onIndicatorHold,
  onIndicatorRelease,
}: ReaderNoteDockProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const label = side === "left" ? "左栏笔记" : "右栏笔记";

  // 新建/移动过来的笔记立刻滚进视野，避免“存了但看不到”。
  useEffect(() => {
    if (!flashNoteId) return;
    const card = listRef.current?.querySelector(`[data-note-id="${flashNoteId}"]`);
    card?.scrollIntoView({ block: "nearest" });
  }, [flashNoteId]);

  if (mode === "collapsed") {
    return (
      <div
        className="relative flex h-full shrink-0 items-stretch"
        style={{ width: NOTE_DOCK_RAIL_WIDTH, background: "transparent" }}
        onMouseEnter={onIndicatorHold}
        onMouseLeave={onIndicatorRelease}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2"
          style={{ background: "linear-gradient(to bottom, transparent, var(--rc-border) 10%, var(--rc-border) 90%, transparent)" }}
        />
        <button
          type="button"
          onClick={onExpand}
          title={`${autoCollapsed ? "空间不足，已自动收起" : "已收起"}：${notes.length} 条笔记。点击展开${label}`}
          aria-label={`展开${label}`}
          className="note-dock-rail group relative flex h-full w-full items-start justify-center pt-3"
        >
          <span
            className="flex h-7 w-[10px] items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
            style={{ background: "var(--rc-chip-bg)", boxShadow: "var(--rc-chip-shadow)", color: "var(--rc-accent)" }}
          >
            {side === "left" ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
          </span>
        </button>
      </div>
    );
  }

  return (
    <aside
      className={`relative flex h-full shrink-0 flex-col ${side === "left" ? "border-r" : "border-l"}`}
      style={{ width, background: "var(--rc-card-bg)", borderColor: "var(--rc-border)" }}
      aria-label={label}
    >
      <div className="flex h-11 shrink-0 items-center gap-1.5 border-b px-3" style={{ borderColor: "var(--rc-border)" }}>
        <StickyNote className="h-3.5 w-3.5" style={{ color: "var(--rc-accent)" }} />
        <span className="text-xs font-semibold text-ink-primary">{label}</span>
        <span className="rounded-full px-1.5 text-[10px] tabular-nums text-ink-tertiary" style={{ background: "var(--rc-chip-inset-bg)" }}>
          {notes.length}
        </span>
        <button
          type="button"
          onClick={onCollapse}
          title="收起笔记栏（收起后用细线标记原文位置）"
          aria-label={`收起${label}`}
          className="ml-auto flex h-6 w-6 items-center justify-center rounded-md text-ink-tertiary transition-colors hover:bg-white/5 hover:text-ink-secondary"
        >
          {side === "left" ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      </div>

      <div ref={listRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-2.5 py-2.5">
        {notes.length === 0 ? (
          <div
            className="flex h-full min-h-32 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-3 text-center"
            style={{ borderColor: "var(--rc-border)" }}
          >
            <StickyNote className="h-5 w-5 text-ink-tertiary" />
            <p className="text-[11px] leading-5 text-ink-tertiary">
              选中正文后点「笔记」，会作为批注自动存入离选区最近的一栏；
              <br />
              译文也能一键存进来。
            </p>
          </div>
        ) : (
          notes.map((note) => (
            <ReaderNoteCard
              key={note.id}
              note={note}
              side={side}
              active={activeNoteId === note.id}
              flash={flashNoteId === note.id}
              onHoverChange={(hovering) => onHoverNote(hovering ? note : null)}
              onLocate={() => onLocate(note)}
              onMoveSide={() => onMoveSide(note)}
              onUpdateContent={(content) => onUpdateContent(note, content)}
              onDelete={() => onDelete(note)}
            />
          ))
        )}
      </div>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={`调整${label}宽度`}
        className={`absolute top-0 z-10 h-full w-1.5 cursor-col-resize transition-colors hover:bg-apple-blue/30 ${
          side === "left" ? "right-0" : "left-0"
        }`}
        onMouseDown={(event) => {
          event.preventDefault();
          const startX = event.clientX;
          const startWidth = width;
          const direction = side === "left" ? 1 : -1;
          const onMove = (moveEvent: MouseEvent) => {
            onWidthChange(startWidth + (moveEvent.clientX - startX) * direction);
          };
          const onUp = () => {
            document.body.style.cursor = "";
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
          };
          document.body.style.cursor = "col-resize";
          window.addEventListener("mousemove", onMove);
          window.addEventListener("mouseup", onUp);
        }}
      />
    </aside>
  );
}
