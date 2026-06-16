/* eslint-disable @typescript-eslint/no-explicit-any */
import "./text-layer.css";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { HIGHLIGHT_COLORS, type NormalizedRect, type PaperNote } from "./readerTypes";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export interface ReaderSelection {
  text: string;
  page: number;
  positions: NormalizedRect[];
  popupX: number;
  popupY: number;
}

interface PdfReaderViewerProps {
  data: Uint8Array;
  notes: PaperNote[];
  scale: number;
  onTextSelected: (selection: ReaderSelection) => void;
  onSelectionCleared: () => void;
}

export interface PdfReaderViewerHandle {
  scrollToPage: (page: number) => void;
}

const PdfReaderViewer = forwardRef<PdfReaderViewerHandle, PdfReaderViewerProps>(
  function PdfReaderViewer({ data, notes, scale, onTextSelected, onSelectionCleared }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
    const [numPages, setNumPages] = useState(0);
    const [pdfDoc, setPdfDoc] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [renderedPages, setRenderedPages] = useState<Set<number>>(new Set());

    const notesByPageRef = useRef<Map<number, PaperNote[]>>(new Map());
    useEffect(() => {
      const map = new Map<number, PaperNote[]>();
      for (const note of notes) {
        const list = map.get(note.page) ?? [];
        list.push(note);
        map.set(note.page, list);
      }
      notesByPageRef.current = map;
    }, [notes]);

    // 加载 PDF 文档
    useEffect(() => {
      let cancelled = false;
      setError(null);
      setPdfDoc(null);
      (async () => {
        try {
          const doc = await pdfjsLib.getDocument({ data: data.slice(0) }).promise;
          if (cancelled) return;
          setPdfDoc(doc);
          setNumPages(doc.numPages);
        } catch (e) {
          if (!cancelled) setError(e instanceof Error ? e.message : "PDF 加载失败");
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [data]);

    const scrollToPage = useCallback((page: number) => {
      const el = pageRefs.current[page - 1];
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, []);

    useImperativeHandle(ref, () => ({ scrollToPage }), [scrollToPage]);

    // 划词选择
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const handleMouseUp = () => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || !sel.toString().trim()) return;
        const text = sel.toString().trim();
        if (text.length < 2) return;

        const range = sel.getRangeAt(0);
        const textLayer = range.startContainer.parentElement?.closest("[data-page-num]");
        if (!textLayer) return;
        const pageNum = parseInt(textLayer.getAttribute("data-page-num") || "0", 10);
        if (!pageNum) return;

        const layerRect = textLayer.getBoundingClientRect();
        if (layerRect.width === 0 || layerRect.height === 0) return;

        const rects = range.getClientRects();
        const positions: NormalizedRect[] = [];
        for (let i = 0; i < rects.length; i += 1) {
          const r = rects[i];
          if (r.width < 1 || r.height < 1) continue;
          positions.push({
            x: (r.left - layerRect.left) / layerRect.width,
            y: (r.top - layerRect.top) / layerRect.height,
            w: r.width / layerRect.width,
            h: r.height / layerRect.height,
          });
        }
        if (positions.length === 0) return;

        const lastRect = rects[rects.length - 1];
        onTextSelected({
          text,
          page: pageNum,
          positions,
          popupX: lastRect.left + lastRect.width / 2,
          popupY: lastRect.top,
        });
      };

      const handleMouseDown = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (!target.closest(".textLayer") && !target.closest(".pdf-selection-popup")) {
          onSelectionCleared();
        }
      };

      container.addEventListener("mouseup", handleMouseUp);
      container.addEventListener("mousedown", handleMouseDown);
      return () => {
        container.removeEventListener("mouseup", handleMouseUp);
        container.removeEventListener("mousedown", handleMouseDown);
      };
    }, [onTextSelected, onSelectionCleared]);

    // 懒渲染：进入视口的页才渲染
    useEffect(() => {
      const container = containerRef.current;
      if (!container || numPages === 0) return;
      const io = new IntersectionObserver(
        (entries) => {
          setRenderedPages((prev) => {
            const next = new Set(prev);
            entries.forEach((entry) => {
              const pageNum = parseInt((entry.target as HTMLElement).getAttribute("data-page-num") || "0", 10);
              if (pageNum > 0 && entry.isIntersecting) next.add(pageNum);
            });
            return next;
          });
        },
        { root: container, rootMargin: "300px 0px" },
      );
      pageRefs.current.forEach((el) => el && io.observe(el));
      return () => io.disconnect();
    }, [numPages]);

    if (error) {
      return (
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <p className="mb-1 text-sm font-semibold text-ink-primary">PDF 加载失败</p>
            <p className="text-xs text-ink-tertiary">{error}</p>
          </div>
        </div>
      );
    }

    if (!pdfDoc) {
      return (
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-3 h-10 w-10 animate-pulse rounded-full" style={{ background: "var(--rc-chip-bg)" }} />
            <p className="text-sm text-ink-tertiary">正在加载 PDF...</p>
          </div>
        </div>
      );
    }

    return (
      <div ref={containerRef} className="h-full space-y-4 overflow-y-auto px-6 py-4">
        {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
          <PdfPage
            key={pageNum}
            pageNum={pageNum}
            pdfDoc={pdfDoc}
            scale={scale}
            shouldRender={renderedPages.has(pageNum) || pageNum <= 2}
            pageNotes={notesByPageRef.current.get(pageNum) ?? []}
            ref={(el) => {
              pageRefs.current[pageNum - 1] = el;
            }}
          />
        ))}
      </div>
    );
  },
);

