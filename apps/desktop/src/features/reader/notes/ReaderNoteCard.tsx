import { ArrowLeftRight, Crosshair, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { HIGHLIGHT_COLORS, type NoteDockSide, type PaperNote } from "../readerTypes";

interface ReaderNoteCardProps {
  note: PaperNote;
  /** 卡片所在栏，用于「移到另一侧」的文案。 */
  side: NoteDockSide;
  active: boolean;
  flash: boolean;
  onHoverChange: (hovering: boolean) => void;
  onLocate: () => void;
  onMoveSide: () => void;
  onUpdateContent: (content: string) => void;
  onDelete: () => void;
}

export default function ReaderNoteCard({
  note,
  side,
  active,
  flash,
  onHoverChange,
  onLocate,
  onMoveSide,
  onUpdateContent,
  onDelete,
}: ReaderNoteCardProps) {
  const color = HIGHLIGHT_COLORS[note.highlight_color];
  const [draft, setDraft] = useState(note.content);
  const focusedRef = useRef(false);

  // 外部更新（撤销、别处编辑）时同步草稿；正在输入则不打断。
  useEffect(() => {
    if (!focusedRef.current) setDraft(note.content);
  }, [note.content]);

  const commit = () => {
    if (draft === note.content) return;
    onUpdateContent(draft);
  };

  const otherSideLabel = side === "left" ? "右栏" : "左栏";
  // 只留一行原文作定位参考：压掉 PDF 抽取带来的硬换行。
  const quote = (note.highlight_text ?? "").replace(/\s+/g, " ").trim();

  return (
    <article
      data-note-id={note.id}
      className={`group relative rounded-xl border px-2.5 py-2 transition-colors${flash ? " note-dock-card--flash" : ""}`}
      style={{
        borderColor: active ? color.border : "var(--rc-border)",
        background: active ? "var(--rc-chip-bg)" : "var(--rc-card-bg)",
        boxShadow: active ? "var(--rc-card-flat-shadow-sm)" : "none",
      }}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
    >
      <div className="mb-1 flex items-center gap-1.5">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color.border }} />
        <span className="text-[10px] font-semibold text-ink-tertiary">第 {note.page} 页</span>
        <div className="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          <CardAction label="定位到原文" onClick={onLocate} icon={Crosshair} />
          <CardAction label={`移到${otherSideLabel}`} onClick={onMoveSide} icon={ArrowLeftRight} />
          <CardAction label="删除笔记" onClick={onDelete} icon={Trash2} danger />
        </div>
      </div>

      {quote ? (
        <button
          type="button"
          onClick={onLocate}
          title={`${quote}\n\n点击定位到原文`}
          className="mb-1.5 block w-full truncate border-l-2 pl-2 text-left text-[10px] leading-4 text-ink-tertiary transition-colors hover:text-ink-secondary"
          style={{ borderColor: color.border }}
        >
          {quote}
        </button>
      ) : null}

      <AutoGrowTextarea
        value={draft}
        placeholder="写点想法…"
        onChange={setDraft}
        onFocus={() => {
          focusedRef.current = true;
        }}
        onBlur={() => {
          focusedRef.current = false;
          commit();
        }}
        onCommit={() => {
          focusedRef.current = false;
          commit();
        }}
      />
    </article>
  );
}

function CardAction({
  label,
  onClick,
  icon: Icon,
  danger = false,
}: {
  label: string;
  onClick: () => void;
  icon: typeof Crosshair;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      title={label}
      aria-label={label}
      className={`flex h-5 w-5 items-center justify-center rounded transition-colors ${
        danger ? "text-ink-tertiary hover:bg-apple-red/10 hover:text-apple-red" : "text-ink-tertiary hover:bg-apple-blue/10 hover:text-apple-blue"
      }`}
    >
      <Icon className="h-3 w-3" />
    </button>
  );
}

function AutoGrowTextarea({
  value,
  placeholder,
  onChange,
  onFocus,
  onBlur,
  onCommit,
}: {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  onCommit: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(200, Math.max(40, element.scrollHeight))}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      rows={2}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={(event) => {
        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          onCommit();
          event.currentTarget.blur();
        }
        // 卡片在笔记栏内滚动，别让输入框的滚轮/按键冒泡到 PDF。
        event.stopPropagation();
      }}
      className="rc-selectable w-full resize-none overflow-y-auto rounded-lg border px-2 py-1.5 text-[11px] leading-4 text-ink-primary outline-none"
      style={{ borderColor: "var(--rc-border)", background: "var(--rc-card-inset-bg)", minHeight: 40 }}
    />
  );
}
