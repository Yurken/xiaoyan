import "./text-layer.css";
import { forwardRef, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  boundingRect,
  HIGHLIGHT_COLORS,
  isShapeStyle,
  isTextStyle,
  mergeNormalizedRects,
  SHAPE_BORDER_RADIUS,
  type HighlightColor,
  type NormalizedRect,
  type NoteDockSide,
  type PaperNote,
  type ReaderImageSelection,
  type ShapeStyle,
} from "./readerTypes";
import PdfTextAnnotationLayer from "./PdfTextAnnotationLayer";
import { buildNoteTicks, noteTickStyle } from "./notes/noteTicks";
import type { ReaderPageSize } from "./pageLayout";
import { usePdfAreaSelection } from "./usePdfAreaSelection";
import { useLineHighlightInteraction } from "./useLineHighlightInteraction";
import { openLink } from "../../lib/links";

import { usePdfPageRender } from "./usePdfPageRender";
import type { PdfRenderQueue } from "./pdfRenderQueue";
import type { PdfLink } from "./pdfRenderingShared";

export interface PdfPageProps {
  pageNum: number;
  pdfDoc: PDFDocumentProxy;
  scale: number;
  renderScale: number;
  /** 视觉缩放的额外收敛系数（双页适宽用），1 = 不干预。 */
  displayFactor?: number;
  /** 以首页尺寸估计未渲染页，保持懒渲染占位和双页适宽的几何一致。 */
  estimatedPageSize?: ReaderPageSize;
  onPageSize?: (page: number, size: ReaderPageSize) => void;
  /** 双页模式下该页在行内的位置：细线统一朝外，避免两页的细线挤在页缝里。 */
  spreadEdge?: "left" | "right";
  readingAreaSelectionEnabled: boolean;
  devicePixelRatio: number;
  shouldRender: boolean;
  retainResources: boolean;
  renderQueue: PdfRenderQueue;
  renderPriority: () => number;
  pageNotes: PaperNote[];
  onNoteClick: (note: PaperNote, point: { x: number; y: number }) => void;
  onScrollToPage: (page: number) => void;
  onAreaSelected?: (selection: ReaderImageSelection) => void;
  onAreaSelectError?: (message: string) => void;
  drawShape?: ShapeStyle | null;
  drawText: boolean;
  drawColor?: HighlightColor;
  drawFill?: HighlightColor | null;
  onShapeDrawn?: (page: number, rect: NormalizedRect) => void;
  onTextDrawn?: (page: number, rect: NormalizedRect, content: string) => void | Promise<boolean | void>;
  onTextUpdate?: (note: PaperNote, content: string) => void | Promise<boolean | void>;
  onTextDelete?: (note: PaperNote) => void | Promise<boolean | void>;
  onTextColorChange?: (note: PaperNote, color: HighlightColor) => void;
  onAnnotationMove?: (note: PaperNote, rect: NormalizedRect) => void;
  /** 该侧笔记栏收起时，用细线在原文位置做标记（按侧分别控制显隐）。 */
  noteTickVisible?: Record<NoteDockSide, boolean>;
  /** 手动换过栏的笔记：批注 ID → 栏位。 */
  noteSideOverrides?: Record<string, NoteDockSide>;
  /** 与笔记卡联动的当前笔记：细线加粗、不透明度拉满。 */
  activeNoteId?: string | null;
  onNoteTickClick?: (note: PaperNote) => void;
}

const NO_NOTE_TICKS: Record<NoteDockSide, boolean> = { left: false, right: false };

