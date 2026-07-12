"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import "./text-layer.css";
import {
  useRef,
  useEffect,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import type { PaperNote } from "@/lib/reader-types";
import { HIGHLIGHT_COLORS } from "@/lib/reader-types";
import { useReaderState, clampScale, loadReaderState } from "./useReaderState";

// ── Types ──────────────────────────────────────────────────

interface PdfViewerProps {
  paperId: string;
  url: string;
  notes: PaperNote[];
  onTextSelected: (data: {
    text: string;
    page: number;
    positions: Array<{ x: number; y: number; w: number; h: number }>;
    popupX: number;
    popupY: number;
  }) => void;
  onSelectionCleared: () => void;
}

export interface PdfViewerHandle {
  scrollToPage: (page: number) => void;
}

// ── Dynamic pdfjs import ───────────────────────────────────

let pdfjsLibPromise: Promise<typeof import("pdfjs-dist")> | null = null;

function loadPdfJs() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import("pdfjs-dist").then((lib) => {
      lib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      return lib;
    });
  }
  return pdfjsLibPromise;
}

// ── Component ──────────────────────────────────────────────

const PdfViewer = forwardRef<PdfViewerHandle, PdfViewerProps>(function PdfViewer(
  { paperId, url, notes, onTextSelected, onSelectionCleared },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [numPages, setNumPages] = useState(0);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [scale, setScale] = useState(1.5);
  const scaleRef = useRef(scale);
  const [containerWidth, setContainerWidth] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [renderedPages, setRenderedPages] = useState<Set<number>>(new Set());
  const restoredRef = useRef(false);

  const { saveState } = useReaderState(paperId);

  // Notes indexed by page for quick lookup
  const notesByPageRef = useRef<Map<number, PaperNote[]>>(new Map());
  useEffect(() => {
    const map = new Map<number, PaperNote[]>();
    for (const n of notes) {
      const list = map.get(n.page) ?? [];
      list.push(n);
      map.set(n.page, list);
    }
    notesByPageRef.current = map;
  }, [notes]);

  // Load PDF document
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjsLib = await loadPdfJs();
        if (cancelled) return;
        const doc = await pdfjsLib.getDocument(url).promise;
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
  }, [url]);

  // Keep ref in sync with latest scale for reliable unmount persistence.
  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  // Observe container width → fit scale
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setContainerWidth(w);
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // Restore saved scale on first load; otherwise auto-fit to container width.
  useEffect(() => {
    if (!pdfDoc || !containerWidth) return;
    if (restoredRef.current) return;

    const saved = loadReaderState(paperId);
    if (saved?.scale) {
      setScale(clampScale(saved.scale));
      restoredRef.current = true;
      return;
    }

    let cancelled = false;
    (async () => {
      const page = await pdfDoc.getPage(1);
      if (cancelled) return;
      const viewport = page.getViewport({ scale: 1 });
      const padding = 48; // 24px each side
      const fitScale = (containerWidth - padding) / viewport.width;
      setScale(clampScale(fitScale));
    })();
    return () => {
      cancelled = true;
    };
  }, [pdfDoc, containerWidth, paperId]);

  // Restore scroll position after the document/pages are ready.
  useEffect(() => {
    if (!pdfDoc || numPages === 0) return;
    const saved = loadReaderState(paperId);
    if (!saved?.scrollTop) return;

    let rafId = 0;
    const timer = window.setTimeout(() => {
      rafId = requestAnimationFrame(() => {
        containerRef.current?.scrollTo(0, saved.scrollTop);
      });
    }, 50);

    return () => {
      window.clearTimeout(timer);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [pdfDoc, numPages, paperId]);

  // Persist state when the paper changes or the component unmounts.
  useEffect(() => {
    const container = containerRef.current;
    return () => {
      const scrollTop = container?.scrollTop ?? 0;
      saveState({ scale: scaleRef.current, scrollTop });
    };
  }, [paperId, saveState]);

  // Scroll to page
  const scrollToPage = useCallback(
    (page: number) => {
      const idx = page - 1;
      const el = pageRefs.current[idx];
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [],
  );

  useImperativeHandle(ref, () => ({ scrollToPage }), [scrollToPage]);

  // Handle text selection across the viewer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseUp = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        return;
      }

      const text = sel.toString().trim();
      if (text.length < 2) return;

      // Find which page the selection is in
      const range = sel.getRangeAt(0);
      const textLayer = range.startContainer.parentElement?.closest("[data-page-num]");
      if (!textLayer) return;

      const pageNum = parseInt(textLayer.getAttribute("data-page-num") || "0", 10);
      if (!pageNum) return;

      const textLayerRect = textLayer.getBoundingClientRect();

      // Get rects for the selection within the text layer
      const rects = range.getClientRects();
      const positions: Array<{ x: number; y: number; w: number; h: number }> = [];

      for (let i = 0; i < rects.length; i++) {
        const r = rects[i];
        positions.push({
          x: r.left - textLayerRect.left,
          y: r.top - textLayerRect.top,
          w: r.width,
          h: r.height,
        });
      }

      if (positions.length === 0) return;

      // Popup position: above the last rect
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
      // Clear selection when clicking outside text layer and not on highlight overlays
      if (!target.closest(".textLayer") && !target.closest(".pdf-highlight-overlay")) {
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

  // Track rendered pages via intersection observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container || numPages === 0) return;

    const io = new IntersectionObserver(
      (entries) => {
        setRenderedPages((prev) => {
          const next = new Set(prev);
          entries.forEach((entry) => {
            const pageNum = parseInt(
              (entry.target as HTMLElement).getAttribute("data-page-num") || "0",
              10,
            );
            if (pageNum > 0) {
              if (entry.isIntersecting) next.add(pageNum);
            }
          });
          return next;
        });
      },
      { root: container, rootMargin: "200px 0px" },
    );

    pageRefs.current.forEach((el) => {
      if (el) io.observe(el);
    });

    return () => io.disconnect();
  }, [numPages]);

  // ── Render ──────────────────────────────────────────────

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-sm font-medium mb-1" style={{ color: "var(--rc-text)" }}>
            PDF 加载失败
          </p>
          <p className="text-xs" style={{ color: "var(--rc-text-muted)" }}>
            {error}
          </p>
        </div>
      </div>
    );
  }

  if (!pdfDoc || scale === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div
            className="w-10 h-10 rounded-full mx-auto mb-3 animate-pulse"
            style={{ background: "var(--rc-chip-bg)" }}
          />
          <p className="text-sm" style={{ color: "var(--rc-text-muted)" }}>
            正在加载 PDF...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full overflow-y-auto px-6 py-4 space-y-4">
      {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
        <PdfPage
          key={pageNum}
          pageNum={pageNum}
          pdfDoc={pdfDoc}
          scale={scale}
          shouldRender={renderedPages.has(pageNum) || pageNum <= 3}
          pageNotes={notesByPageRef.current.get(pageNum) ?? []}
          ref={(el) => {
            pageRefs.current[pageNum - 1] = el;
          }}
        />
      ))}
    </div>
  );
});

