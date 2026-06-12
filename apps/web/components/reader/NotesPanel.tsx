"use client";

import { useState, useEffect, useRef } from "react";
import {
  StickyNote,
  Search,
  ArrowUpDown,
  Trash2,
  ChevronDown,
  ChevronUp,
  Edit3,
  Check,
  X,
  FileText,
} from "lucide-react";
import type { PaperNote, HighlightColor } from "@/lib/reader-types";
import { HIGHLIGHT_COLORS } from "@/lib/reader-types";
import type { SortMode } from "./useNotes";

interface NotesPanelProps {
  notes: PaperNote[];
  totalCount: number;
  sortMode: SortMode;
  onSortModeChange: (mode: SortMode) => void;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  onUpdateNote: (id: string, data: { content?: string; highlight_color?: HighlightColor }) => void;
  onDeleteNote: (id: string) => void;
  onNavigateToPage: (page: number) => void;
  onAddBlankNote: () => void;
}

/* ── Single note card ─────────────────────────────────────── */

function NoteCard({
  note,
  onUpdate,
  onDelete,
  onNavigate,
}: {
  note: PaperNote;
  onUpdate: (id: string, data: { content?: string; highlight_color?: HighlightColor }) => void;
  onDelete: (id: string) => void;
  onNavigate: (page: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(note.content);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    };
  }, []);

  const colorMeta = HIGHLIGHT_COLORS[note.highlight_color];

  const handleSave = () => {
    if (editText.trim() && editText !== note.content) {
      onUpdate(note.id, { content: editText.trim() });
    }
    setEditing(false);
  };

  const handleDelete = () => {
    if (confirmDelete) {
      onDelete(note.id);
    } else {
      setConfirmDelete(true);
      deleteTimerRef.current = setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  return (
    <div
      className="rounded-xl border overflow-hidden transition-colors"
      style={{
        background: "var(--rc-card-bg)",
        borderColor: "var(--rc-card-outline)",
      }}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 px-3 py-2">
        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ background: colorMeta.border }}
        />
        <button
          onClick={() => onNavigate(note.page)}
          className="text-[11px] font-medium px-1.5 py-0.5 rounded-md transition-colors"
          style={{
            background: "var(--rc-chip-bg)",
            color: "var(--rc-accent)",
          }}
        >
          P{note.page}
        </button>
        <span className="flex-1" />
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-0.5 rounded-md hover:bg-black/5 transition-colors"
          title={expanded ? "收起" : "展开"}
        >
          {expanded ? (
            <ChevronUp className="w-3.5 h-3.5" style={{ color: "var(--rc-text-muted)" }} />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" style={{ color: "var(--rc-text-muted)" }} />
          )}
        </button>
      </div>

      {/* Highlighted text */}
      {note.highlight_text && (
        <div
          className="mx-3 mb-2 px-2.5 py-1.5 rounded-lg text-xs leading-relaxed border-l-2"
          style={{
            background: colorMeta.bg,
            borderLeftColor: colorMeta.border,
            color: "var(--rc-text-soft)",
          }}
        >
          {expanded
            ? note.highlight_text
            : note.highlight_text.length > 60
              ? note.highlight_text.slice(0, 60) + "..."
              : note.highlight_text}
        </div>
      )}

      {/* Note content */}
      <div className="px-3 pb-2">
        {editing ? (
          <div className="space-y-2">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="w-full px-2.5 py-2 rounded-lg text-xs resize-none border focus:outline-none"
              style={{
                background: "var(--rc-surface)",
                borderColor: "var(--rc-border)",
                color: "var(--rc-text)",
              }}
              rows={4}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSave();
                if (e.key === "Escape") {
                  setEditText(note.content);
                  setEditing(false);
                }
              }}
            />
            <div className="flex gap-1.5">
              <button
                onClick={() => {
                  setEditText(note.content);
                  setEditing(false);
                }}
                className="p-1 rounded-md transition-colors"
                style={{ color: "var(--rc-text-muted)" }}
              >
                <X className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleSave}
                className="p-1 rounded-md transition-colors"
                style={{ color: "var(--rc-accent)" }}
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <p
            className="text-xs leading-relaxed cursor-pointer"
            style={{ color: "var(--rc-text-soft)" }}
            onClick={() => setExpanded(!expanded)}
          >
            {note.content || (
              <span style={{ color: "var(--rc-text-muted)" }}>（无笔记内容）</span>
            )}
          </p>
        )}
      </div>

      {/* Footer actions */}
      {(expanded || editing) && (
        <div
          className="flex items-center justify-between px-3 py-1.5 border-t"
          style={{ borderColor: "var(--rc-card-outline)" }}
        >
          <span className="text-[10px]" style={{ color: "var(--rc-text-muted)" }}>
            {new Date(note.updated_at).toLocaleString("zh-CN", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          <div className="flex gap-1">
            {!editing && (
              <button
                onClick={() => {
                  setEditText(note.content);
                  setEditing(true);
                }}
                className="p-1 rounded-md hover:bg-black/5 transition-colors"
                title="编辑"
              >
                <Edit3 className="w-3.5 h-3.5" style={{ color: "var(--rc-text-muted)" }} />
              </button>
            )}
            <button
              onClick={handleDelete}
              className="p-1 rounded-md transition-colors"
              title={confirmDelete ? "再次点击确认删除" : "删除"}
              style={{
                color: confirmDelete ? "#ef4444" : "var(--rc-text-muted)",
              }}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Notes Panel ──────────────────────────────────────────── */

export default function NotesPanel({
  notes,
  totalCount,
  sortMode,
  onSortModeChange,
  searchQuery,
  onSearchQueryChange,
  onUpdateNote,
  onDeleteNote,
  onNavigateToPage,
  onAddBlankNote,
}: NotesPanelProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div
        className="flex items-center gap-2 px-4 py-3 border-b flex-shrink-0"
        style={{ borderColor: "var(--rc-border)" }}
      >
        <StickyNote className="w-4 h-4" style={{ color: "var(--rc-accent)" }} />
        <span className="text-sm font-semibold" style={{ color: "var(--rc-text)" }}>
          笔记
        </span>
        <span
          className="text-[11px] px-1.5 py-0.5 rounded-full"
          style={{
            background: "var(--rc-chip-bg)",
            color: "var(--rc-text-muted)",
          }}
        >
          {totalCount}
        </span>
        <span className="flex-1" />
        <button
          onClick={onAddBlankNote}
          className="text-xs font-medium px-2.5 py-1 rounded-lg transition-colors"
          style={{
            background: "color-mix(in srgb, var(--rc-accent) 10%, transparent)",
            color: "var(--rc-accent)",
          }}
        >
          + 新笔记
        </button>
      </div>

      {/* Search + sort */}
      <div
        className="flex items-center gap-2 px-4 py-2 border-b flex-shrink-0"
        style={{ borderColor: "var(--rc-border)" }}
      >
        <div
          className="flex-1 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border"
          style={{
            background: "var(--rc-surface)",
            borderColor: "var(--rc-control-border)",
          }}
        >
          <Search className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--rc-text-muted)" }} />
          <input
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="搜索笔记..."
            className="flex-1 bg-transparent text-xs outline-none"
            style={{ color: "var(--rc-text)" }}
          />
        </div>
        <button
          onClick={() => onSortModeChange(sortMode === "page" ? "created" : "page")}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors"
          style={{
            background: "var(--rc-chip-bg)",
            color: "var(--rc-text-soft)",
          }}
          title="切换排序方式"
        >
          <ArrowUpDown className="w-3 h-3" />
          {sortMode === "page" ? "按页码" : "按时间"}
        </button>
      </div>

      {/* Notes list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
        {notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
              style={{ background: "var(--rc-chip-bg)" }}
            >
              <FileText className="w-5 h-5" style={{ color: "var(--rc-text-muted)" }} />
            </div>
            <p className="text-sm font-medium mb-1" style={{ color: "var(--rc-text-soft)" }}>
              {totalCount === 0 ? "还没有笔记" : "没有匹配的笔记"}
            </p>
            <p className="text-xs" style={{ color: "var(--rc-text-muted)" }}>
              {totalCount === 0
                ? "在 PDF 中选中文本即可添加高亮和笔记"
                : "试试其他关键词"}
            </p>
          </div>
        ) : (
          notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onUpdate={onUpdateNote}
              onDelete={onDeleteNote}
              onNavigate={onNavigateToPage}
            />
          ))
        )}
      </div>
    </div>
  );
}
