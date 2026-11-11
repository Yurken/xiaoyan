import { useCallback, useEffect, useRef, type RefObject } from "react";
import { resolveViewportPage } from "./pageLayout";

interface UsePdfViewportProgressOptions {
  containerRef: RefObject<HTMLDivElement | null>;
  pageRefs: RefObject<Array<HTMLDivElement | null>>;
  numPages: number;
  documentKey?: object;
  initialPage?: number;
  onProgressChange?: (progress: { page: number; totalPages: number; percent: number }) => void;
}

/** 监听 PDF 滚动位置，恢复断点并用视口中心页计算阅读进度。 */
export function usePdfViewportProgress({
  containerRef,
  pageRefs,
  numPages,
  documentKey,
  initialPage = 1,
  onProgressChange,
}: UsePdfViewportProgressOptions) {
  const restoredRef = useRef(false);
  const frameRef = useRef(0);
  const preferredPageRef = useRef(initialPage);
  const initialPageRef = useRef(initialPage);
  initialPageRef.current = initialPage;
  const scheduleMeasureRef = useRef<(() => void) | null>(null);
  const markPageActive = useCallback((page: number) => {
    preferredPageRef.current = Math.min(numPages, Math.max(1, page));
    scheduleMeasureRef.current?.();
  }, [numPages]);

  useEffect(() => {
    restoredRef.current = false;
    preferredPageRef.current = initialPageRef.current;
  }, [documentKey, numPages]);

  useEffect(() => {
    if (restoredRef.current || numPages === 0) return;
    const frame = requestAnimationFrame(() => {
      const page = Math.min(numPages, Math.max(1, initialPage));
      pageRefs.current[page - 1]?.scrollIntoView({ block: "start" });
      restoredRef.current = true;
    });
    return () => cancelAnimationFrame(frame);
  }, [documentKey, initialPage, numPages, pageRefs]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || numPages === 0 || !onProgressChange) return;

    const measure = () => {
      frameRef.current = 0;
      const containerRect = container.getBoundingClientRect();
      const pages = pageRefs.current.flatMap((page, index) => {
        if (!page) return [];
        const rect = page.getBoundingClientRect();
        return [{ page: index + 1, top: rect.top, height: rect.height }];
      });
      const nearestPage = resolveViewportPage(pages, containerRect.top, container.clientHeight, preferredPageRef.current);
      const scrollPercent = container.scrollHeight <= container.clientHeight
        ? 100
        : ((container.scrollTop + container.clientHeight) / container.scrollHeight) * 100;
      onProgressChange({
        page: nearestPage,
        totalPages: numPages,
        percent: Math.min(100, Math.max((nearestPage / numPages) * 100, scrollPercent)),
      });
    };
    const onScroll = () => {
      if (!frameRef.current) frameRef.current = requestAnimationFrame(measure);
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-page-num]") : null;
      const page = Number(target?.dataset.pageNum);
      if (page > 0) markPageActive(page);
    };
    scheduleMeasureRef.current = onScroll;
    container.addEventListener("scroll", onScroll, { passive: true });
    container.addEventListener("pointerdown", onPointerDown);
    const initialFrame = requestAnimationFrame(measure);
    return () => {
      scheduleMeasureRef.current = null;
      container.removeEventListener("scroll", onScroll);
      container.removeEventListener("pointerdown", onPointerDown);
      cancelAnimationFrame(initialFrame);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [containerRef, documentKey, markPageActive, numPages, onProgressChange, pageRefs]);

  return { markPageActive };
}
