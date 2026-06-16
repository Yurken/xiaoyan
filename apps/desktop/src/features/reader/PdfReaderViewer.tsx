/* eslint-disable @typescript-eslint/no-explicit-any */
import "./text-layer.css";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { HIGHLIGHT_COLORS, type NormalizedRect, type PaperNote } from "./readerTypes";
import { useDevicePixelRatio } from "./useDevicePixelRatio";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

// pdf.js 的 getTextContent 依赖 ReadableStream 的异步迭代，而 macOS Tauri 的
// WKWebView 尚未实现 ReadableStream[Symbol.asyncIterator]，会抛
// "undefined is not a function (near '...value of readableStream...')"。此处补丁。
(() => {
  if (typeof ReadableStream === "undefined") return;
  const proto = ReadableStream.prototype as unknown as Record<symbol | string, unknown>;
  if (typeof proto[Symbol.asyncIterator] === "function") return;
  const values = function (this: ReadableStream, options?: { preventCancel?: boolean }) {
    const preventCancel = options?.preventCancel ?? false;
    const reader = this.getReader();
    return {
      next() {
        return reader.read();
      },
      return(value?: unknown) {
        if (!preventCancel) void reader.cancel(value);
        reader.releaseLock();
        return Promise.resolve({ done: true, value });
      },
      [Symbol.asyncIterator]() {
        return this;
      },
    };
  };
  proto.values = proto.values ?? values;
  proto[Symbol.asyncIterator] = proto.values;
})();

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
    const devicePixelRatio = useDevicePixelRatio();

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
        // 延后一帧读取选区：WKWebView 在 mouseup 时选区可能尚未最终确定。
        window.requestAnimationFrame(() => {
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
            devicePixelRatio={devicePixelRatio}
            shouldRender={renderedPages.has(pageNum) || pageNum <= 4}
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
  devicePixelRatio: number;
  shouldRender: boolean;
  pageNotes: PaperNote[];
}

const PdfPage = forwardRef<HTMLDivElement, PdfPageProps>(function PdfPage(
  { pageNum, pdfDoc, scale, devicePixelRatio, shouldRender, pageNotes },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const [pageSize, setPageSize] = useState<{ w: number; h: number } | null>(null);
  const renderedSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    if (!shouldRender) return;

    // 至少 2 倍超采样：即便 WKWebView 首屏把 devicePixelRatio 误报为 1，
    // 画布仍按 2x 绘制再用 CSS 缩回，保证文字清晰，不依赖 DPR 时序。
    const outputScale = Math.max(devicePixelRatio || 1, 2);
    const renderSignature = `${scale}:${outputScale}`;
    if (renderedSignatureRef.current === renderSignature) return;

    let cancelled = false;
    let renderTask: any = null;
    let textLayer: any = null;

    // 延后到下一帧再渲染，进一步避开 WebView 首屏 DPR 抖动。
    const raf = requestAnimationFrame(() => {
      (async () => {
        try {
          const page = await pdfDoc.getPage(pageNum);
          if (cancelled) return;
          const viewport = page.getViewport({ scale });
          setPageSize({ w: viewport.width, h: viewport.height });

          const canvas = canvasRef.current;
          if (!canvas) return;

          const cssWidth = Math.floor(viewport.width);
          const cssHeight = Math.floor(viewport.height);
          const pixelWidth = Math.floor(cssWidth * outputScale);
          const pixelHeight = Math.floor(cssHeight * outputScale);

          // 显式重置宽高，确保 WebKit 重新分配 backing store；
          // 仅当数值真正变化时才改，避免无意义的重分配。
          if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
            canvas.width = pixelWidth;
            canvas.height = pixelHeight;
          }
          canvas.style.width = `${cssWidth}px`;
          canvas.style.height = `${cssHeight}px`;

          const ctx = canvas.getContext("2d", { alpha: false });
          if (!ctx) return;
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          renderTask = page.render({
            canvasContext: ctx,
            viewport,
            transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0],
            background: "white",
          } as any);
          await renderTask.promise;
          if (cancelled) return;

          // 画布渲染成功即锁定签名，避免文本层失败时无限重渲染。
          renderedSignatureRef.current = renderSignature;

          // 文本层（划词选择/批注/翻译依赖它）尽力渲染，失败不影响画布显示。
          try {
            const textLayerDiv = textLayerRef.current;
            if (textLayerDiv) {
              // 先清空旧的文本层，避免重复渲染导致选区重影（两层 span 叠加）。
              textLayerDiv.replaceChildren();
              const textContent = await page.getTextContent();
              if (cancelled) {
                textLayerDiv.replaceChildren();
                return;
              }
              pdfjsLib.setLayerDimensions(textLayerDiv, viewport);
              textLayer = new pdfjsLib.TextLayer({ textContentSource: textContent, container: textLayerDiv, viewport });
              await textLayer.render();
              if (cancelled) {
                textLayer.cancel?.();
                textLayerDiv.replaceChildren();
                return;
              }
              // pdfjs-dist v5 的文本 span 不一定带 role 属性，这里兜底全部 span。
              textLayerDiv.querySelectorAll("span").forEach((span) => {
                const el = span as HTMLElement;
                el.style.userSelect = "text";
                el.style.webkitUserSelect = "text";
                el.style.cursor = "text";
              });
            }
          } catch (textErr) {
            console.error(`[PdfReaderViewer] 第 ${pageNum} 页文本层渲染失败`, textErr);
          }
        } catch (err) {
          console.error(`[PdfReaderViewer] 第 ${pageNum} 页渲染失败`, err);
        }
      })();
    });

    return () => {
      cancelled = true;
      try {
        renderTask?.cancel();
        textLayer?.cancel();
      } catch {
        // ignore cancelled task cleanup errors
      }
      cancelAnimationFrame(raf);
    };
  }, [shouldRender, pdfDoc, pageNum, scale, devicePixelRatio]);

  const containerStyle: React.CSSProperties = pageSize
    ? ({
        width: pageSize.w,
        height: pageSize.h,
        "--scale-factor": scale,
        "--user-unit": 1,
        "--total-scale-factor": `calc(${scale} * var(--user-unit))`,
        "--scale-round-x": "1px",
        "--scale-round-y": "1px",
      } as React.CSSProperties)
    : { minHeight: 400, width: "100%" };

  return (
    <div
      ref={ref}
      data-page-num={pageNum}
      className="rc-selectable relative mx-auto select-text"
      style={{ ...containerStyle, background: "white", boxShadow: "0 2px 12px rgba(0,0,0,0.08)", borderRadius: 4 }}
    >
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0" style={pageSize ? { width: pageSize.w, height: pageSize.h } : {}} />
      <div
        ref={textLayerRef}
        className="textLayer rc-selectable absolute inset-0"
        style={{ zIndex: 1, width: pageSize?.w, height: pageSize?.h }}
      />

      {pageSize
        ? pageNotes.map((note) =>
            (note.highlight_positions ?? []).map((pos, i) => {
              const color = HIGHLIGHT_COLORS[note.highlight_color];
              const style: React.CSSProperties = {
                left: pos.x * pageSize.w,
                top: pos.y * pageSize.h,
                width: pos.w * pageSize.w,
                height: pos.h * pageSize.h,
                zIndex: 2,
              };
              if (note.style === "underline") {
                style.borderBottom = `2px solid ${color.border}`;
              } else if (note.style === "strike") {
                style.background = `linear-gradient(to bottom, transparent calc(50% - 1px), ${color.border} calc(50% - 1px), ${color.border} calc(50% + 1px), transparent calc(50% + 1px))`;
              } else {
                style.background = color.bg;
                style.borderBottom = `2px solid ${color.border}`;
                style.borderRadius = 2;
              }
              return (
                <div
                  key={`${note.id}-${i}`}
                  className="pdf-highlight-overlay pointer-events-none absolute"
                  style={style}
                />
              );
            }),
          )
        : null}

      <div
        className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 text-[10px]"
        style={{ background: "rgba(0,0,0,0.05)", color: "rgba(0,0,0,0.35)", zIndex: 3 }}
      >
        {pageNum}
      </div>
    </div>
  );
});
