import { useEffect, useRef, type RefObject } from "react";

interface UsePdfViewportProgressOptions {
  containerRef: RefObject<HTMLDivElement | null>;
  pageRefs: RefObject<Array<HTMLDivElement | null>>;
  numPages: number;
  initialPage?: number;
  onProgressChange?: (progress: { page: number; totalPages: number; percent: number }) => void;
}

/** 监听 PDF 滚动位置，恢复断点并用视口中心页计算阅读进度。 */
export function usePdfViewportProgress({
  containerRef,
  pageRefs,
  numPages,
  initialPage = 1,
  onProgressChange,
}: UsePdfViewportProgressOptions) {
  const restoredRef = useRef(false);
  const frameRef = useRef(0);

  useEffect(() => {
    if (numPages === 0) restoredRef.current = false;
  }, [numPages]);

  useEffect(() => {
    if (restoredRef.current || numPages === 0) return;
    const frame = requestAnimationFrame(() => {
      const page = Math.min(numPages, Math.max(1, initialPage));
      pageRefs.current[page - 1]?.scrollIntoView({ block: "start" });
      restoredRef.current = true;
    });
    return () => cancelAnimationFrame(frame);
  }, [initialPage, numPages, pageRefs]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || numPages === 0 || !onProgressChange) return;

    const measure = () => {
      frameRef.current = 0;
      const containerRect = container.getBoundingClientRect();
      const center = containerRect.top + container.clientHeight * 0.42;
      let nearestPage = 1;
      let nearestDistance = Number.POSITIVE_INFINITY;
      pageRefs.current.forEach((page, index) => {
        if (!page) return;
        const rect = page.getBoundingClientRect();
        const distance = Math.abs(rect.top + Math.min(rect.height / 2, container.clientHeight * 0.35) - center);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestPage = index + 1;
        }
      });
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
    container.addEventListener("scroll", onScroll, { passive: true });
    const initialFrame = requestAnimationFrame(measure);
    return () => {
      container.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(initialFrame);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [containerRef, numPages, onProgressChange, pageRefs]);
}
