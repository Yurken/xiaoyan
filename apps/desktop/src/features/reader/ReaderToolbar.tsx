import {
  ArrowLeft,
  Ban,
  Circle,
  ExternalLink,
  Highlighter,
  PanelLeft,
  Square,
  Squircle,
  Strikethrough,
  Type,
  Underline,
} from "lucide-react";
import {
  HIGHLIGHT_COLORS,
  SHAPE_LABELS,
  type AnnotationStyle,
  type HighlightColor,
  type ReaderMode,
  type ShapeStyle,
  type TextAnnotationStyle,
} from "./readerTypes";

interface ReaderToolbarProps {
  leftOpen: boolean;
  onToggleLeft: () => void;
  onBack: () => void;
  mode: ReaderMode;
  onModeChange: (mode: ReaderMode) => void;
  tool: AnnotationStyle;
  onToolChange: (tool: AnnotationStyle) => void;
  color: HighlightColor;
  onColorChange: (color: HighlightColor) => void;
  fill: HighlightColor | null;
  onFillChange: (fill: HighlightColor | null) => void;
  onOpenExternal?: () => void;
}

const colorKeys = Object.keys(HIGHLIGHT_COLORS) as HighlightColor[];

const textTools: Array<{ key: TextAnnotationStyle; icon: typeof Highlighter; label: string }> = [
  { key: "highlight", icon: Highlighter, label: "高亮" },
  { key: "underline", icon: Underline, label: "下划线" },
  { key: "strike", icon: Strikethrough, label: "删除线" },
  { key: "text", icon: Type, label: "添加文字" },
];

const shapes: Array<{ key: ShapeStyle; icon: typeof Square }> = [
  { key: "rect", icon: Square },
  { key: "rounded", icon: Squircle },
  { key: "ellipse", icon: Circle },
];

const modes: Array<{ key: ReaderMode; label: string }> = [
  { key: "view", label: "阅读" },
  { key: "text-annotation", label: "文本" },
  { key: "shape-annotation", label: "形状" },
];

