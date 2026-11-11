import "./text-layer.css";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  type HighlightColor, type NormalizedRect, type NoteDockSide, type PaperNote,
  type ReaderImageSelection, type ReaderSelection, type ShapeStyle,
} from "./readerTypes";
import { useDevicePixelRatio } from "./useDevicePixelRatio";
import { usePdfTextSelection } from "./usePdfTextSelection";
import { usePdfZoomAnchor } from "./usePdfZoomAnchor";
import { usePdfViewportProgress } from "./usePdfViewportProgress";

import PdfPage from "./PdfPage";
import { getPdfRenderQueue } from "./pdfRenderQueue";
import { usePdfPageWindow } from "./usePdfPageWindow";
import { usePdfNavigation } from "./usePdfNavigation";
import { groupPageRows, resolveSpreadFit, type ReaderPageSize, type ReaderPageLayout } from "./pageLayout";

/** 滚动容器左右内边距（px-6），双页适宽计算要扣掉。 */
const CONTAINER_PADDING_X = 24;

interface PdfReaderViewerProps {
  pdfDoc: PDFDocumentProxy;
  notes: PaperNote[];
  scale: number;
  renderScale?: number;
  /** 页面排布：单页纵向滚动，或双页左右并排。 */
  pageLayout?: ReaderPageLayout;
  readingAreaSelectionEnabled?: boolean;
  initialPage?: number;
  onProgressChange?: (progress: { page: number; totalPages: number; percent: number }) => void;
  onTextSelected: (selection: ReaderSelection) => void;
  onSelectionCleared: () => void;
  onNoteClick: (note: PaperNote, point: { x: number; y: number }) => void;
  /** Cmd/Ctrl + 滚轮缩放：factor > 1 放大、< 1 缩小。 */
  onZoom: (factor: number) => void;
  onAreaSelected?: (selection: ReaderImageSelection) => void;
  onAreaSelectError?: (message: string) => void;
  /** 形状绘制模式：非空时在页面上拖拽画框，而非划词选择。 */
  drawShape?: ShapeStyle | null;
  /** 自由文字模式：点击页面任意位置后就地输入。 */
  drawText?: boolean;
  drawColor?: HighlightColor;
  drawFill?: HighlightColor | null;
  onShapeDrawn?: (page: number, rect: NormalizedRect) => void;
  onTextDrawn?: (page: number, rect: NormalizedRect, content: string) => void | Promise<boolean | void>;
  onTextUpdate?: (note: PaperNote, content: string) => void | Promise<boolean | void>;
  onTextDelete?: (note: PaperNote) => void | Promise<boolean | void>;
  onTextColorChange?: (note: PaperNote, color: HighlightColor) => void;
  /** 拖动已有形状或文字批注到新位置。 */
  onAnnotationMove?: (note: PaperNote, rect: NormalizedRect) => void;
  /** 该侧笔记栏收起时，用细线在原文位置做标记（按侧分别控制显隐）。 */
  noteTickVisible?: Record<NoteDockSide, boolean>;
  /** 手动换过栏的笔记：批注 ID → 栏位。 */
  noteSideOverrides?: Record<string, NoteDockSide>;
  /** 与笔记卡联动的当前笔记：细线加粗、不透明度拉满。 */
  activeNoteId?: string | null;
  onNoteTickClick?: (note: PaperNote) => void;
  /** 双页适宽系数变化（1 = 没被压缩）；缩放控件据此提示「已缩到适宽」。 */
  onSpreadFitChange?: (fit: number) => void;
}

export interface PdfReaderViewerHandle {
  /** 滚到某一页；切换排布后需要即时归位时传 { smooth: false }。 */
  scrollToPage: (page: number, options?: { smooth?: boolean }) => void;
  /** 精确滚到页内锚点（0..1）；页面还没渲染时先粗定位，渲染完成后自动对位。 */
  scrollToNote: (page: number, anchorRatio: number) => void;
}

