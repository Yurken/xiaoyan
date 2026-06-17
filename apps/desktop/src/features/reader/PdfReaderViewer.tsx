/* eslint-disable @typescript-eslint/no-explicit-any */
import "./text-layer.css";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { HIGHLIGHT_COLORS, mergeNormalizedRects, type PaperNote, type ReaderSelection } from "./readerTypes";
import { useDevicePixelRatio } from "./useDevicePixelRatio";
import { usePdfTextSelection } from "./usePdfTextSelection";
import { registerTextLayer } from "./textLayerSelection";
import { openLink } from "../../lib/links";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const MAX_CANVAS_SIDE = 4096;
const MAX_CANVAS_PIXELS = 12_000_000;
const MIN_CANVAS_OUTPUT_SCALE = 2;
const MAX_CANVAS_OUTPUT_SCALE = 2;
// 加载后在这些时刻强制重绘，把 WKWebView 首屏偏糊的前几页刷清晰（双缓冲下无感）。
const SETTLE_RERENDER_DELAYS = [250, 700, 1500] as const;

interface PdfReaderViewerProps {
  data: Uint8Array;
  notes: PaperNote[];
  scale: number;
  onTextSelected: (selection: ReaderSelection) => void;
  onSelectionCleared: () => void;
  onNoteClick: (note: PaperNote, point: { x: number; y: number }) => void;
  /** Cmd/Ctrl + 滚轮缩放：factor > 1 放大、< 1 缩小。 */
  onZoom: (factor: number) => void;
}

export interface PdfReaderViewerHandle {
  scrollToPage: (page: number) => void;
}

