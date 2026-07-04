import {
  ArrowLeft,
  Ban,
  Circle,
  ExternalLink,
  Highlighter,
  Image as ImageIcon,
  Minus,
  PanelLeft,
  Plus,
  Square,
  Squircle,
  Strikethrough,
  Underline,
} from "lucide-react";
import {
  HIGHLIGHT_COLORS,
  isShapeStyle,
  SHAPE_LABELS,
  type AnnotationStyle,
  type HighlightColor,
  type ReaderMode,
  type ShapeStyle,
} from "./readerTypes";

interface ReaderToolbarProps {
  leftOpen: boolean;
  onToggleLeft: () => void;
  onBack: () => void;
  scalePercent: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  areaSelectEnabled: boolean;
  onToggleAreaSelect: () => void;
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

const tools: Array<{ key: AnnotationStyle; icon: typeof Highlighter; label: string }> = [
  { key: "highlight", icon: Highlighter, label: "高亮" },
  { key: "underline", icon: Underline, label: "下划线" },
  { key: "strike", icon: Strikethrough, label: "删除线" },
];

const shapes: Array<{ key: ShapeStyle; icon: typeof Square }> = [
  { key: "rect", icon: Square },
  { key: "rounded", icon: Squircle },
  { key: "ellipse", icon: Circle },
];

const modes: Array<{ key: ReaderMode; label: string }> = [
  { key: "view", label: "阅读" },
  { key: "annotate", label: "批注" },
];

export default function ReaderToolbar({
  leftOpen,
  onToggleLeft,
  onBack,
  scalePercent,
  onZoomIn,
  onZoomOut,
  areaSelectEnabled,
  onToggleAreaSelect,
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
  const innerBtn =
    "flex h-6 w-6 items-center justify-center rounded-lg text-ink-tertiary transition-colors hover:text-ink-primary";

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
        title={leftOpen ? "隐藏论文库" : "显示论文库"}
      >
        <PanelLeft className="h-4 w-4" />
      </button>

      <div className="h-5 w-px" style={{ background: "var(--rc-border)" }} />

      {/* 缩放 */}
      <div className="flex items-center gap-1 rounded-2xl px-1.5 py-1" style={well}>
        <button type="button" onClick={onZoomOut} className={innerBtn} title="缩小">
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="w-11 text-center text-xs tabular-nums text-ink-secondary">{scalePercent}%</span>
        <button type="button" onClick={onZoomIn} className={innerBtn} title="放大">
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="h-5 w-px" style={{ background: "var(--rc-border)" }} />

      <button
        type="button"
        onClick={onToggleAreaSelect}
        className={iconBtn}
        style={areaSelectEnabled ? { color: "var(--rc-accent)" } : undefined}
        title={areaSelectEnabled ? "退出框选图像解读" : "框选图像让小妍解读"}
      >
        <ImageIcon className="h-4 w-4" />
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

      {/* 批注模式：工具 + 形状 + 颜色 */}
      {mode === "annotate" ? (
        <div className="flex items-center gap-2 rounded-2xl px-2 py-1.5" style={well}>
          <div className="flex items-center gap-1">
            {tools.map((t) => {
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
            {isShapeStyle(tool) ? <span className="mr-0.5 text-[11px] text-ink-tertiary">边框</span> : null}
            {colorKeys.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onColorChange(c)}
                title={isShapeStyle(tool) ? `边框${HIGHLIGHT_COLORS[c].label}` : HIGHLIGHT_COLORS[c].label}
                className="h-5 w-5 rounded-full border-2 transition-transform hover:scale-110"
                style={{ background: HIGHLIGHT_COLORS[c].bg, borderColor: color === c ? HIGHLIGHT_COLORS[c].border : "transparent" }}
              />
            ))}
          </div>

          {isShapeStyle(tool) ? (
            <>
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
            </>
          ) : null}
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
