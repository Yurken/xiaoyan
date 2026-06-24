import { useState } from "react";
import {
  Ban,
  BookMarked,
  Check,
  Copy,
  Highlighter,
  Languages,
  Sparkles,
  StickyNote,
  Strikethrough,
  Trash2,
  Underline,
  X,
} from "lucide-react";
import {
  HIGHLIGHT_COLORS,
  type AnnotationStyle,
  type HighlightColor,
} from "./readerTypes";

interface SelectionPopupProps {
  x: number;
  y: number;
  selectedText: string;
  /** "create"：划词后新建批注；"edit"：点击已有高亮再次编辑。 */
  mode?: "create" | "edit";
  initialColor?: HighlightColor;
  /** 编辑形状时为 true：颜色点表示边框色，并额外显示填充选择。 */
  isShape?: boolean;
  initialFill?: HighlightColor | null;
  onAnnotate?: (color: HighlightColor, style: AnnotationStyle, note?: string) => void;
  onSaveCorpus?: (note?: string) => void;
  onRecolor?: (color: HighlightColor) => void;
  onRecolorFill?: (fill: HighlightColor | null) => void;
  onDelete?: () => void;
  onTranslate: () => void;
  onInterpret?: () => void;
  onClose: () => void;
}

const colorKeys = Object.keys(HIGHLIGHT_COLORS) as HighlightColor[];

type Panel = "none" | "note" | "corpus";