export default PdfReaderViewer;

interface PdfPageProps {
  pageNum: number;
  pdfDoc: any;
  scale: number;
  shouldRender: boolean;
  pageNotes: PaperNote[];
}

const PdfPage = forwardRef<HTMLDivElement, PdfPageProps>(function PdfPage(
  { pageNum, pdfDoc, scale, shouldRender, pageNotes },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const [pageSize, setPageSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    if (!shouldRender) return;
    let cancelled = false;
    (async () => {
      try {
        const page = await pdfDoc.getPage(pageNum);
        if (cancelled) return;
        const viewport = page.getViewport({ scale });
        setPageSize({ w: viewport.width, h: viewport.height });

        const canvas = canvasRef.current;
        if (!canvas) return;
        const outputScale = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.scale(outputScale, outputScale);
        await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
        if (cancelled) return;

        const textLayerDiv = textLayerRef.current;
        if (!textLayerDiv) return;
        const textContent = await page.getTextContent();
        if (cancelled) return;
        textLayerDiv.innerHTML = "";
        pdfjsLib.setLayerDimensions(textLayerDiv, viewport);
        const textLayer = new pdfjsLib.TextLayer({ textContentSource: textContent, container: textLayerDiv, viewport });
        await textLayer.render();
        textLayerDiv.querySelectorAll("span[role]").forEach((span) => {
          (span as HTMLElement).style.userSelect = "text";
          (span as HTMLElement).style.cursor = "text";
        });
      } catch {
        // 渲染失败时静默，避免打断整篇阅读
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shouldRender, pdfDoc, pageNum, scale]);

  const containerStyle: React.CSSProperties = pageSize
    ? ({
        width: pageSize.w,
        height: pageSize.h,
        "--scale-factor": scale,
        "--total-scale-factor": scale,
      } as React.CSSProperties)
    : { minHeight: 400, width: "100%" };

  return (
    <div
      ref={ref}
      data-page-num={pageNum}
      className="relative mx-auto select-text"
      style={{ ...containerStyle, background: "white", boxShadow: "0 2px 12px rgba(0,0,0,0.08)", borderRadius: 4 }}
    >
      <canvas ref={canvasRef} className="absolute inset-0" style={pageSize ? { width: pageSize.w, height: pageSize.h } : {}} />
      <div ref={textLayerRef} className="textLayer absolute inset-0" style={{ zIndex: 1 }} />

      {pageSize
        ? pageNotes.map((note) =>
            (note.highlight_positions ?? []).map((pos, i) => {
              const color = HIGHLIGHT_COLORS[note.highlight_color];
              const underline = note.style === "underline";
              return (
                <div
                  key={`${note.id}-${i}`}
                  className="pdf-highlight-overlay pointer-events-none absolute"
                  style={{
                    left: pos.x * pageSize.w,
                    top: pos.y * pageSize.h,
                    width: pos.w * pageSize.w,
                    height: pos.h * pageSize.h,
                    background: underline ? "transparent" : color.bg,
                    borderBottom: `2px solid ${color.border}`,
                    borderRadius: underline ? 0 : 2,
                    zIndex: 2,
                  }}
                />
              );
            }),
          )
        : null}

      <div
        className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 text-[10px]"
        style={{ background: "rgba(0,0,0,0.05)", color: "rgba(0,0,0,0.35)", zIndex: 3 }}
      >
        {pageNum}
      </div>
    </div>
  );
});