const PdfReaderViewer = forwardRef<PdfReaderViewerHandle, PdfReaderViewerProps>(
  function PdfReaderViewer({ data, notes, scale, onTextSelected, onSelectionCleared, onNoteClick, onZoom }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
    const [numPages, setNumPages] = useState(0);
    const [pdfDoc, setPdfDoc] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [renderedPages, setRenderedPages] = useState<Set<number>>(new Set());
    const [renderRevision, setRenderRevision] = useState(0);
    const [linkMode, setLinkMode] = useState(false);
    const devicePixelRatio = useDevicePixelRatio();

    // 渲染期同步计算：批注一变化即可立刻显示，避免靠 ref+effect 延迟一拍。
    const notesByPage = useMemo(() => {
      const map = new Map<number, PaperNote[]>();
      for (const note of notes) {
        const list = map.get(note.page) ?? [];
        list.push(note);
        map.set(note.page, list);
      }
      return map;
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

    usePdfTextSelection({
      containerRef,
      enabled: Boolean(pdfDoc),
      onTextSelected,
      onSelectionCleared,
    });

    // Cmd（mac）/ Ctrl（win）+ 滚轮缩放。必须用非 passive 原生监听才能 preventDefault。
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;
      const onWheel = (event: WheelEvent) => {
        if (!event.ctrlKey && !event.metaKey) return;
        event.preventDefault();
        onZoom(Math.exp(-event.deltaY * 0.0015));
      };
      container.addEventListener("wheel", onWheel, { passive: false });
      return () => container.removeEventListener("wheel", onWheel);
    }, [onZoom, pdfDoc]);

    // 按住 Cmd/Ctrl 时进入「超链接模式」：链接层接管点击，松开恢复划词选择。
    useEffect(() => {
      const sync = (event: KeyboardEvent | MouseEvent) => setLinkMode(event.metaKey || event.ctrlKey);
      const reset = () => setLinkMode(false);
      window.addEventListener("keydown", sync);
      window.addEventListener("keyup", sync);
      window.addEventListener("mousemove", sync);
      window.addEventListener("blur", reset);
      return () => {
        window.removeEventListener("keydown", sync);
        window.removeEventListener("keyup", sync);
        window.removeEventListener("mousemove", sync);
        window.removeEventListener("blur", reset);
      };
    }, []);

    // WKWebView 首屏常把画布栅格化得偏糊（与手动“放大再缩小”能变清晰是同一现象：
    // 都是等视图稳定后重新栅格一次）。因此在加载后做几次强制重绘把首屏几页刷清晰。
    // 关键：现在每页都是“离屏渲染完成后再整帧贴回”，重绘对用户是无感的（不会白闪、
    // 不会留下被拉伸的模糊底图），所以恢复这套 settle 重绘是安全的。
    useEffect(() => {
      if (!pdfDoc) return;

      let resizeTimer = 0;
      const timers: number[] = [];
      const bumpRevision = () => setRenderRevision((revision) => revision + 1);
      const scheduleResizeRevision = () => {
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(bumpRevision, 160);
      };

      for (const delay of SETTLE_RERENDER_DELAYS) {
        timers.push(window.setTimeout(bumpRevision, delay));
      }

      const container = containerRef.current;
      const resizeObserver = typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(scheduleResizeRevision)
        : null;
      if (container) {
        resizeObserver?.observe(container);
      }
      window.addEventListener("resize", scheduleResizeRevision);
      window.visualViewport?.addEventListener("resize", scheduleResizeRevision);

      return () => {
        window.clearTimeout(resizeTimer);
        timers.forEach((timer) => window.clearTimeout(timer));
        resizeObserver?.disconnect();
        window.removeEventListener("resize", scheduleResizeRevision);
        window.visualViewport?.removeEventListener("resize", scheduleResizeRevision);
      };
      // 不依赖 scale：缩放由页面渲染 effect 处理，避免每次缩放都重挂这批定时器。
    }, [pdfDoc, devicePixelRatio]);

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
      <div
        ref={containerRef}
        className={`h-full space-y-4 overflow-y-auto px-6 py-4${linkMode ? " pdf-links-active" : ""}`}
      >
        {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
          <PdfPage
            key={pageNum}
            pageNum={pageNum}
            pdfDoc={pdfDoc}
            scale={scale}
            devicePixelRatio={devicePixelRatio}
            renderRevision={renderRevision}
            shouldRender={renderedPages.has(pageNum) || pageNum <= 4}
            pageNotes={notesByPage.get(pageNum) ?? []}
            onNoteClick={onNoteClick}
            onScrollToPage={scrollToPage}
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

function resolveCanvasOutputScale(viewport: { width: number; height: number }, devicePixelRatio: number) {
  // WKWebView 首屏偶尔长期把 DPR 报成 1；PDF 是矢量内容，至少 2x 超采样才能避免文字发虚。
  const preferredScale = Math.min(
    MAX_CANVAS_OUTPUT_SCALE,
    Math.max(MIN_CANVAS_OUTPUT_SCALE, devicePixelRatio || 1),
  );
  const maxSideScale = Math.min(MAX_CANVAS_SIDE / viewport.width, MAX_CANVAS_SIDE / viewport.height);
  const maxAreaScale = Math.sqrt(MAX_CANVAS_PIXELS / Math.max(1, viewport.width * viewport.height));
  return Math.max(1, Math.min(preferredScale, maxSideScale, maxAreaScale));
}

function isRenderingCancelled(error: unknown) {
  return error instanceof Error && error.name === "RenderingCancelledException";
}

interface PdfLink {
  left: number;
  top: number;
  width: number;
  height: number;
  url?: string;
  dest?: unknown;
}

interface PdfPageProps {
  pageNum: number;
  pdfDoc: any;
  scale: number;
  devicePixelRatio: number;
  renderRevision: number;
  shouldRender: boolean;
  pageNotes: PaperNote[];
  onNoteClick: (note: PaperNote, point: { x: number; y: number }) => void;
  onScrollToPage: (page: number) => void;
}

const PdfPage = forwardRef<HTMLDivElement, PdfPageProps>(function PdfPage(
  { pageNum, pdfDoc, scale, devicePixelRatio, renderRevision, shouldRender, pageNotes, onNoteClick, onScrollToPage },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const [pageSize, setPageSize] = useState<{ w: number; h: number } | null>(null);
  const [links, setLinks] = useState<PdfLink[]>([]);
  const renderedSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    renderedSignatureRef.current = null;
    setPageSize(null);
    setLinks([]);
  }, [pdfDoc, pageNum]);

  useEffect(() => {
    if (!shouldRender) return;

    let cancelled = false;
    let renderTask: any = null;
    let textLayer: any = null;
    let unregisterTextLayer: (() => void) | null = null;

    // 延后到下一帧再渲染，进一步避开 WebView 首屏 DPR 抖动。
    const raf = requestAnimationFrame(() => {
      (async () => {
        try {
          const page = await pdfDoc.getPage(pageNum);
          if (cancelled) return;
          const viewport = page.getViewport({ scale });

          const actualDpr = window.devicePixelRatio || devicePixelRatio || 1;
          const outputScale = resolveCanvasOutputScale(viewport, actualDpr);

          const cssWidth = Math.round(viewport.width);
          const cssHeight = Math.round(viewport.height);
          const pixelWidth = Math.round(cssWidth * outputScale);
          const pixelHeight = Math.round(cssHeight * outputScale);

          const renderSignature = [
            scale,
            outputScale,
            actualDpr,
            cssWidth,
            cssHeight,
            pixelWidth,
            pixelHeight,
            renderRevision,
          ].join(":");

          if (renderedSignatureRef.current === renderSignature) {
            return;
          }

          const canvas = canvasRef.current;
          if (!canvas) return;

          // 离屏渲染，完成后再一次性把「尺寸 + 位图」提交到可见画布。
          // 渲染未完成前完全不动可见画布，因此：
          //  - 首屏只会在清晰页就绪后整页出现，不存在先模糊后变清晰；
          //  - 缩放时若中途被新的缩放打断，可见画布仍保持上一次的清晰画面，
          //    不会出现“小底图被拉伸成新尺寸”的永久模糊。
          const buffer = document.createElement("canvas");
          buffer.width = pixelWidth;
          buffer.height = pixelHeight;
          const bufferCtx = buffer.getContext("2d", { alpha: false });
          if (!bufferCtx) return;
          bufferCtx.setTransform(outputScale, 0, 0, outputScale, 0, 0);

          renderTask = page.render({
            canvasContext: bufferCtx,
            viewport,
            canvas: buffer,
            background: "white",
          } as any);
          await renderTask.promise;
          if (cancelled) return;

          const ctx = canvas.getContext("2d", { alpha: false });
          if (!ctx) return;
          // 渲染完成后才提交：原子地设置 backing 像素、CSS 尺寸并贴图，三者一致 → 始终清晰。
          canvas.width = pixelWidth;
          canvas.height = pixelHeight;
          canvas.style.width = `${cssWidth}px`;
          canvas.style.height = `${cssHeight}px`;
          ctx.drawImage(buffer, 0, 0);

          // 渲染成功后再锁定签名并提交页面尺寸，保证“清晰就绪”后整页一次性出现。
          renderedSignatureRef.current = renderSignature;
          setPageSize({ w: cssWidth, h: cssHeight });

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
              // 挂上 endOfContent 选区管理，消除选词（公式/跨段落）抖动。
              unregisterTextLayer = registerTextLayer(textLayerDiv);
            }
          } catch (textErr) {
            if (cancelled || isRenderingCancelled(textErr)) return;
            console.error(`[PdfReaderViewer] 第 ${pageNum} 页文本层渲染失败`, textErr);
          }

          // 超链接层：解析页面注释里的 Link，换算成当前缩放下的 CSS 坐标。
          try {
            const annotations = await page.getAnnotations();
            if (cancelled) return;
            const linkRects: PdfLink[] = [];
            for (const annotation of annotations as any[]) {
              if (annotation.subtype !== "Link" || (!annotation.url && annotation.dest == null)) continue;
              const [x1, y1, x2, y2] = viewport.convertToViewportRectangle(annotation.rect);
              linkRects.push({
                left: Math.min(x1, x2),
                top: Math.min(y1, y2),
                width: Math.abs(x2 - x1),
                height: Math.abs(y2 - y1),
                url: annotation.url,
                dest: annotation.dest,
              });
            }
            setLinks(linkRects);
          } catch (annotErr) {
            if (cancelled || isRenderingCancelled(annotErr)) return;
            console.error(`[PdfReaderViewer] 第 ${pageNum} 页超链接解析失败`, annotErr);
          }
        } catch (err) {
          if (cancelled || isRenderingCancelled(err)) return;
          console.error(`[PdfReaderViewer] 第 ${pageNum} 页渲染失败`, err);
        }
      })();
    });

    return () => {
      cancelled = true;
      try {
        renderTask?.cancel();
        textLayer?.cancel();
        unregisterTextLayer?.();
      } catch {
        // ignore cancelled task cleanup errors
      }
      cancelAnimationFrame(raf);
    };
  }, [shouldRender, pdfDoc, pageNum, scale, devicePixelRatio, renderRevision]);

  const handleLinkClick = useCallback(
    async (event: React.MouseEvent, link: PdfLink) => {
      // 仅在按住 Cmd/Ctrl 时跳转，避免影响普通划词选择。
      if (!event.metaKey && !event.ctrlKey) return;
      event.preventDefault();
      event.stopPropagation();
      if (link.url) {
        await openLink(link.url);
        return;
      }
      if (link.dest == null) return;
      try {
        const explicit = typeof link.dest === "string" ? await pdfDoc.getDestination(link.dest) : link.dest;
        const ref = Array.isArray(explicit) ? explicit[0] : null;
        if (ref) {
          const pageIndex = await pdfDoc.getPageIndex(ref);
          onScrollToPage(pageIndex + 1);
        }
      } catch (err) {
        console.error("[PdfReaderViewer] 内部链接跳转失败", err);
      }
    },
    [pdfDoc, onScrollToPage],
  );

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
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute left-0 top-0 block"
        style={pageSize ? { width: pageSize.w, height: pageSize.h } : undefined}
      />
      <div
        ref={textLayerRef}
        className="textLayer rc-selectable absolute left-0 top-0"
        style={{ zIndex: 1, width: pageSize?.w, height: pageSize?.h }}
      />

      {pageSize
        ? pageNotes.map((note) => {
            const positions = mergeNormalizedRects(note.highlight_positions ?? []);
            if (positions.length === 0) return null;
            const color = HIGHLIGHT_COLORS[note.highlight_color];
            return positions.map((pos, i) => {
              const style: React.CSSProperties = {
                left: pos.x * pageSize.w,
                top: pos.y * pageSize.h,
                width: pos.w * pageSize.w,
                height: pos.h * pageSize.h,
                zIndex: 2,
                cursor: "pointer",
              };
              if (note.style === "underline") {
                style.borderBottom = `2px solid ${color.border}`;
              } else if (note.style === "strike") {
                style.background = `linear-gradient(to bottom, transparent calc(50% - 1px), ${color.border} calc(50% - 1px), ${color.border} calc(50% + 1px), transparent calc(50% + 1px))`;
              } else {
                style.background = color.bg;
                style.borderRadius = 2;
              }
              return (
                <div
                  key={`${note.id}-${i}`}
                  className="pdf-highlight-overlay absolute"
                  style={style}
                  title="点击编辑批注"
                  onClick={(event) => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    onNoteClick(note, { x: rect.left + rect.width / 2, y: rect.top });
                  }}
                />
              );
            });
          })
        : null}

      {pageSize
        ? links.map((link, i) => (
            <div
              key={`link-${i}`}
              className="pdf-link-overlay absolute"
              style={{ left: link.left, top: link.top, width: link.width, height: link.height, zIndex: 3 }}
              title={link.url ?? "按住 Cmd/Ctrl 点击跳转"}
              onClick={(event) => void handleLinkClick(event, link)}
            />
          ))
        : null}

      <div
        className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 text-[10px]"
        style={{ background: "rgba(0,0,0,0.05)", color: "rgba(0,0,0,0.35)", zIndex: 4 }}
      >
        {pageNum}
      </div>
    </div>
  );
});