export default function SelectionPopup({
  x,
  y,
  selectedText,
  mode = "create",
  initialColor = "yellow",
  isShape = false,
  initialFill = null,
  onAnnotate,
  onSaveCorpus,
  onRecolor,
  onRecolorFill,
  onDelete,
  onTranslate,
  onInterpret,
  onClose,
}: SelectionPopupProps) {
  const isEdit = mode === "edit";
  const [activeColor, setActiveColor] = useState<HighlightColor>(initialColor);
  const [activeFill, setActiveFill] = useState<HighlightColor | null>(initialFill);
  const [panel, setPanel] = useState<Panel>("none");
  const [noteText, setNoteText] = useState("");
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(selectedText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  const pickColor = (color: HighlightColor) => {
    setActiveColor(color);
    if (isEdit) onRecolor?.(color);
  };

  const createActions: Array<{ key: string; icon: typeof Copy; label: string; onClick: () => void; active?: boolean }> = [
    { key: "copy", icon: copied ? Check : Copy, label: copied ? "已复制" : "复制", onClick: () => void copy() },
    { key: "highlight", icon: Highlighter, label: "高亮", onClick: () => onAnnotate?.(activeColor, "highlight") },
    { key: "underline", icon: Underline, label: "下划线", onClick: () => onAnnotate?.(activeColor, "underline") },
    { key: "strike", icon: Strikethrough, label: "删除线", onClick: () => onAnnotate?.(activeColor, "strike") },
    { key: "note", icon: StickyNote, label: "笔记", onClick: () => setPanel((p) => (p === "note" ? "none" : "note")), active: panel === "note" },
    { key: "corpus", icon: BookMarked, label: "语料", onClick: () => setPanel((p) => (p === "corpus" ? "none" : "corpus")), active: panel === "corpus" },
    { key: "interpret", icon: Sparkles, label: "解读", onClick: () => onInterpret?.() },
    { key: "translate", icon: Languages, label: "翻译", onClick: onTranslate },
  ];

  const editActions: Array<{ key: string; icon: typeof Copy; label: string; onClick: () => void; danger?: boolean }> = [
    { key: "copy", icon: copied ? Check : Copy, label: copied ? "已复制" : "复制", onClick: () => void copy() },
    { key: "translate", icon: Languages, label: "翻译", onClick: onTranslate },
    { key: "delete", icon: Trash2, label: "删除", onClick: () => onDelete?.(), danger: true },
  ];

  return (
    <div
      className="pdf-selection-popup fixed z-[80]"
      style={{
        left: Math.max(8, Math.min(x, window.innerWidth - 400)),
        top: Math.max(8, y - 12),
        transform: "translateY(-100%)",
      }}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div
        className="w-[380px] rounded-xl border p-2 shadow-2xl"
        style={{ background: "var(--rc-card-bg)", borderColor: "var(--rc-border)", boxShadow: "0 12px 36px rgba(15,23,42,0.22)" }}
      >
        <div className="mb-1.5 flex items-center gap-1.5 px-1">
          {isEdit && isShape ? <span className="text-[11px] text-ink-tertiary">边框</span> : null}
          {colorKeys.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => pickColor(c)}
              className="h-5 w-5 rounded-full border-2 transition-transform hover:scale-110"
              style={{ background: HIGHLIGHT_COLORS[c].bg, borderColor: activeColor === c ? HIGHLIGHT_COLORS[c].border : "transparent" }}
              title={isShape ? `边框${HIGHLIGHT_COLORS[c].label}` : HIGHLIGHT_COLORS[c].label}
            />
          ))}
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-md p-0.5 text-ink-tertiary transition-colors hover:bg-white/5 hover:text-ink-secondary"
            title="关闭"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {isEdit && isShape ? (
          <div className="mb-1.5 flex items-center gap-1.5 px-1">
            <span className="text-[11px] text-ink-tertiary">填充</span>
            <button
              type="button"
              onClick={() => {
                setActiveFill(null);
                onRecolorFill?.(null);
              }}
              title="无填充"
              className="flex h-5 w-5 items-center justify-center rounded-full border-2 text-ink-tertiary transition-transform hover:scale-110"
              style={{ borderColor: activeFill == null ? "var(--rc-accent)" : "var(--rc-border)" }}
            >
              <Ban className="h-3 w-3" />
            </button>
            {colorKeys.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setActiveFill(c);
                  onRecolorFill?.(c);
                }}
                className="h-5 w-5 rounded-full border-2 transition-transform hover:scale-110"
                style={{ background: HIGHLIGHT_COLORS[c].bg, borderColor: activeFill === c ? HIGHLIGHT_COLORS[c].border : "transparent" }}
                title={`填充${HIGHLIGHT_COLORS[c].label}`}
              />
            ))}
          </div>
        ) : null}

        <div className="flex items-center gap-0.5">
          {(isEdit ? editActions : createActions).map((action) => {
            const Icon = action.icon;
            const danger = "danger" in action && action.danger;
            const active = "active" in action && action.active;
            return (
              <button
                key={action.key}
                type="button"
                onClick={action.onClick}
                title={action.label}
                className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] font-medium transition-colors ${
                  danger ? "hover:bg-apple-red/10" : "hover:bg-apple-blue/10"
                }`}
                style={
                  danger
                    ? { color: "var(--rc-danger, #dc2626)" }
                    : active
                      ? { background: "rgba(0,122,255,0.12)", color: "var(--rc-accent)" }
                      : { color: "var(--rc-text-secondary)" }
                }
              >
                <Icon className="h-4 w-4" />
                {action.label}
              </button>
            );
          })}
        </div>

        {!isEdit && (panel === "note" || panel === "corpus") ? (
          <div className="mt-2 space-y-2 border-t pt-2" style={{ borderColor: "var(--rc-border)" }}>
            <textarea
              value={noteText}
              onChange={(event) => setNoteText(event.target.value)}
              placeholder={panel === "note" ? "写下你的批注想法…（可留空）" : "给这条语料加点备注…（可留空）"}
              rows={2}
              autoFocus
              className="rc-selectable w-full resize-none rounded-lg border px-2.5 py-1.5 text-xs leading-5 text-ink-primary outline-none"
              style={{ borderColor: "var(--rc-border)", background: "var(--rc-card-inset-bg)" }}
            />
            <button
              type="button"
              onClick={() => {
                if (panel === "note") {
                  onAnnotate?.(activeColor, "highlight", noteText.trim());
                } else {
                  onSaveCorpus?.(noteText.trim() || undefined);
                }
              }}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold text-white"
              style={{ background: "var(--rc-accent)" }}
            >
              {panel === "note" ? <StickyNote className="h-3.5 w-3.5" /> : <BookMarked className="h-3.5 w-3.5" />}
              {panel === "note" ? "保存为高亮批注" : "收入语料库"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
