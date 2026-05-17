import { useCallback, useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { BookOpen, FileCheck2, ListTree, Loader2 } from "lucide-react";
import { CapsuleTabs } from "@research-copilot/ui";
import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { LatexPreviewBlock, WritingCompileSummary } from "./shared";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

type PreviewMode = "structure" | "pdf";

const PREVIEW_MODE_OPTIONS = [
  { value: "pdf", label: "PDF", icon: <FileCheck2 className="h-3.5 w-3.5" /> },
  { value: "structure", label: "结构", icon: <ListTree className="h-3.5 w-3.5" /> },
] as const;

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.1;

interface WritingPreviewPanelProps {
  blocks: LatexPreviewBlock[];
  source: string;
  compileResult: WritingCompileSummary | null;
  compact: boolean;
}

export default function WritingPreviewPanel({
  blocks,
  source,
  compileResult,
  compact,
}: WritingPreviewPanelProps) {
  const [previewMode, setPreviewMode] = useState<PreviewMode>("pdf");

  return (
    <aside className="flex min-h-0 flex-col gap-4 pl-1">
      <section
        className="flex flex-1 flex-col overflow-hidden rounded-xl border shadow-sm"
        style={{ background: "var(--rc-card-bg)", borderColor: "var(--rc-border)" }}
      >
        <div className="flex items-center justify-between border-b p-4" style={{ borderColor: "var(--rc-border)" }}>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-apple-blue/10 text-apple-blue">
              <BookOpen className="h-4 w-4" />
            </div>
            <p className="text-sm font-bold tracking-tight text-ink-primary">实时预览</p>
          </div>
          <CapsuleTabs
            value={previewMode}
            onChange={(value) => setPreviewMode(value as PreviewMode)}
            options={PREVIEW_MODE_OPTIONS}
            compact
          />
        </div>

        <div className={clsx(
          "min-h-0 flex-1 p-4",
          previewMode === "pdf" ? "overflow-hidden" : "overflow-y-auto space-y-4",
          compact && previewMode !== "pdf" ? "max-h-[34rem]" : "max-h-none"
        )}>
          {blocks.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 text-center text-ink-tertiary" style={{ borderColor: "var(--rc-border)" }}>
              <p className="text-xs">暂无内容预览。</p>
            </div>
          ) : previewMode === "pdf" ? (
            <PdfPreview compileResult={compileResult} compact={compact} />
          ) : (
            <StructurePreview blocks={blocks} />
          )}
        </div>
      </section>

    </aside>
  );
}

