import { useState } from "react";
import { Copy, Highlighter, Languages, Underline, X } from "lucide-react";
import { translateApi } from "../../lib/client";
import {
  HIGHLIGHT_COLORS,
  type AnnotationStyle,
  type HighlightColor,
} from "./readerTypes";

interface SelectionPopupProps {
  x: number;
  y: number;
  selectedText: string;
  onAnnotate: (color: HighlightColor, style: AnnotationStyle) => void;
  onClose: () => void;
}

const colorKeys = Object.keys(HIGHLIGHT_COLORS) as HighlightColor[];

export default function SelectionPopup({ x, y, selectedText, onAnnotate, onClose }: SelectionPopupProps) {
  const [activeColor, setActiveColor] = useState<HighlightColor>("yellow");
  const [translation, setTranslation] = useState("");
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState("");

  const runTranslate = async () => {
    if (translating) return;
    setTranslating(true);
    setTranslateError("");
    try {
      const result = await translateApi.translate(selectedText, "zh");
      setTranslation(result.trim());
    } catch (err) {
      setTranslateError(err instanceof Error ? err.message : "翻译失败");
    } finally {
      setTranslating(false);
    }
  };

  return (
    <div
      className="pdf-selection-popup fixed z-[80]"
      style={{
        left: Math.max(8, Math.min(x, window.innerWidth - 320)),
        top: Math.max(8, y - 12),
        transform: "translateY(-100%)",
      }}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div
        className="min-w-[260px] max-w-[320px] rounded-xl border p-2 shadow-2xl"
        style={{ background: "var(--rc-card-bg)", borderColor: "var(--rc-border)", boxShadow: "0 12px 36px rgba(15,23,42,0.22)" }}
      >
        <div className="flex items-center justify-between px-1 pb-1.5">
          <span className="text-xs font-semibold text-ink-tertiary">批注 / 翻译</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-0.5 text-ink-tertiary transition-colors hover:bg-white/5 hover:text-ink-secondary"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div
          className="mb-2 line-clamp-2 rounded-md px-2 py-1.5 text-xs text-ink-secondary"
          style={{ background: "var(--rc-card-inset-bg)" }}
        >
          “{selectedText.length > 100 ? `${selectedText.slice(0, 100)}…` : selectedText}”
        </div>

        <div className="mb-2 flex items-center gap-1.5 px-1">
          {colorKeys.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setActiveColor(c)}
              className="h-6 w-6 rounded-full border-2 transition-transform hover:scale-110"
              style={{ background: HIGHLIGHT_COLORS[c].bg, borderColor: activeColor === c ? HIGHLIGHT_COLORS[c].border : "transparent" }}
              title={HIGHLIGHT_COLORS[c].label}
            />
          ))}
        </div>

        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => onAnnotate(activeColor, "highlight")}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-apple-blue transition-colors hover:bg-apple-blue/10"
            style={{ background: "rgba(0,122,255,0.08)" }}
          >
            <Highlighter className="h-3.5 w-3.5" />
            高亮
          </button>
          <button
            type="button"
            onClick={() => onAnnotate(activeColor, "underline")}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-apple-blue transition-colors hover:bg-apple-blue/10"
            style={{ background: "rgba(0,122,255,0.08)" }}
          >
            <Underline className="h-3.5 w-3.5" />
            下划线
          </button>
          <button
            type="button"
            onClick={() => void runTranslate()}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-apple-blue transition-colors hover:bg-apple-blue/10 disabled:opacity-50"
            style={{ background: "rgba(0,122,255,0.08)" }}
            disabled={translating}
          >
            <Languages className="h-3.5 w-3.5" />
            翻译
          </button>
        </div>

        {translating || translation || translateError ? (
          <div
            className="mt-2 rounded-lg border px-2.5 py-2"
            style={{ borderColor: "var(--rc-border)", background: "var(--rc-card-inset-bg)" }}
          >
            {translating ? (
              <p className="text-xs text-ink-tertiary">小妍翻译中…</p>
            ) : translateError ? (
              <p className="text-xs text-apple-red">{translateError}</p>
            ) : (
              <>
                <p className="max-h-40 overflow-y-auto whitespace-pre-wrap text-xs leading-5 text-ink-primary">{translation}</p>
                <button
                  type="button"
                  onClick={() => void navigator.clipboard.writeText(translation)}
                  className="mt-1.5 flex items-center gap-1 text-[11px] text-ink-tertiary transition-colors hover:text-apple-blue"
                >
                  <Copy className="h-3 w-3" />
                  复制译文
                </button>
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
