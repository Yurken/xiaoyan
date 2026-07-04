import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ExternalLink, Languages } from "lucide-react";
import { Button } from "@research-copilot/ui";
import { papersApi } from "../lib/client";
import PdfReaderViewer, { type PdfReaderViewerHandle } from "../features/reader/PdfReaderViewer";
import ReaderTranslationPanel from "../features/reader/ReaderTranslationPanel";
import ReaderPaperList from "../features/reader/ReaderPaperList";
import ReaderToolbar from "../features/reader/ReaderToolbar";
import SelectionPopup from "../features/reader/SelectionPopup";
import { useReaderNotes } from "../features/reader/useReaderNotes";
import { useReaderTranslation } from "../features/reader/useReaderTranslation";
import { useSmoothReaderZoom } from "../features/reader/useSmoothReaderZoom";
import {
  isShapeStyle,
  type AnnotationStyle,
  type HighlightColor,
  type NormalizedRect,
  type PaperNote,
  type ReaderMode,
  type ReaderSelection,
} from "../features/reader/readerTypes";
import { useCorpus } from "../features/papers/useCorpus";
import { useResizableWidth } from "../hooks/useResizableWidth";

export default function PaperReader() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const viewerRef = useRef<PdfReaderViewerHandle>(null);

  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const { scale, renderScale, zoomByFactor, zoomStep } = useSmoothReaderZoom(1.4);
  const [selection, setSelection] = useState<ReaderSelection | null>(null);
  const [editing, setEditing] = useState<{ note: PaperNote; x: number; y: number } | null>(null);
  const [toast, setToast] = useState("");

  // 可拖拽宽度
  const leftPanel = useResizableWidth({ initialWidth: 256, minWidth: 180, maxWidth: 400 });
  const rightPanel = useResizableWidth({ initialWidth: 320, minWidth: 240, maxWidth: 500 });

  // 工具栏状态
  const [leftOpen, setLeftOpen] = useState(true);
  const [mode, setMode] = useState<ReaderMode>("view");
  const [annotateTool, setAnnotateTool] = useState<AnnotationStyle>("highlight");
  const [annotateColor, setAnnotateColor] = useState<HighlightColor>("yellow");
  const [annotateFill, setAnnotateFill] = useState<HighlightColor | null>(null);
  // 翻译栏展开即等于「自动翻译」：展开时划词自动翻译，收起则不翻译。
  const [translateOpen, setTranslateOpen] = useState(false);

  const { notes, error: notesError, createAnnotation, updateColor, updateFill, updateContent, moveAnnotation, deleteAnnotation, undo } = useReaderNotes(id);
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

  // 翻译栏展开时，按 Shift+空格（未在输入框）快速开关「连续翻译」。
  const toggleContinuous = translation.toggleContinuous;
  useEffect(() => {
    if (!translateOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.code !== "Space" || !event.shiftKey) return;
      const target = document.activeElement as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable='true']")) return;
      event.preventDefault(); // 阻止空格滚动 PDF
      toggleContinuous();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [translateOpen, toggleContinuous]);

  // 划词处理：批注模式直接套用预选工具；翻译栏开启则自动翻译；否则视图模式弹工具菜单。
  const handleTextSelected = useCallback(
    (next: ReaderSelection) => {
      setEditing(null);

      if (translateOpen && !translation.locked) {
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

      setSelection(next);
    },
    [translateOpen, mode, annotateColor, annotateTool, translation, createAnnotation, clearSelection],
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
    setTranslateOpen(true); // 翻译结果显示在右侧栏，自动展开
    void translation.translate(selection.text, selection.page);
    setSelection(null);
  }, [selection, translation]);

  const handleInterpret = useCallback(() => {
    if (!selection) return;
    setTranslateOpen(true); // 解读结果显示在右侧栏，自动展开
    translation.interpretText(selection.text);
    setSelection(null);
  }, [selection, translation]);

  // 形状绘制完成：把拖出的框存成形状批注（无原文），带边框色与填充色。
  const handleShapeDrawn = useCallback(
    (page: number, rect: NormalizedRect) => {
      void createAnnotation({
        page,
        highlightText: "",
        color: annotateColor,
        style: annotateTool,
        positions: [rect],
        fillColor: annotateFill,
      });
    },
    [createAnnotation, annotateColor, annotateTool, annotateFill],
  );

  const handleShapeMove = useCallback(
    (note: PaperNote, rect: NormalizedRect) => void moveAnnotation(note.id, [rect]),
    [moveAnnotation],
  );

  // 批注模式下选中形状工具即进入「绘制」模式：拖拽画框，不再划词。
  const drawShape = mode === "annotate" && isShapeStyle(annotateTool) ? annotateTool : null;

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
        fill={annotateFill}
        onFillChange={setAnnotateFill}
        onOpenExternal={id ? () => void papersApi.openFile(id) : undefined}
      />

      {notesError ? (
        <div className="shrink-0 bg-apple-red/10 px-4 py-1.5 text-xs text-apple-red">{notesError}</div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        {leftOpen ? (
          <ReaderPaperList
            currentId={id}
            onSelect={(pid) => navigate(`/papers/${pid}/reader`)}
            width={leftPanel.width}
            onDragStart={(e) => leftPanel.onDragStart(e, "right")}
          />
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
              renderScale={renderScale}
              onTextSelected={handleTextSelected}
              onSelectionCleared={handlePopupsCleared}
              onNoteClick={handleNoteClick}
              onZoom={zoomByFactor}
              drawShape={drawShape}
              drawColor={annotateColor}
              drawFill={annotateFill}
              onShapeDrawn={handleShapeDrawn}
              onShapeMove={handleShapeMove}
            />
          ) : null}
        </div>

        {translateOpen ? (
          <ReaderTranslationPanel
            current={translation.current}
            interpretation={translation.interpretation}
            locked={translation.locked}
            continuous={translation.continuous}
            fontSize={translation.fontSize}
            onToggleLock={translation.toggleLock}
            onToggleContinuous={translation.toggleContinuous}
            onFontSize={translation.setFontSize}
            onInterpret={translation.interpret}
            onEditSource={translation.editSource}
            onClear={translation.clear}
            onCollapse={() => setTranslateOpen(false)}
            width={rightPanel.width}
            onDragStart={(e) => rightPanel.onDragStart(e, "left")}
          />
        ) : (
          <button
            type="button"
            onClick={() => setTranslateOpen(true)}
            className="flex w-9 shrink-0 flex-col items-center gap-2 border-l py-3 text-ink-tertiary transition-colors hover:text-apple-blue"
            style={{ background: "var(--rc-card-bg)", borderColor: "var(--rc-border)" }}
            title="展开翻译栏（划词自动翻译）"
          >
            <Languages className="h-4 w-4" />
            <span className="text-[11px] tracking-wide" style={{ writingMode: "vertical-rl" }}>翻译</span>
          </button>
        )}
      </div>

      {selection ? (
        <SelectionPopup
          x={selection.popupX}
          y={selection.popupY}
          selectedText={selection.text}
          onAnnotate={handleAnnotate}
          onSaveCorpus={handleSaveCorpus}
          onTranslate={handleTranslate}
          onInterpret={handleInterpret}
          onClose={clearSelection}
        />
      ) : editing ? (
        <SelectionPopup
          key={editing.note.id}
          mode="edit"
          x={editing.x}
          y={editing.y}
          selectedText={editing.note.highlight_text ?? ""}
          initialColor={editing.note.highlight_color}
          isShape={isShapeStyle(editing.note.style)}
          initialFill={editing.note.fill_color}
          noteContent={editing.note.content}
          onRecolor={(color) => void updateColor(editing.note.id, color)}
          onRecolorFill={(fill) => void updateFill(editing.note.id, fill)}
          onUpdateNote={(content) => void updateContent(editing.note.id, content)}
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