function PdfPreview({ compileResult, compact }: { compileResult: WritingCompileSummary | null, compact: boolean }) {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const renderTaskRef = useRef(new Map<number, pdfjsLib.RenderTask>());

  useEffect(() => {
    let cancelled = false;
    const tasksOnMount = renderTaskRef.current;

    async function loadPdf() {
      if (!compileResult?.pdfPath || !compileResult.success) {
        setPdfDoc(null);
        setNumPages(0);
        setPdfError(false);
        return;
      }

      setPdfLoading(true);
      setPdfError(false);
      setPdfDoc(null);
      setNumPages(0);
      try {
        const { readFile } = await import("@tauri-apps/plugin-fs");
        const bytes = await readFile(compileResult.pdfPath);
        if (cancelled) return;
        const doc = await pdfjsLib.getDocument({ data: bytes }).promise;
        if (cancelled) return;
        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setZoomLevel(1);
      } catch {
        if (!cancelled) setPdfError(true);
      } finally {
        if (!cancelled) setPdfLoading(false);
      }
    }

    loadPdf();

    return () => {
      cancelled = true;
      tasksOnMount.forEach((task) => { try { task.cancel(); } catch { /* ignore */ } });
      tasksOnMount.clear();
    };
  }, [compileResult?.pdfPath, compileResult?.success]);

  useEffect(() => {
    if (!pdfDoc || numPages === 0) return;

    const cancelled = false;
    const currentTasks = renderTaskRef.current;

    async function renderPages() {
      for (let i = 1; i <= numPages; i++) {
        if (cancelled) break;
        const page = await pdfDoc.getPage(i);
        if (cancelled) break;
        const viewport = page.getViewport({ scale: zoomLevel });
        const canvas = canvasRefs.current.get(i);
        if (!canvas) continue;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;
        const existing = currentTasks.get(i);
        if (existing) { try { existing.cancel(); } catch { /* ignore */ } }
        const task = page.render({ canvasContext: ctx, viewport });
        currentTasks.set(i, task);
        try {
          await task.promise;
        } catch {
          // cancelled
        }
      }
    }

    renderPages();

    return () => {
      currentTasks.forEach((task) => { try { task.cancel(); } catch { /* ignore */ } });
      currentTasks.clear();
    };
  }, [pdfDoc, numPages, zoomLevel]);

  const clampZoom = useCallback((value: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value)), []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.metaKey && !e.ctrlKey) return;
      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        setZoomLevel((prev) => clampZoom(prev + ZOOM_STEP));
      } else if (e.key === "-") {
        e.preventDefault();
        setZoomLevel((prev) => clampZoom(prev - ZOOM_STEP));
      } else if (e.key === "0") {
        e.preventDefault();
        setZoomLevel(1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [clampZoom]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    setZoomLevel((prev) => clampZoom(prev - Math.sign(e.deltaY) * ZOOM_STEP));
  }, [clampZoom]);

  if (!compileResult?.pdfPath || !compileResult.success) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-apple-blue/5 text-apple-blue/30 shadow-sm">
          <FileCheck2 className="h-8 w-8" />
        </div>
        <div className="max-w-[200px]">
          <p className="text-sm font-bold text-ink-primary">预览准备就绪</p>
          <p className="mt-1.5 text-xs leading-relaxed text-ink-tertiary">
            请点击上方「编译 PDF」按钮生成精准的排版预览。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative w-full overflow-hidden rounded-xl border shadow-lg"
      style={{
        borderColor: "var(--rc-border)",
        background: "#525659",
        height: compact ? "calc(100vh - 320px)" : "100%",
        minHeight: compact ? "500px" : undefined,
      }}
    >
      {pdfLoading ? (
        <div className="flex h-full w-full items-center justify-center gap-2 text-white/60">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-xs">加载 PDF...</span>
        </div>
      ) : pdfError ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-white/60">
          <p className="text-xs">无法加载 PDF 预览</p>
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="h-full w-full overflow-auto"
          onWheel={handleWheel}
        >
          <div className="mx-auto flex flex-col items-center gap-1 py-2">
            {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
              <canvas
                key={pageNum}
                ref={(el) => {
                  if (el) canvasRefs.current.set(pageNum, el);
                  else canvasRefs.current.delete(pageNum);
                }}
                className="shadow-md"
              />
            ))}
          </div>
        </div>
      )}
      {zoomLevel !== 1 && (
        <div className="pointer-events-none absolute bottom-4 right-4 rounded-lg bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-md">
          {Math.round(zoomLevel * 100)}%
        </div>
      )}
    </div>
  );
}

function StructurePreview({ blocks }: { blocks: LatexPreviewBlock[] }) {
  return (
    <>
      {blocks.map((block) => (
        <article
          key={block.id}
          className="rounded-xl border p-3.5 shadow-sm transition-shadow hover:shadow-md"
          style={{
            background: block.kind === "meta" ? "rgba(0,122,255,0.04)" : "var(--rc-card-inset-bg)",
            borderColor: "var(--rc-border)",
          }}
        >
          <div className="mb-2 flex items-center gap-2 border-b pb-2" style={{ borderColor: "var(--rc-border)" }}>
            <div
              className={clsx(
                "h-1.5 w-1.5 rounded-full",
                block.kind === "meta" ? "bg-apple-blue" : "bg-ink-tertiary/40",
              )}
            />
            <p
              className={clsx(
                "truncate text-xs tracking-tight text-ink-primary",
                block.kind === "meta" || block.level <= 1 ? "font-bold" : "font-semibold",
              )}
            >
              {block.title}
            </p>
          </div>
          {block.content ? (
            <p className="rc-selectable text-[12px] leading-relaxed text-ink-secondary">
              {block.content.length > 900 ? `${block.content.slice(0, 900)}...` : block.content}
            </p>
          ) : (
            <p className="text-[11px] italic text-ink-tertiary">该章节暂无正文内容。</p>
          )}
        </article>
      ))}
    </>
  );
}
