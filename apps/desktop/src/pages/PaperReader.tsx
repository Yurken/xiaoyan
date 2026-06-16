import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ExternalLink, Minus, Plus } from "lucide-react";
import type { Paper } from "@research-copilot/types";
import { Button } from "@research-copilot/ui";
import { papersApi } from "../lib/client";
import PdfReaderViewer, { type PdfReaderViewerHandle, type ReaderSelection } from "../features/reader/PdfReaderViewer";
import ReaderAnnotationsPanel from "../features/reader/ReaderAnnotationsPanel";
import SelectionPopup from "../features/reader/SelectionPopup";
import { useReaderNotes } from "../features/reader/useReaderNotes";
import type { AnnotationStyle, HighlightColor } from "../features/reader/readerTypes";

const MIN_SCALE = 0.6;
const MAX_SCALE = 3;

export default function PaperReader() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const viewerRef = useRef<PdfReaderViewerHandle>(null);

  const [paper, setPaper] = useState<Paper | null>(null);
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [scale, setScale] = useState(1.4);
  const [selection, setSelection] = useState<ReaderSelection | null>(null);

  const { notes, loading: notesLoading, error: notesError, createAnnotation, deleteAnnotation } = useReaderNotes(id);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    setPdfData(null);

    (async () => {
      try {
        const detail = await papersApi.get(id);
        if (cancelled) return;
        setPaper(detail);
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

  const handleAnnotate = useCallback(
    (color: HighlightColor, style: AnnotationStyle) => {
      if (!selection) return;
      void createAnnotation({
        page: selection.page,
        highlightText: selection.text,
        color,
        style,
        positions: selection.positions,
      });
      setSelection(null);
      window.getSelection()?.removeAllRanges();
    },
    [selection, createAnnotation],
  );

  return (
    <div className="flex h-full flex-col overflow-hidden" style={{ background: "var(--rc-surface)" }}>
      <header
        className="rc-reader-header flex min-h-[48px] shrink-0 items-center gap-3 border-b px-4 py-1.5"
        style={{ borderColor: "var(--rc-border)", background: "var(--rc-header-bg)" }}
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-tertiary transition-colors hover:bg-white/5 hover:text-ink-secondary"
          title="返回"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <p className="min-w-0 flex-1 truncate text-sm font-bold text-ink-primary">
          {paper?.title || "PDF 阅读"}
        </p>

        <div className="flex items-center gap-1 rounded-lg border px-1 py-0.5" style={{ borderColor: "var(--rc-border)" }}>
          <button
            type="button"
            onClick={() => setScale((s) => Math.max(MIN_SCALE, Math.round((s - 0.1) * 10) / 10))}
            className="flex h-6 w-6 items-center justify-center rounded text-ink-tertiary transition-colors hover:bg-white/5 hover:text-ink-secondary"
            title="缩小"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="w-10 text-center text-xs tabular-nums text-ink-secondary">{Math.round(scale * 100)}%</span>
          <button
            type="button"
            onClick={() => setScale((s) => Math.min(MAX_SCALE, Math.round((s + 0.1) * 10) / 10))}
            className="flex h-6 w-6 items-center justify-center rounded text-ink-tertiary transition-colors hover:bg-white/5 hover:text-ink-secondary"
            title="放大"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        {id ? (
          <Button type="button" size="sm" variant="secondary" onClick={() => void papersApi.openFile(id)} title="用系统阅读器打开">
            <ExternalLink className="h-3.5 w-3.5" />
            外部打开
          </Button>
        ) : null}
      </header>

      {notesError ? (
        <div className="shrink-0 bg-apple-red/10 px-4 py-1.5 text-xs text-apple-red">{notesError}</div>
      ) : null}

      <div className="flex min-h-0 flex-1">
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
              onTextSelected={setSelection}
              onSelectionCleared={() => setSelection(null)}
            />
          ) : null}
        </div>

        <ReaderAnnotationsPanel
          notes={notes}
          loading={notesLoading}
          onJumpToPage={(page) => viewerRef.current?.scrollToPage(page)}
          onDelete={(noteId) => void deleteAnnotation(noteId)}
        />
      </div>

      {selection ? (
        <SelectionPopup
          x={selection.popupX}
          y={selection.popupY}
          selectedText={selection.text}
          onAnnotate={handleAnnotate}
          onClose={() => setSelection(null)}
        />
      ) : null}
    </div>
  );
}
