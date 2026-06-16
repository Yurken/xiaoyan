import {
  ArrowLeft,
  ExternalLink,
  Highlighter,
  Languages,
  Minus,
  PanelLeft,
  Plus,
  Strikethrough,
  Underline,
} from "lucide-react";
import {
  HIGHLIGHT_COLORS,
  type AnnotationStyle,
  type HighlightColor,
  type ReaderMode,
} from "./readerTypes";

interface ReaderToolbarProps {
  leftOpen: boolean;
  onToggleLeft: () => void;
  onBack: () => void;
  scalePercent: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  mode: ReaderMode;
  onModeChange: (mode: ReaderMode) => void;
  tool: AnnotationStyle;
  onToolChange: (tool: AnnotationStyle) => void;
  color: HighlightColor;
  onColorChange: (color: HighlightColor) => void;
  alwaysTranslate: boolean;
  onToggleTranslate: () => void;
  onOpenExternal?: () => void;
}

const colorKeys = Object.keys(HIGHLIGHT_COLORS) as HighlightColor[];

const tools: Array<{ key: AnnotationStyle; icon: typeof Highlighter; label: string }> = [
  { key: "highlight", icon: Highlighter, label: "高亮" },
  { key: "underline", icon: Underline, label: "下划线" },
  { key: "strike", icon: Strikethrough, label: "删除线" },
];

const modes: Array<{ key: ReaderMode; label: string }> = [
  { key: "view", label: "视图" },
  { key: "annotate", label: "注释" },
];

export default function ReaderToolbar({
  leftOpen,
  onToggleLeft,
  onBack,
  scalePercent,
  onZoomIn,
  onZoomOut,
  mode,
  onModeChange,
  tool,
  onToolChange,
  color,
  onColorChange,
  alwaysTranslate,
  onToggleTranslate,
  onOpenExternal,
}: ReaderToolbarProps) {
  const iconBtn =
    "flex h-8 w-8 items-center justify-center rounded-lg text-ink-tertiary transition-colors hover:bg-white/5 hover:text-ink-secondary";

  return (
    <header
      className="rc-reader-header flex min-h-[48px] shrink-0 flex-wrap items-center gap-2 border-b px-3 py-1.5"
      style={{ borderColor: "var(--rc-border)", background: "var(--rc-header-bg)" }}
    >
      <button
        type="button"
        onClick={onToggleLeft}
        className={iconBtn}
        style={leftOpen ? { color: "var(--rc-accent)" } : undefined}
        title={leftOpen ? "隐藏论文库" : "显示论文库"}
      >
        <PanelLeft className="h-4 w-4" />
      </button>
      <button type="button" onClick={onBack} className={iconBtn} title="返回">
        <ArrowLeft className="h-4 w-4" />
      </button>

      <div className="h-5 w-px" style={{ background: "var(--rc-border)" }} />

      {/* 缩放 */}
      <div className="flex items-center gap-1 rounded-lg border px-1 py-0.5" style={{ borderColor: "var(--rc-border)" }}>
        <button type="button" onClick={onZoomOut} className="flex h-6 w-6 items-center justify-center rounded text-ink-tertiary transition-colors hover:bg-white/5 hover:text-ink-secondary" title="缩小">
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="w-11 text-center text-xs tabular-nums text-ink-secondary">{scalePercent}%</span>
        <button type="button" onClick={onZoomIn} className="flex h-6 w-6 items-center justify-center rounded text-ink-tertiary transition-colors hover:bg-white/5 hover:text-ink-secondary" title="放大">
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="h-5 w-px" style={{ background: "var(--rc-border)" }} />

      {/* 模式切换 */}
      <div className="flex items-center gap-0.5 rounded-lg border p-0.5" style={{ borderColor: "var(--rc-border)" }}>
        {modes.map((m) => {
          const active = mode === m.key;
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => onModeChange(m.key)}
              className="rounded-md px-3 py-1 text-xs font-semibold transition-colors"
              style={active ? { background: "var(--rc-accent)", color: "#fff" } : { color: "var(--rc-text-secondary)" }}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {/* 注释模式：工具 + 颜色 */}
      {mode === "annotate" ? (
        <div className="flex items-center gap-2 rounded-lg border px-2 py-1" style={{ borderColor: "var(--rc-border)", background: "var(--rc-card-inset-bg)" }}>
          <div className="flex items-center gap-0.5">
            {tools.map((t) => {
              const Icon = t.icon;
              const active = tool === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => onToolChange(t.key)}
                  title={t.label}
                  className="flex h-7 w-7 items-center justify-center rounded-md transition-colors"
                  style={active ? { background: "rgba(0,122,255,0.14)", color: "var(--rc-accent)" } : { color: "var(--rc-text-secondary)" }}
                >
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}
          </div>
          <div className="h-4 w-px" style={{ background: "var(--rc-border)" }} />
          <div className="flex items-center gap-1">
            {colorKeys.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onColorChange(c)}
                title={HIGHLIGHT_COLORS[c].label}
                className="h-5 w-5 rounded-full border-2 transition-transform hover:scale-110"
                style={{ background: HIGHLIGHT_COLORS[c].bg, borderColor: color === c ? HIGHLIGHT_COLORS[c].border : "transparent" }}
              />
            ))}
          </div>
        </div>
      ) : null}

      <div className="ml-auto flex items-center gap-2">
        {/* 一直翻译开关 */}
        <button
          type="button"
          onClick={onToggleTranslate}
          className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors"
          style={
            alwaysTranslate
              ? { background: "var(--rc-accent)", color: "#fff", borderColor: "transparent" }
              : { color: "var(--rc-text-secondary)", borderColor: "var(--rc-border)" }
          }
          title="开启后，划词即自动翻译到右侧面板"
        >
          <Languages className="h-3.5 w-3.5" />
          一直翻译
        </button>

        {onOpenExternal ? (
          <button type="button" onClick={onOpenExternal} className={iconBtn} title="用系统阅读器打开">
            <ExternalLink className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </header>
  );
}