export default function ReaderToolbar({
  leftOpen,
  onToggleLeft,
  onBack,
  mode,
  onModeChange,
  tool,
  onToolChange,
  color,
  onColorChange,
  fill,
  onFillChange,
  onOpenExternal,
}: ReaderToolbarProps) {
  const iconBtn = "rc-icon-button h-8 w-8";
  // 拟态「凹槽」：分组控件放在内凹槽里，选中项再做凸起，符合整体新拟态语言。
  const well = {
    background: "var(--rc-chip-inset-bg)",
    boxShadow: "var(--rc-chip-inset-shadow)",
  };

  return (
    <header
      className="rc-reader-header flex min-h-[48px] shrink-0 flex-wrap items-center gap-2 border-b px-3 py-1.5"
      style={{ borderColor: "var(--rc-border)", background: "var(--rc-header-bg)" }}
    >
      <button type="button" onClick={onBack} className={iconBtn} title="返回">
        <ArrowLeft className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onToggleLeft}
        className={iconBtn}
        style={leftOpen ? { color: "var(--rc-accent)" } : undefined}
        title={leftOpen ? "隐藏侧栏" : "显示侧栏"}
      >
        <PanelLeft className="h-4 w-4" />
      </button>

      <div className="h-5 w-px" style={{ background: "var(--rc-border)" }} />

      {/* 模式切换 */}
      <div className="flex items-center gap-1 rounded-2xl p-1" style={well}>
        {modes.map((m) => {
          const active = mode === m.key;
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => onModeChange(m.key)}
              className="rounded-xl px-3 py-1 text-xs font-semibold transition-all"
              style={
                active
                  ? { background: "var(--rc-accent)", color: "#fff", boxShadow: "var(--rc-chip-shadow)" }
                  : { color: "var(--rc-text-secondary)" }
              }
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {mode === "text-annotation" ? (
        <div className="flex items-center gap-2 rounded-2xl px-2 py-1.5" style={well}>
          <div className="flex items-center gap-1">
            {textTools.map((t) => {
              const Icon = t.icon;
              const active = tool === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => onToolChange(t.key)}
                  title={t.label}
                  className="flex h-7 w-7 items-center justify-center rounded-xl transition-all"
                  style={
                    active
                      ? { background: "var(--rc-chip-bg)", color: "var(--rc-accent)", boxShadow: "var(--rc-chip-shadow)" }
                      : { color: "var(--rc-text-secondary)" }
                  }
                >
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}
          </div>
          <div className="h-4 w-px" style={{ background: "var(--rc-border)" }} />
          <ColorPicker color={color} onColorChange={onColorChange} />
        </div>
      ) : null}

      {mode === "shape-annotation" ? (
        <div className="flex items-center gap-2 rounded-2xl px-2 py-1.5" style={well}>
          <div className="flex items-center gap-1">
            {shapes.map((s) => {
              const Icon = s.icon;
              const active = tool === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => onToolChange(s.key)}
                  title={`${SHAPE_LABELS[s.key]}框选`}
                  className="flex h-7 w-7 items-center justify-center rounded-xl transition-all"
                  style={
                    active
                      ? { background: "var(--rc-chip-bg)", color: "var(--rc-accent)", boxShadow: "var(--rc-chip-shadow)" }
                      : { color: "var(--rc-text-secondary)" }
                  }
                >
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}
          </div>
          <div className="h-4 w-px" style={{ background: "var(--rc-border)" }} />
          <div className="flex items-center gap-1">
            <span className="mr-0.5 text-[11px] text-ink-tertiary">边框</span>
            {colorKeys.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onColorChange(c)}
                title={`边框${HIGHLIGHT_COLORS[c].label}`}
                className="h-5 w-5 rounded-full border-2 transition-transform hover:scale-110"
                style={{ background: HIGHLIGHT_COLORS[c].bg, borderColor: color === c ? HIGHLIGHT_COLORS[c].border : "transparent" }}
              />
            ))}
          </div>

          <div className="h-4 w-px" style={{ background: "var(--rc-border)" }} />
          <div className="flex items-center gap-1">
            <span className="mr-0.5 text-[11px] text-ink-tertiary">填充</span>
            <button
              type="button"
              onClick={() => onFillChange(null)}
              title="无填充"
              className="flex h-5 w-5 items-center justify-center rounded-full border-2 transition-transform hover:scale-110"
              style={{ borderColor: fill == null ? "var(--rc-accent)" : "var(--rc-border)", color: "var(--rc-text-tertiary)" }}
            >
              <Ban className="h-3 w-3" />
            </button>
            {colorKeys.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onFillChange(c)}
                title={`填充${HIGHLIGHT_COLORS[c].label}`}
                className="h-5 w-5 rounded-full border-2 transition-transform hover:scale-110"
                style={{ background: HIGHLIGHT_COLORS[c].bg, borderColor: fill === c ? HIGHLIGHT_COLORS[c].border : "transparent" }}
              />
            ))}
          </div>
        </div>
      ) : null}

      {onOpenExternal ? (
        <button type="button" onClick={onOpenExternal} className={`${iconBtn} ml-auto`} title="用系统阅读器打开">
          <ExternalLink className="h-4 w-4" />
        </button>
      ) : null}
    </header>
  );
}

function ColorPicker({ color, onColorChange }: { color: HighlightColor; onColorChange: (color: HighlightColor) => void }) {
  return (
    <div className="flex items-center gap-1">
      {colorKeys.map((candidate) => (
        <button
          key={candidate}
          type="button"
          onClick={() => onColorChange(candidate)}
          title={HIGHLIGHT_COLORS[candidate].label}
          className="h-5 w-5 rounded-full border-2 transition-transform hover:scale-110"
          style={{
            background: HIGHLIGHT_COLORS[candidate].bg,
            borderColor: color === candidate ? HIGHLIGHT_COLORS[candidate].border : "transparent",
          }}
        />
      ))}
    </div>
  );
}