export default PdfViewer;

// ── Single page component ──────────────────────────────────

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

  // Render-ID counter — incremented on every render attempt (incl. cleanup).
  // Only the most recent render is allowed to write to the canvas.
  // This prevents a stale page.render() (which cannot be cancelled) from
  // overwriting the correct canvas content after a scale change.
  const renderIdRef = useRef(0);

  // Render canvas + text layer.
  // Viewport is always computed fresh from the current `scale` inside the
  // effect body, so there is no dependency on a potentially-stale `pageSize` state.
  useEffect(() => {
    if (!shouldRender) return;

    let disposed = false;
    const id = ++renderIdRef.current;

    (async () => {
      try {
        const page = await pdfDoc.getPage(pageNum);
        if (disposed || id !== renderIdRef.current) return; // stale — skip

        const viewport = page.getViewport({ scale });
        const outputScale = window.devicePixelRatio || 1;
        const w = viewport.width;
        const h = viewport.height;

        // Update container dimensions for layout sizing
        setPageSize({ w, h });

        // Size the canvas buffer & CSS in one synchronous step
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = Math.floor(w * outputScale);
        canvas.height = Math.floor(h * outputScale);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.scale(outputScale, outputScale);

        await page.render({
          canvasContext: ctx,
          viewport,
          canvas: canvas as unknown as HTMLCanvasElement,
        } as any).promise;

        // Double-check: if a newer render started while we were painting, abort
        if (disposed || id !== renderIdRef.current) return;

        // ── Text layer ──
        const textLayerDiv = textLayerRef.current;
        if (!textLayerDiv) return;

        const textContent = await page.getTextContent();
        if (disposed || id !== renderIdRef.current) return;

        const { TextLayer, setLayerDimensions } = await loadPdfJs();

        textLayerDiv.innerHTML = "";
        setLayerDimensions(textLayerDiv, viewport);

        const textLayer = new TextLayer({
          textContentSource: textContent,
          container: textLayerDiv,
          viewport,
        });

        await textLayer.render();

        // Make text spans selectable
        const spans = textLayerDiv.querySelectorAll("span[role]");
        spans.forEach((span) => {
          (span as HTMLElement).style.userSelect = "text";
          (span as HTMLElement).style.cursor = "text";
        });
      } catch (e) {
        if (!disposed && id === renderIdRef.current) {
          console.error(`Failed to render page ${pageNum}:`, e);
        }
      }
    })();

    return () => {
      // Invalidate this render — any in-flight async work will bail out
      disposed = true;
    };
  }, [shouldRender, pdfDoc, pageNum, scale]);

  const containerStyle: React.CSSProperties = pageSize
    ? {
        width: pageSize.w,
        height: pageSize.h,
        // CSS variables required by pdfjs TextLayer
        "--scale-factor": scale,
        "--user-unit": 1,
        "--total-scale-factor": scale,
        "--scale-round-x": "1px",
        "--scale-round-y": "1px",
      } as React.CSSProperties
    : { minHeight: 400 };

  const canvasStyle: React.CSSProperties = pageSize
    ? { width: pageSize.w, height: pageSize.h }
    : {};

  return (
    <div
      ref={ref}
      data-page-num={pageNum}
      className="relative mx-auto select-text"
      style={{
        ...containerStyle,
        background: "white",
        boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
        borderRadius: 4,
      }}
    >
      <canvas ref={canvasRef} className="absolute inset-0" style={canvasStyle} />

      {/* Text layer */}
      <div
        ref={textLayerRef}
        className="textLayer absolute inset-0"
        style={{ zIndex: 1 }}
      />

      {/* Highlight overlays */}
      {pageNotes.map((note) =>
        (note.highlight_positions ?? []).map((pos, i) => (
          <div
            key={`${note.id}-${i}`}
            className="absolute pdf-highlight-overlay pointer-events-none"
            style={{
              left: pos.x,
              top: pos.y,
              width: pos.w,
              height: pos.h,
              background: HIGHLIGHT_COLORS[note.highlight_color].bg,
              borderBottom: `2px solid ${HIGHLIGHT_COLORS[note.highlight_color].border}`,
              zIndex: 2,
              borderRadius: 2,
            }}
          />
        )),
      )}

      {/* Page number label */}
      <div
        className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] px-2 py-0.5 rounded-full"
        style={{
          background: "rgba(0,0,0,0.05)",
          color: "rgba(0,0,0,0.35)",
          zIndex: 3,
        }}
      >
        {pageNum}
      </div>
    </div>
  );
});
