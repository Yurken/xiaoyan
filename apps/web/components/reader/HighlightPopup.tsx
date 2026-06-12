"use client";

import { useState } from "react";
import { Highlighter, StickyNote, X } from "lucide-react";
import type { HighlightColor } from "@/lib/reader-types";
import { HIGHLIGHT_COLORS } from "@/lib/reader-types";

interface HighlightPopupProps {
  /** Position in viewport-relative coordinates */
  x: number;
  y: number;
  selectedText: string;
  onHighlight: (color: HighlightColor) => void;
  onAddNote: (color: HighlightColor, content: string) => void;
  onClose: () => void;
}

const colorKeys = Object.keys(HIGHLIGHT_COLORS) as HighlightColor[];

export default function HighlightPopup({
  x,
  y,
  selectedText,
  onHighlight,
  onAddNote,
  onClose,
}: HighlightPopupProps) {
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [activeColor, setActiveColor] = useState<HighlightColor>("yellow");

  const handleSaveNote = () => {
    if (!noteText.trim()) return;
    onAddNote(activeColor, noteText.trim());
    setNoteText("");
    setShowNoteInput(false);
  };

  return (
    <div
      className="fixed z-50"
      style={{
        left: Math.min(x, window.innerWidth - 320),
        top: Math.max(y - 12, 8),
        transform: "translateY(-100%)",
      }}
    >
      <div
        className="rounded-xl border p-2 min-w-[240px] max-w-[300px]"
        style={{
          background: "var(--rc-elevated)",
          borderColor: "var(--rc-border)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-1 pb-1.5">
          <span className="text-xs font-medium" style={{ color: "var(--rc-text-muted)" }}>
            {showNoteInput ? "添加笔记" : "选择操作"}
          </span>
          <button
            onClick={onClose}
            className="p-0.5 rounded-md hover:bg-black/5 transition-colors"
          >
            <X className="w-3.5 h-3.5" style={{ color: "var(--rc-text-muted)" }} />
          </button>
        </div>

        {/* Selected text preview */}
        <div
          className="text-xs px-2 py-1.5 rounded-md mb-2 line-clamp-2"
          style={{
            background: "var(--rc-chip-inset-bg)",
            color: "var(--rc-text-soft)",
          }}
        >
          &ldquo;{selectedText.length > 100 ? selectedText.slice(0, 100) + "..." : selectedText}&rdquo;
        </div>

        {/* Color picker */}
        <div className="flex items-center gap-1.5 px-1 mb-2">
          {colorKeys.map((c) => (
            <button
              key={c}
              onClick={() => {
                setActiveColor(c);
                if (!showNoteInput) onHighlight(c);
              }}
              className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
              style={{
                background: HIGHLIGHT_COLORS[c].bg,
                borderColor:
                  activeColor === c
                    ? HIGHLIGHT_COLORS[c].border
                    : "transparent",
              }}
              title={HIGHLIGHT_COLORS[c].label}
            />
          ))}
        </div>

        {/* Action buttons */}
        {!showNoteInput ? (
          <div className="flex gap-1.5">
            <button
              onClick={() => onHighlight(activeColor)}
              className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{
                background: "color-mix(in srgb, var(--rc-accent) 10%, transparent)",
                color: "var(--rc-accent)",
              }}
            >
              <Highlighter className="w-3.5 h-3.5" />
              高亮
            </button>
            <button
              onClick={() => setShowNoteInput(true)}
              className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{
                background: "color-mix(in srgb, var(--rc-accent) 10%, transparent)",
                color: "var(--rc-accent)",
              }}
            >
              <StickyNote className="w-3.5 h-3.5" />
              添加笔记
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="写下你的笔记..."
              className="w-full px-3 py-2 rounded-lg text-xs resize-none border focus:outline-none"
              style={{
                background: "var(--rc-surface)",
                borderColor: "var(--rc-border)",
                color: "var(--rc-text)",
              }}
              rows={3}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  handleSaveNote();
                }
              }}
            />
            <div className="flex gap-1.5">
              <button
                onClick={() => setShowNoteInput(false)}
                className="flex-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{
                  background: "var(--rc-chip-bg)",
                  color: "var(--rc-text-soft)",
                }}
              >
                取消
              </button>
              <button
                onClick={handleSaveNote}
                disabled={!noteText.trim()}
                className="flex-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white transition-colors disabled:opacity-40"
                style={{
                  background: "var(--rc-accent)",
                }}
              >
                保存笔记
              </button>
            </div>
            <p className="text-[10px] text-center" style={{ color: "var(--rc-text-muted)" }}>
              ⌘ + Enter 快速保存
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