const PdfReaderViewer = forwardRef<PdfReaderViewerHandle, PdfReaderViewerProps>(
  function PdfReaderViewer(
    { pdfDoc, notes, scale, renderScale = scale, pageLayout = "single", readingAreaSelectionEnabled = false, initialPage, onProgressChange, onTextSelected, onSelectionCleared, onNoteClick, onZoom, onAreaSelected, onAreaSelectError, drawShape, drawText = false, drawColor, drawFill, onShapeDrawn, onTextDrawn, onTextUpdate, onTextDelete, onTextColorChange, onAnnotationMove, noteTickVisible, noteSideOverrides, activeNoteId = null, onNoteTickClick, onSpreadFitChange },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
    const renderQueue = useMemo(() => getPdfRenderQueue(pdfDoc), [pdfDoc]);
    /** 滚动容器宽度：双页模式下据此把两页压到刚好放得下。 */
    const [containerWidth, setContainerWidth] = useState(0);
    /** 单页在 100% 比例下的宽度，用于估算双页并排的总宽度。 */
    const [unitPageSize, setUnitPageSize] = useState<ReaderPageSize | undefined>();
    const [measuredPages, setMeasuredPages] = useState(() => ({ document: pdfDoc, sizes: new Map<number, ReaderPageSize>() }));
    const pageSizes = useMemo(() => measuredPages.document === pdfDoc ? measuredPages.sizes : new Map<number, ReaderPageSize>(), [measuredPages, pdfDoc]);
    const recordPageSize = useCallback((page: number, size: ReaderPageSize) => {
      setMeasuredPages((previous) => {
        const sizes = previous.document === pdfDoc ? previous.sizes : new Map<number, ReaderPageSize>();
        const old = sizes.get(page);
        if (old && Math.abs(old.width - size.width) < 0.001 && Math.abs(old.height - size.height) < 0.001) return previous;
        return { document: pdfDoc, sizes: new Map(sizes).set(page, size) };
      });
    }, [pdfDoc]);
    const { activePages, retainedPages } = usePdfPageWindow(pdfDoc, containerRef, pageRefs, initialPage, pageLayout);
    const [linkMode, setLinkMode] = useState(false);
    const devicePixelRatio = useDevicePixelRatio();
    const numPages = pdfDoc.numPages;
    const isSpread = pageLayout === "spread";

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

    usePdfTextSelection({
      containerRef,
      enabled: Boolean(pdfDoc) && !drawShape && !drawText,
      onTextSelected,
      onSelectionCleared,
    });

    const { markPageActive } = usePdfViewportProgress({ containerRef, pageRefs, numPages, documentKey: pdfDoc, initialPage, onProgressChange });
    const { scrollToPage, scrollToNote } = usePdfNavigation({
      containerRef, pageRefs, documentKey: pdfDoc, layoutKey: pageLayout, onPageActive: markPageActive,
    });
    useImperativeHandle(ref, () => ({ scrollToPage, scrollToNote }), [scrollToPage, scrollToNote]);

    usePdfZoomAnchor({ containerRef, pageRefs, scale, documentKey: pdfDoc, onZoom });

    // 双页适宽：量容器宽度 + 首页在 100% 下的宽度，才能算出两页并排是否需要收敛。
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;
      const measure = () => setContainerWidth(container.clientWidth);
      measure();
      if (typeof ResizeObserver !== "function") {
        window.addEventListener("resize", measure);
        return () => window.removeEventListener("resize", measure);
      }
      const observer = new ResizeObserver(measure);
      observer.observe(container);
      return () => observer.disconnect();
    }, []);

    useEffect(() => {
      let cancelled = false;
      setUnitPageSize(undefined);
      if (typeof pdfDoc.getPage !== "function") return;
      void pdfDoc.getPage(1)
        .then((page) => {
          if (!cancelled) {
            const viewport = page.getViewport({ scale: 1 });
            setUnitPageSize({ width: viewport.width, height: viewport.height });
          }
        })
        .catch(() => {
          // 拿不到页面尺寸只影响双页适宽，退回原比例即可。
        });
      return () => {
        cancelled = true;
      };
    }, [pdfDoc]);

    // 双页：首页单独一行，其后两页一行；适宽系数只在真的放不下时才小于 1。
    const pageRows = useMemo(() => groupPageRows(numPages, pageLayout), [numPages, pageLayout]);
    const rowFits = useMemo(() => pageRows.map((row) => {
      if (!isSpread) return 1;
      const fallbackWidth = unitPageSize?.width ?? pageSizes.values().next().value?.width ?? 0;
      const firstWidth = pageSizes.get(row[0])?.width ?? fallbackWidth;
      const secondWidth = row.length > 1
        ? pageSizes.get(row[1])?.width ?? fallbackWidth
        : firstWidth;
      return resolveSpreadFit({ containerWidth, horizontalPadding: CONTAINER_PADDING_X * 2,
        pageWidth: firstWidth, secondPageWidth: secondWidth, scale });
    }), [isSpread, pageRows, pageSizes, containerWidth, unitPageSize, scale]);
    const spreadFit = Math.min(1, ...rowFits);

    // 把适宽状态报给外层，缩放控件据此说明「按了什么比例显示」。
    useEffect(() => {
      onSpreadFitChange?.(spreadFit);
    }, [spreadFit, onSpreadFitChange]);

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

    return (
      <div
        ref={containerRef}
        className={`h-full space-y-4 overflow-y-auto px-6 py-4${linkMode ? " pdf-links-active" : ""}`}
      >
        {pageRows.map((row, rowIndex) => (
          <div key={row[0]} className={isSpread ? "flex w-full items-start justify-center gap-4" : undefined}>
            {row.map((pageNum) => (
              <PdfPage
                key={pageNum}
                pageNum={pageNum}
                pdfDoc={pdfDoc}
                scale={scale}
                renderScale={renderScale}
                displayFactor={rowFits[rowIndex]}
                estimatedPageSize={pageSizes.get(pageNum) ?? unitPageSize}
                onPageSize={recordPageSize}
                spreadEdge={isSpread && row.length > 1 ? (pageNum === row[0] ? "left" : "right") : undefined}
                readingAreaSelectionEnabled={readingAreaSelectionEnabled}
                devicePixelRatio={devicePixelRatio}
                shouldRender={activePages.has(pageNum)}
                retainResources={retainedPages.has(pageNum)}
                renderQueue={renderQueue}
                renderPriority={() => {
                  const page = pageRefs.current[pageNum - 1]?.getBoundingClientRect();
                  const viewport = containerRef.current?.getBoundingClientRect();
                  if (!page || !viewport) return pageNum;
                  const visible = page.bottom > viewport.top && page.top < viewport.bottom;
                  return (visible ? 0 : 1_000_000) + Math.abs((page.top + page.bottom - viewport.top - viewport.bottom) / 2);
                }}
                pageNotes={notesByPage.get(pageNum) ?? []}
                onNoteClick={onNoteClick}
                onScrollToPage={scrollToPage}
                onAreaSelected={onAreaSelected}
                onAreaSelectError={onAreaSelectError}
                drawShape={drawShape}
                drawText={drawText}
                drawColor={drawColor}
                drawFill={drawFill}
                onShapeDrawn={onShapeDrawn}
                onTextDrawn={onTextDrawn}
                onTextUpdate={onTextUpdate}
                onTextDelete={onTextDelete}
                onTextColorChange={onTextColorChange}
                onAnnotationMove={onAnnotationMove}
                noteTickVisible={noteTickVisible}
                noteSideOverrides={noteSideOverrides}
                activeNoteId={activeNoteId}
                onNoteTickClick={onNoteTickClick}
                ref={(el) => {
                  pageRefs.current[pageNum - 1] = el;
                }}
              />
            ))}
          </div>
        ))}
      </div>
    );
  },
);

export default PdfReaderViewer;