const PdfPage = forwardRef<HTMLDivElement, PdfPageProps>(function PdfPage(
  { pageNum, pdfDoc, scale, renderScale, displayFactor = 1, estimatedPageSize, onPageSize, spreadEdge, readingAreaSelectionEnabled, devicePixelRatio, shouldRender, retainResources, renderQueue, renderPriority, pageNotes, onNoteClick, onScrollToPage, onAreaSelected, onAreaSelectError, drawShape, drawText, drawColor, drawFill, onShapeDrawn, onTextDrawn, onTextUpdate, onTextDelete, onTextColorChange, onAnnotationMove, noteTickVisible = NO_NOTE_TICKS, noteSideOverrides, activeNoteId = null, onNoteTickClick },
  ref,
) {
  const imageRef = useRef<HTMLImageElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const drawLayerRef = useRef<HTMLDivElement>(null);
  const [draftRect, setDraftRect] = useState<NormalizedRect | null>(null);
  const [movingShape, setMovingShape] = useState<{ id: string; rect: NormalizedRect } | null>(null);
  const { pageSize, renderedScale, imgSrc, links } = usePdfPageRender({
    pdfDoc, pageNum, renderScale, devicePixelRatio, shouldRender, retainResources,
    renderQueue, renderPriority, textLayerRef,
  });

  const sizeDocumentRef = useRef(pdfDoc);
  useLayoutEffect(() => {
    const sameDocument = sizeDocumentRef.current === pdfDoc;
    sizeDocumentRef.current = pdfDoc;
    if (sameDocument && pageSize && renderedScale > 0) {
      onPageSize?.(pageNum, { width: pageSize.w / renderedScale, height: pageSize.h / renderedScale });
    }
  }, [pdfDoc, onPageSize, pageNum, pageSize, renderedScale]);

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

  // 形状绘制：在页面上按下并拖拽，松手得到一个归一化矩形 → 新建形状批注。
  const startDraw = useCallback(
    (event: React.MouseEvent) => {
      if (!drawShape || !onShapeDrawn) return;
      const layer = drawLayerRef.current;
      if (!layer) return;
      event.preventDefault();
      event.stopPropagation();
      const bounds = layer.getBoundingClientRect();
      if (bounds.width === 0 || bounds.height === 0) return;
      const toPoint = (clientX: number, clientY: number) => ({
        x: Math.min(1, Math.max(0, (clientX - bounds.left) / bounds.width)),
        y: Math.min(1, Math.max(0, (clientY - bounds.top) / bounds.height)),
      });
      const start = toPoint(event.clientX, event.clientY);
      const rectFrom = (cur: { x: number; y: number }): NormalizedRect => ({
        x: Math.min(start.x, cur.x),
        y: Math.min(start.y, cur.y),
        w: Math.abs(cur.x - start.x),
        h: Math.abs(cur.y - start.y),
      });
      setDraftRect({ x: start.x, y: start.y, w: 0, h: 0 });

      const onMove = (e: MouseEvent) => setDraftRect(rectFrom(toPoint(e.clientX, e.clientY)));
      const onUp = (e: MouseEvent) => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        const rect = rectFrom(toPoint(e.clientX, e.clientY));
        setDraftRect(null);
        if (rect.w > 0.01 && rect.h > 0.01) onShapeDrawn(pageNum, rect); // 太小视为误触
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [drawShape, onShapeDrawn, pageNum],
  );

  // 形状批注：按住拖动改位置；没怎么动（视为点击）则打开编辑浮层。
  const startShapeMove = useCallback(
    (event: React.MouseEvent, note: PaperNote, box: NormalizedRect) => {
      event.stopPropagation();
      event.preventDefault(); // 拖动时不要触发原生文字选择
      if (!pageSize) return;
      const startX = event.clientX;
      const startY = event.clientY;
      const elRect = event.currentTarget.getBoundingClientRect();
      const pageRect = (event.currentTarget.closest("[data-page-num]") as HTMLElement | null)?.getBoundingClientRect();
      if (!pageRect || pageRect.width === 0 || pageRect.height === 0) return;
      let moved = false;
      const rectAt = (clientX: number, clientY: number): NormalizedRect => ({
        x: Math.min(1 - box.w, Math.max(0, box.x + (clientX - startX) / pageRect.width)),
        y: Math.min(1 - box.h, Math.max(0, box.y + (clientY - startY) / pageRect.height)),
        w: box.w,
        h: box.h,
      });
      const onMove = (e: MouseEvent) => {
        if (Math.abs(e.clientX - startX) > 3 || Math.abs(e.clientY - startY) > 3) moved = true;
        setMovingShape({ id: note.id, rect: rectAt(e.clientX, e.clientY) });
      };
      const onUp = (e: MouseEvent) => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        setMovingShape(null);
        if (moved) onAnnotationMove?.(note, rectAt(e.clientX, e.clientY));
        else onNoteClick(note, { x: elRect.left + elRect.width / 2, y: elRect.top });
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [pageSize, onAnnotationMove, onNoteClick],
  );

  const {
    hoveredNote,
    showNoteHover,
    scheduleHoverClear,
    handlePageClick,
    handlePageMouseMove,
    handlePageMouseLeave,
  } = useLineHighlightInteraction({ pageNotes, pageSize, onNoteClick });
  const { draftRect: areaDraftRect, startAreaSelection } = usePdfAreaSelection({
    enabled: readingAreaSelectionEnabled,
    page: pageNum,
    pageSize,
    imageRef,
    onAreaSelected,
    onError: onAreaSelectError,
    requireAltKey: true,
  });

  // 视觉缩放 = 用户比例 / 渲染比例，再乘双页适宽系数：只缩显示，不触发重绘。
  const visualScaleRatio = (renderedScale > 0 ? scale / renderedScale : 1) * displayFactor;
  // 双页并排时由行容器 justify-center 居中，这页不再用 mx-auto（auto margin 会把两页推开）；
  // shrink-0 防止窄窗口下 flex 压缩外框——内部绝对定位层不会跟着缩，会错位。
  const pageClassName = `rc-selectable relative shrink-0 select-text${spreadEdge ? "" : " mx-auto"}`;
  // 笔记栏收起时，在该页对应的原文行旁留一条细线；位置取自批注的归一化坐标，随缩放自动跟随。
  const noteTicks = useMemo(
    () => (pageSize ? buildNoteTicks(pageNotes, pageSize.h, noteTickVisible, noteSideOverrides) : []),
    [pageNotes, pageSize, noteTickVisible, noteSideOverrides],
  );
  const containerStyle: React.CSSProperties = pageSize
    ? ({
        width: pageSize.w * visualScaleRatio,
        height: pageSize.h * visualScaleRatio,
      } as React.CSSProperties)
    : estimatedPageSize
      ? { width: estimatedPageSize.width * scale * displayFactor, height: estimatedPageSize.height * scale * displayFactor }
      : { minHeight: 400, width: spreadEdge ? "calc((100% - 16px) / 2)" : "100%" };
  const renderLayerStyle: React.CSSProperties = pageSize
    ? ({
        width: pageSize.w,
        height: pageSize.h,
        transform: visualScaleRatio === 1 ? undefined : `scale(${visualScaleRatio})`,
        transformOrigin: "0 0",
        "--scale-factor": renderedScale,
        "--user-unit": 1,
        "--total-scale-factor": `calc(${renderedScale} * var(--user-unit))`,
        "--scale-round-x": "1px",
        "--scale-round-y": "1px",
      } as React.CSSProperties)
    : {};

  return (
    <div
      ref={ref}
      data-page-num={pageNum}
      data-page-ready={pageSize ? "1" : "0"}
      className={pageClassName}
      style={{ ...containerStyle, background: "white", boxShadow: "0 2px 12px rgba(0,0,0,0.08)", borderRadius: 4 }}
      onClick={handlePageClick}
      onMouseMove={handlePageMouseMove}
      onMouseLeave={handlePageMouseLeave}
      onMouseDownCapture={readingAreaSelectionEnabled ? startAreaSelection : undefined}
    >
      <div className="absolute left-0 top-0 origin-top-left" style={renderLayerStyle}>
        {imgSrc ? (
          <img
            ref={imageRef}
            src={imgSrc}
            alt=""
            draggable={false}
            className="pointer-events-none absolute left-0 top-0 block"
            style={pageSize ? { width: pageSize.w, height: pageSize.h } : undefined}
          />
        ) : null}
        <div
          ref={textLayerRef}
          className="pdf-text-layer-host rc-selectable absolute left-0 top-0"
          style={{ zIndex: 1, width: pageSize?.w, height: pageSize?.h }}
        />

        {pageSize
          ? pageNotes.map((note) => {
            const color = HIGHLIGHT_COLORS[note.highlight_color];

            // 形状：整段套一个外框（矩形/圆角/椭圆）。
            if (isShapeStyle(note.style)) {
              const stored = boundingRect(note.highlight_positions ?? []);
              const box = movingShape?.id === note.id ? movingShape.rect : stored;
              if (!box) return null;
              const pad = 3; // 略微外扩，避免框线压住文字
              const shapeStyle: React.CSSProperties = {
                left: box.x * pageSize.w - pad,
                top: box.y * pageSize.h - pad,
                width: box.w * pageSize.w + pad * 2,
                height: box.h * pageSize.h + pad * 2,
                border: `2px solid ${color.border}`,
                borderRadius: SHAPE_BORDER_RADIUS[note.style],
                background: note.fill_color ? HIGHLIGHT_COLORS[note.fill_color].bg : "transparent",
                zIndex: 2,
                cursor: "move",
              };
              return (
                <div
                  key={note.id}
                  className="pdf-highlight-overlay absolute"
                  style={shapeStyle}
                  title={note.content?.trim() ? undefined : "拖拽移动 · 点击编辑"}
                  onMouseEnter={(event) => {
                    showNoteHover(note, event.currentTarget.offsetLeft, event.currentTarget.offsetTop);
                  }}
                  onMouseLeave={scheduleHoverClear}
                  onMouseDown={(event) => startShapeMove(event, note, stored ?? box)}
                />
              );
            }

            if (isTextStyle(note.style)) {
              return null;
            }

            const positions = mergeNormalizedRects(note.highlight_positions ?? []);
            if (positions.length === 0) return null;
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
                  className="pdf-highlight-overlay pdf-text-highlight-overlay absolute"
                  style={style}
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

        {hoveredNote ? (
          <div
            className="pointer-events-none absolute z-10 max-w-xs rounded-lg border px-3 py-2 text-xs leading-5"
            style={{
              left: hoveredNote.x,
              top: hoveredNote.y,
              transform: "translateY(-100%)",
              background: "var(--rc-card-bg)",
              borderColor: "var(--rc-border)",
              color: "var(--rc-text)",
              boxShadow: "var(--rc-card-shadow)",
            }}
          >
            {hoveredNote.note.content}
          </div>
        ) : null}

        {pageSize ? (
          <PdfTextAnnotationLayer
            page={pageNum}
            pageSize={pageSize}
            notes={pageNotes}
            enabled={drawText}
            color={drawColor}
            onCreate={onTextDrawn}
            onUpdate={onTextUpdate}
            onDelete={onTextDelete}
            onColorChange={onTextColorChange}
            onMove={onAnnotationMove}
          />
        ) : null}

        {pageSize && drawShape ? (
          <div
            ref={drawLayerRef}
            className="absolute left-0 top-0"
            style={{ width: pageSize.w, height: pageSize.h, zIndex: 5, cursor: "crosshair" }}
            onMouseDown={startDraw}
          >
            {draftRect ? (
              <div
                className="pointer-events-none absolute"
                style={{
                  left: draftRect.x * pageSize.w,
                  top: draftRect.y * pageSize.h,
                  width: draftRect.w * pageSize.w,
                  height: draftRect.h * pageSize.h,
                  border: `2px solid ${(drawColor ? HIGHLIGHT_COLORS[drawColor] : HIGHLIGHT_COLORS.yellow).border}`,
                  borderRadius: SHAPE_BORDER_RADIUS[drawShape],
                  background: drawFill ? HIGHLIGHT_COLORS[drawFill].bg : "transparent",
                }}
              />
            ) : null}
          </div>
        ) : null}

        {pageSize && areaDraftRect ? (
          <div
            className="pointer-events-none absolute left-0 top-0"
            style={{ width: pageSize.w, height: pageSize.h, zIndex: 6 }}
          >
            <div
              className="absolute rounded-sm border-2"
              style={{
                left: areaDraftRect.x * pageSize.w,
                top: areaDraftRect.y * pageSize.h,
                width: areaDraftRect.w * pageSize.w,
                height: areaDraftRect.h * pageSize.h,
                borderColor: "var(--rc-accent)",
                background: "rgba(0, 122, 255, 0.12)",
                boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.12)",
              }}
            />
          </div>
        ) : null}
      </div>

      {noteTicks.map((tick) => {
        const active = activeNoteId === tick.note.id;
        const visible = active || noteTickVisible[tick.side];
        const tickStyle = noteTickStyle(tick, active);
        // 双页并排时统一贴外侧，否则两页的细线会一起落在页缝里互相压住。
        const edge = spreadEdge ?? tick.side;
        return (
          <button
            key={tick.note.id}
            type="button"
            className="pdf-note-tick absolute z-[4] border-0 bg-transparent p-0"
            style={{
              top: tick.offset * visualScaleRatio,
              left: edge === "left" ? -(tickStyle.width + 2) : undefined,
              right: edge === "right" ? -(tickStyle.width + 2) : undefined,
              width: tickStyle.width,
              height: tickStyle.height,
              background: tickStyle.background,
              opacity: visible ? tickStyle.opacity : 0,
              pointerEvents: visible ? "auto" : "none",
              transform: "translateY(-50%)",
              transition: "opacity 260ms ease, width 160ms ease, height 160ms ease",
              borderRadius: 1,
              cursor: "pointer",
            }}
            title={tick.note.content?.trim() || tick.note.highlight_text?.trim() || `第 ${tick.note.page} 页的笔记`}
            aria-label={`定位到第 ${tick.note.page} 页的笔记`}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onNoteTickClick?.(tick.note);
            }}
          />
        );
      })}

      <div
        className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 text-[10px]"
        style={{ background: "rgba(0,0,0,0.05)", color: "rgba(0,0,0,0.35)", zIndex: 4 }}
      >
        {pageNum}
      </div>
    </div>
  );
});

export default PdfPage;
