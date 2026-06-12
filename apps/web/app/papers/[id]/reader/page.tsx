"use client";

import { useState, useEffect, useRef, useCallback, use } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  ArrowLeft,
  PanelRightOpen,
  PanelRightClose,
  Download,
  BookOpen,
} from "lucide-react";
import { papersApi } from "@/lib/client";
import type { Paper } from "@research-copilot/types";
import type { HighlightColor } from "@/lib/reader-types";

import PdfViewer from "@/components/reader/PdfViewer";
import type { PdfViewerHandle } from "@/components/reader/PdfViewer";
import NotesPanel from "@/components/reader/NotesPanel";
import HighlightPopup from "@/components/reader/HighlightPopup";
import { useNotes } from "@/components/reader/useNotes";

// ── Selection state ────────────────────────────────────────

interface SelectionState {
  text: string;
  page: number;
  positions: Array<{ x: number; y: number; w: number; h: number }>;
  popupX: number;
  popupY: number;
}

// ── Page component ─────────────────────────────────────────

export default function ReaderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [paper, setPaper] = useState<Paper | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfUrl, setPdfUrl] = useState<string>("");
  const [mounted, setMounted] = useState(false);

  // Viewer state
  const pdfViewerRef = useRef<PdfViewerHandle>(null);
  const [showNotes, setShowNotes] = useState(true);
  const [selection, setSelection] = useState<SelectionState | null>(null);

  // Notes hook
  const {
    notes,
    allNotes,
    totalCount,
    addNote,
    updateNote,
    deleteNote,
    sortMode,
    setSortMode,
    searchQuery,
    setSearchQuery,
  } = useNotes({ paperId: id });

  // Mount flag for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch paper metadata
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = (await papersApi.get(id)) as Paper;
        if (!cancelled) setPaper(data);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Construct PDF URL
  useEffect(() => {
    if (!paper) return;
    // Serve via backend API proxy
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
    setPdfUrl(`${apiUrl}/api/papers/${id}/file`);
  }, [paper, id]);

  // ── Callbacks ────────────────────────────────────────────

  const handleTextSelected = useCallback((data: {
    text: string;
    page: number;
    positions: Array<{ x: number; y: number; w: number; h: number }>;
    popupX: number;
    popupY: number;
  }) => {
    setSelection(data);
  }, []);

  const handleSelectionCleared = useCallback(() => {
    setSelection(null);
  }, []);

  const handleHighlight = useCallback(
    (color: HighlightColor) => {
      if (!selection) return;
      addNote({
        page: selection.page,
        content: "",
        highlight_text: selection.text,
        highlight_color: color,
        highlight_positions: selection.positions,
      });
      setSelection(null);
      window.getSelection()?.removeAllRanges();
    },
    [selection, addNote],
  );

  const handleAddNote = useCallback(
    (color: HighlightColor, content: string) => {
      if (!selection) return;
      addNote({
        page: selection.page,
        content,
        highlight_text: selection.text,
        highlight_color: color,
        highlight_positions: selection.positions,
      });
      setSelection(null);
      window.getSelection()?.removeAllRanges();
    },
    [selection, addNote],
  );

  const handleNavigateToPage = useCallback((page: number) => {
    pdfViewerRef.current?.scrollToPage(page);
  }, []);

  const handleAddBlankNote = useCallback(() => {
    // Add a blank note for page 1 (or current visible page)
    addNote({
      page: 1,
      content: "",
      highlight_color: "yellow",
    });
  }, [addNote]);

  const handleDownloadNotes = useCallback(() => {
    const data = JSON.stringify(allNotes, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${paper?.title ?? "paper"}_notes.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [allNotes, paper]);

  // ── Loading / error states ───────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div
            className="w-10 h-10 rounded-full mx-auto mb-3 animate-pulse"
            style={{ background: "var(--rc-chip-bg)" }}
          />
          <p className="text-sm" style={{ color: "var(--rc-text-muted)" }}>
            正在加载论文...
          </p>
        </div>
      </div>
    );
  }

  if (!paper) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-sm font-medium mb-1" style={{ color: "var(--rc-text)" }}>
            论文不存在
          </p>
          <Link
            href="/papers"
            className="text-xs"
            style={{ color: "var(--rc-accent)" }}
          >
            返回论文库
          </Link>
        </div>
      </div>
    );
  }

  // ── Reader content ───────────────────────────────────────

  const readerContent = (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "var(--rc-bg)" }}
    >
      {/* Toolbar */}
      <header
        className="flex items-center gap-3 px-4 py-2.5 border-b flex-shrink-0"
        style={{
          background: "var(--rc-header-bg)",
          borderColor: "var(--rc-border)",
          backdropFilter: "blur(12px)",
        }}
      >
        <Link
          href={`/papers/${id}`}
          className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors"
          style={{
            color: "var(--rc-text-soft)",
          }}
          title="返回论文详情"
        >
          <ArrowLeft className="w-4 h-4" />
          返回
        </Link>

        <div className="h-4 w-px" style={{ background: "var(--rc-border)" }} />

        <div className="flex items-center gap-2 min-w-0 flex-1">
          <BookOpen className="w-4 h-4 flex-shrink-0" style={{ color: "var(--rc-accent)" }} />
          <h1
            className="text-sm font-semibold truncate"
            style={{ color: "var(--rc-text)" }}
          >
            {paper.title}
          </h1>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={handleDownloadNotes}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{
              background: "var(--rc-chip-bg)",
              color: "var(--rc-text-soft)",
            }}
            title="导出笔记"
          >
            <Download className="w-3.5 h-3.5" />
            导出
          </button>

          <button
            onClick={() => setShowNotes(!showNotes)}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{
              background: showNotes
                ? "color-mix(in srgb, var(--rc-accent) 10%, transparent)"
                : "var(--rc-chip-bg)",
              color: showNotes ? "var(--rc-accent)" : "var(--rc-text-soft)",
            }}
            title={showNotes ? "隐藏笔记面板" : "显示笔记面板"}
          >
            {showNotes ? (
              <PanelRightClose className="w-3.5 h-3.5" />
            ) : (
              <PanelRightOpen className="w-3.5 h-3.5" />
            )}
            笔记
            {totalCount > 0 && (
              <span
                className="text-[10px] px-1 py-0 rounded-full"
                style={{
                  background: "color-mix(in srgb, var(--rc-accent) 20%, transparent)",
                  color: "var(--rc-accent)",
                }}
              >
                {totalCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* PDF Viewer */}
        <div
          className="flex-1 overflow-hidden"
          style={{ background: "var(--rc-surface)" }}
        >
          <PdfViewer
            ref={pdfViewerRef}
            url={pdfUrl}
            notes={allNotes}
            onTextSelected={handleTextSelected}
            onSelectionCleared={handleSelectionCleared}
          />
        </div>

        {/* Notes panel */}
        {showNotes && (
          <div
            className="w-80 flex-shrink-0 border-l overflow-hidden"
            style={{
              background: "var(--rc-sidebar-bg)",
              borderColor: "var(--rc-border)",
            }}
          >
            <NotesPanel
              notes={notes}
              totalCount={totalCount}
              sortMode={sortMode}
              onSortModeChange={setSortMode}
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              onUpdateNote={updateNote}
              onDeleteNote={deleteNote}
              onNavigateToPage={handleNavigateToPage}
              onAddBlankNote={handleAddBlankNote}
            />
          </div>
        )}
      </div>

      {/* Highlight popup */}
      {selection && (
        <HighlightPopup
          x={selection.popupX}
          y={selection.popupY}
          selectedText={selection.text}
          onHighlight={handleHighlight}
          onAddNote={handleAddNote}
          onClose={() => {
            setSelection(null);
            window.getSelection()?.removeAllRanges();
          }}
        />
      )}
    </div>
  );

  // Use portal to escape the root layout (sidebar)
  if (!mounted) return null;
  return createPortal(readerContent, document.body);
}
