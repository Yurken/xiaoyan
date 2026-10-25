import { useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { WritingCompileSummary } from "./shared";
import { useWritingPdfDocument } from "./useWritingPdfDocument";
import { useWritingPdfPages } from "./useWritingPdfPages";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 3;
const ZOOM_STEP = 0.1;
/** PDF.js 内部渲染缩放；视觉缩放走 CSS zoom，避免每次缩放整篇重绘。 */
const RENDER_SCALE = 1.5;
/** 懒渲染预载边距：可视区域上下各扩一屏，优先渲染可视页与相邻页。 */
const LAZY_ROOT_MARGIN = "100% 0px";

export interface UseWritingPdfPreviewOptions {
  compileResult: WritingCompileSummary | null;
  draftId: string;
  onSave?: () => void;
}

/**
 * 论文 PDF 阅读器逻辑：文档加载与销毁、懒渲染、缩放、拖拽、全屏与保存。
 * 组件只负责工具栏和画布布局，副作用全部收敛在这里。
 */
export function useWritingPdfPreview({ compileResult, draftId, onSave }: UseWritingPdfPreviewOptions) {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isHovered, setHovered] = useState(false);
  const [isFocused, setFocused] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef(new Map<number, HTMLCanvasElement>());
  const renderTasksRef = useRef(new Map<number, pdfjsLib.RenderTask>());
  const renderedPagesRef = useRef(new Set<number>());
  const dragRef = useRef({ startX: 0, startY: 0, scrollX: 0, scrollY: 0 });
  const prevZoomRef = useRef(1);
  const prevDraftRef = useRef(draftId);
  const autoFitDraftRef = useRef<string | null>(null);
  const lastSuccessRef = useRef<{ draftId: string; path: string } | null>(null);

  const clampZoom = useCallback((value: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value)), []);

  // 阅读器只呈现“最后一次成功”的 PDF；失败结果由工作区另一侧处理，不在这里覆盖当前内容。
  useEffect(() => {
    if (compileResult?.success && compileResult.pdfPath) {
      lastSuccessRef.current = { draftId, path: compileResult.pdfPath };
    }
  }, [compileResult, draftId]);

  const pdfPath =
    compileResult?.success && compileResult.pdfPath
      ? compileResult.pdfPath
      : lastSuccessRef.current && lastSuccessRef.current.draftId === draftId
        ? lastSuccessRef.current.path
        : null;

  // 仅切换草稿时重置缩放与滚动位置；同草稿的新 PDF 保留阅读进度。
  useEffect(() => {
    if (prevDraftRef.current === draftId) return;
    prevDraftRef.current = draftId;
    autoFitDraftRef.current = null;
    setZoomLevel(1);
    prevZoomRef.current = 1;
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = 0;
      el.scrollLeft = 0;
    }
  }, [draftId]);

  const cancelRenderTasks = useCallback(() => {
    renderTasksRef.current.forEach((task) => {
      try {
        task.cancel();
      } catch {
        // 已结束的任务取消会抛错，忽略。
      }
    });
    renderTasksRef.current.clear();
  }, []);

  const { pdfDoc, numPages, pdfLoading, pdfError, docGenerationRef } = useWritingPdfDocument({
    pdfPath,
    renderedPagesRef,
    cancelRenderTasks,
  });

  // 每个草稿只做一次自适应缩放；同草稿重新编译后沿用用户调整过的缩放。
  useEffect(() => {
    if (!pdfDoc || numPages === 0) return;
    if (autoFitDraftRef.current === draftId) return;
    let cancelled = false;
    pdfDoc
      .getPage(1)
      .then((page) => {
        if (cancelled) return;
        const viewport = page.getViewport({ scale: RENDER_SCALE });
        const el = scrollRef.current;
        const cw = el?.clientWidth ?? 0;
        const ch = el?.clientHeight ?? 0;
        let next = 1;
        if (cw > 0 && ch > 0) next = Math.max(cw / viewport.width, ch / viewport.height);
        else if (cw > 0) next = cw / viewport.width;
        autoFitDraftRef.current = draftId;
        setZoomLevel(clampZoom(next));
      })
      .catch(() => {
        // 取页失败时保持默认缩放。
      });
    return () => {
      cancelled = true;
    };
  }, [pdfDoc, numPages, draftId, clampZoom]);

  useWritingPdfPages({
    pdfDoc,
    numPages,
    docGenerationRef,
    scrollRef,
    canvasRefs,
    renderTasksRef,
    renderedPagesRef,
    rootMargin: LAZY_ROOT_MARGIN,
  });

  // 缩放时按倍率跟随滚动位置，避免视口跳动。
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || prevZoomRef.current === zoomLevel) {
      prevZoomRef.current = zoomLevel;
      return;
    }
    const ratio = zoomLevel / prevZoomRef.current;
    el.scrollTop = Math.round(el.scrollTop * ratio);
    prevZoomRef.current = zoomLevel;
  }, [zoomLevel]);

  const zoomIn = useCallback(() => setZoomLevel((prev) => clampZoom(prev + ZOOM_STEP)), [clampZoom]);
  const zoomOut = useCallback(() => setZoomLevel((prev) => clampZoom(prev - ZOOM_STEP)), [clampZoom]);
  const resetZoom = useCallback(() => setZoomLevel(1), []);

  // 缩放快捷键只在预览区域悬停或聚焦时生效，避免抢走正文编辑的 cmd/ctrl +/-。
  const shortcutsActive = isHovered || isFocused;
  useEffect(() => {
    if (!shortcutsActive) return;
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
  }, [shortcutsActive, clampZoom]);

  useEffect(() => {
    if (!isFullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isFullscreen]);

  const handleMouseDown = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      scrollX: scrollRef.current?.scrollLeft ?? 0,
      scrollY: scrollRef.current?.scrollTop ?? 0,
    };
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      const el = scrollRef.current;
      if (!el) return;
      el.scrollLeft = dragRef.current.scrollX + (dragRef.current.startX - e.clientX);
      el.scrollTop = dragRef.current.scrollY + (dragRef.current.startY - e.clientY);
    };
    const handleMouseUp = () => setIsDragging(false);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoomLevel((prev) => clampZoom(prev - Math.sign(e.deltaY) * ZOOM_STEP));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [pdfDoc, clampZoom]);

  // 保存：宿主注入 onSave 时完全交给他，否则保留原「另存为」实现。
  const handleSave = useCallback(async () => {
    if (onSave) {
      onSave();
      return;
    }
    if (!pdfPath) return;
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const { writeFile, readFile } = await import("@tauri-apps/plugin-fs");
      const target = await save({
        filters: [{ name: "PDF", extensions: ["pdf"] }],
        defaultPath: "paper.pdf",
      });
      if (!target) return;
      const bytes = await readFile(pdfPath);
      await writeFile(target, bytes);
    } catch {
      // 用户取消或写入失败时静默。
    }
  }, [onSave, pdfPath]);

  const registerCanvas = useCallback((pageNum: number) => {
    return (el: HTMLCanvasElement | null) => {
      if (el) canvasRefs.current.set(pageNum, el);
      else canvasRefs.current.delete(pageNum);
    };
  }, []);

  return {
    pdfPath,
    pdfDoc,
    numPages,
    pdfLoading,
    pdfError,
    zoomLevel,
    zoomIn,
    zoomOut,
    resetZoom,
    isDragging,
    handleMouseDown,
    isFullscreen,
    setIsFullscreen,
    isHovered,
    setHovered,
    isFocused,
    setFocused,
    scrollRef,
    registerCanvas,
    handleSave,
  };
}
