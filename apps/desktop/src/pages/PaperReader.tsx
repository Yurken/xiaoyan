import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { Button } from "@research-copilot/ui";
import { papersApi } from "../lib/client";
import PdfReaderViewer, { type PdfReaderViewerHandle } from "../features/reader/PdfReaderViewer";
import ReaderTranslationPanel from "../features/reader/ReaderTranslationPanel";
import ReaderPaperList from "../features/reader/ReaderPaperList";
import ReaderToolbar from "../features/reader/ReaderToolbar";
import SelectionPopup from "../features/reader/SelectionPopup";
import { useReaderNotes } from "../features/reader/useReaderNotes";
import { useReaderTranslation } from "../features/reader/useReaderTranslation";
import type {
  AnnotationStyle,
  HighlightColor,
  PaperNote,
  ReaderMode,
  ReaderSelection,
} from "../features/reader/readerTypes";
import { useCorpus } from "../features/papers/useCorpus";

const MIN_SCALE = 0.6;
const MAX_SCALE = 3;

export default function PaperReader() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const viewerRef = useRef<PdfReaderViewerHandle>(null);

  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [scale, setScale] = useState(1.4);
  const [selection, setSelection] = useState<ReaderSelection | null>(null);
  const [editing, setEditing] = useState<{ note: PaperNote; x: number; y: number } | null>(null);
  const [toast, setToast] = useState("");

  // 工具栏状态
  const [leftOpen, setLeftOpen] = useState(true);
  const [mode, setMode] = useState<ReaderMode>("view");
  const [annotateTool, setAnnotateTool] = useState<AnnotationStyle>("highlight");
  const [annotateColor, setAnnotateColor] = useState<HighlightColor>("yellow");
  const [alwaysTranslate, setAlwaysTranslate] = useState(false);

  const { notes, error: notesError, createAnnotation, updateColor, deleteAnnotation, undo } = useReaderNotes(id);
  const translation = useReaderTranslation();
  const corpus = useCorpus(id);

  const flashToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 1800);
  }, []);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    setPdfData(null);
    setSelection(null);
    setEditing(null);

    (async () => {
      try {
        const detail = await papersApi.get(id);
        if (cancelled) return;
        if (!detail.file_path) {
          setLoadError("该论文没有本地 PDF 文件，无法批注阅读。");
          return;
        }
        const { readFile } = await import("@tauri-apps/plugin-fs");
        const bytes = await readFile(detail.file_path);
        if (cancelled) return;
        setPdfData(bytes);
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "无法打开 PDF。");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const clearSelection = useCallback(() => {
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  // Cmd(mac)/Ctrl(win)+Z 撤销最近一次批注；在输入框内则交还给浏览器做文本撤销。
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "z" || !(event.metaKey || event.ctrlKey) || event.shiftKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable='true']")) return;
      event.preventDefault();
      void undo();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo]);

  // 划词处理：注释模式直接套用预选工具；一直翻译开启则自动翻译；否则视图模式弹工具菜单。
  const handleTextSelected = useCallback(
    (next: ReaderSelection) => {
      setEditing(null);

      if (alwaysTranslate) {
        void translation.translate(next.text, next.page);
      }

      if (mode === "annotate") {
        void createAnnotation({
          page: next.page,
          highlightText: next.text,
          color: annotateColor,
          style: annotateTool,
          positions: next.positions,
        });
        clearSelection();
        return;
      }

      if (alwaysTranslate) {
        clearSelection();
        return;
      }

      setSelection(next);
    },
    [alwaysTranslate, mode, annotateColor, annotateTool, translation, createAnnotation, clearSelection],
  );

  const handlePopupsCleared = useCallback(() => {
    setSelection(null);
    setEditing(null);
  }, []);

  const handleNoteClick = useCallback((note: PaperNote, point: { x: number; y: number }) => {
    setSelection(null);
    window.getSelection()?.removeAllRanges();
    setEditing({ note, x: point.x, y: point.y });
  }, []);

  const handleZoom = useCallback((factor: number) => {
    setScale((s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.round(s * factor * 100) / 100)));
  }, []);

  const zoomStep = useCallback((delta: number) => {
    setScale((s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.round((s + delta) * 10) / 10)));
  }, []);

  const handleAnnotate = useCallback(
    (color: HighlightColor, style: AnnotationStyle, note?: string) => {
      if (!selection) return;
      void createAnnotation({
        page: selection.page,
        highlightText: selection.text,
        color,
        style,
        positions: selection.positions,
        content: note,
      });
      clearSelection();
    },
    [selection, createAnnotation, clearSelection],
  );

  const handleSaveCorpus = useCallback(
    (note?: string) => {
      if (!selection || !id) return;
      void corpus.addEntry({ paperId: id, text: selection.text, page: selection.page, note });
      clearSelection();
      flashToast("已收入语料库");
    },
    [selection, id, corpus, clearSelection, flashToast],
  );

  const handleTranslate = useCallback(() => {
    if (!selection) return;
    void translation.translate(selection.text, selection.page);
    clearSelection();
  }, [selection, translation, clearSelection]);

  return (
    <div className="flex h-full flex-col overflow-hidden" style={{ background: "var(--rc-surface)" }}>
      <ReaderToolbar
        leftOpen={leftOpen}
        onToggleLeft={() => setLeftOpen((v) => !v)}
        onBack={() => navigate("/papers")}
        scalePercent={Math.round(scale * 100)}
        onZoomIn={() => zoomStep(0.1)}
        onZoomOut={() => zoomStep(-0.1)}
        mode={mode}
        onModeChange={setMode}
        tool={annotateTool}
        onToolChange={setAnnotateTool}
        color={annotateColor}
        onColorChange={setAnnotateColor}
        alwaysTranslate={alwaysTranslate}
        onToggleTranslate={() => setAlwaysTranslate((v) => !v)}
        onOpenExternal={id ? () => void papersApi.openFile(id) : undefined}
      />

      {notesError ? (
        <div className="shrink-0 bg-apple-red/10 px-4 py-1.5 text-xs text-apple-red">{notesError}</div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        {leftOpen ? (
          <ReaderPaperList currentId={id} onSelect={(pid) => navigate(`/papers/${pid}/reader`)} />
        ) : null}

        <div className="min-w-0 flex-1">
          {loading ? (
            <div className="flex h-full items-center justify-center text-sm text-ink-tertiary">正在打开论文…</div>
          ) : loadError ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <p className="text-sm font-semibold text-ink-primary">无法阅读</p>
              <p className="max-w-md text-xs leading-5 text-ink-tertiary">{loadError}</p>
              {id ? (
                <Button type="button" size="sm" variant="secondary" onClick={() => void papersApi.openFile(id)}>
                  <ExternalLink className="h-3.5 w-3.5" />
                  尝试用系统阅读器打开
                </Button>
              ) : null}
            </div>
          ) : pdfData ? (
            <PdfReaderViewer
              ref={viewerRef}
              data={pdfData}
              notes={notes}
              scale={scale}
              onTextSelected={handleTextSelected}
              onSelectionCleared={handlePopupsCleared}
              onNoteClick={handleNoteClick}
              onZoom={handleZoom}
            />
          ) : null}
        </div>

        <ReaderTranslationPanel
          entries={translation.entries}
          onRemove={translation.remove}
          onClear={translation.clear}
        />
      </div>

      {selection ? (
        <SelectionPopup
          x={selection.popupX}
          y={selection.popupY}
          selectedText={selection.text}
          onAnnotate={handleAnnotate}
          onSaveCorpus={handleSaveCorpus}
          onTranslate={handleTranslate}
          onClose={clearSelection}
        />
      ) : editing ? (
        <SelectionPopup
          mode="edit"
          x={editing.x}
          y={editing.y}
          selectedText={editing.note.highlight_text ?? ""}
          initialColor={editing.note.highlight_color}
          onRecolor={(color) => void updateColor(editing.note.id, color)}
          onDelete={() => {
            void deleteAnnotation(editing.note.id);
            setEditing(null);
          }}
          onTranslate={() => {
            void translation.translate(editing.note.highlight_text ?? "", editing.note.page);
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      ) : null}

      {toast ? (
        <div
          className="fixed bottom-6 left-1/2 z-[90] -translate-x-1/2 rounded-full px-4 py-2 text-xs font-semibold text-white shadow-lg"
          style={{ background: "rgba(28,28,30,0.92)" }}
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}
