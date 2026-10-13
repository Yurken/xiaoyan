import "./text-layer.css";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  type HighlightColor, type NormalizedRect, type PaperNote,
  type ReaderImageSelection, type ReaderSelection, type ShapeStyle,
} from "./readerTypes";
import { useDevicePixelRatio } from "./useDevicePixelRatio";
import { usePdfTextSelection } from "./usePdfTextSelection";
import { usePdfViewportProgress } from "./usePdfViewportProgress";

import PdfPage from "./PdfPage";
import { getPdfRenderQueue } from "./pdfRenderQueue";
import { usePdfPageWindow } from "./usePdfPageWindow";

interface PdfReaderViewerProps {
  pdfDoc: PDFDocumentProxy;
  notes: PaperNote[];
  scale: number;
  renderScale?: number;
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
}

export interface PdfReaderViewerHandle {
  scrollToPage: (page: number) => void;
}

const PdfReaderViewer = forwardRef<PdfReaderViewerHandle, PdfReaderViewerProps>(
  function PdfReaderViewer(
    { pdfDoc, notes, scale, renderScale = scale, readingAreaSelectionEnabled = false, initialPage, onProgressChange, onTextSelected, onSelectionCleared, onNoteClick, onZoom, onAreaSelected, onAreaSelectError, drawShape, drawText = false, drawColor, drawFill, onShapeDrawn, onTextDrawn, onTextUpdate, onTextDelete, onTextColorChange, onAnnotationMove },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
    const renderQueue = useMemo(() => getPdfRenderQueue(pdfDoc), [pdfDoc]);
    const { activePages, retainedPages } = usePdfPageWindow(pdfDoc, containerRef, pageRefs, initialPage);
    const [linkMode, setLinkMode] = useState(false);
    const devicePixelRatio = useDevicePixelRatio();
    const numPages = pdfDoc.numPages;

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

    const scrollToPage = useCallback((page: number) => {
      const el = pageRefs.current[page - 1];
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, []);

    useImperativeHandle(ref, () => ({ scrollToPage }), [scrollToPage]);

    usePdfTextSelection({
      containerRef,
      enabled: Boolean(pdfDoc) && !drawShape && !drawText,
      onTextSelected,
      onSelectionCleared,
    });

    usePdfViewportProgress({ containerRef, pageRefs, numPages, initialPage, onProgressChange });

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
            renderScale={renderScale}
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
