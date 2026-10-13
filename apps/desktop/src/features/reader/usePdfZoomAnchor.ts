import { useLayoutEffect, useRef, type RefObject } from "react";

interface Anchor {
  page: HTMLElement;
  x: number;
  y: number;
  viewportX: number;
  viewportY: number;
}

/** Keep the PDF point under the cursor (or viewport centre for toolbar zoom) stationary. */
export function usePdfZoomAnchor({ containerRef, pageRefs, scale, documentKey, onZoom }: {
  containerRef: RefObject<HTMLDivElement | null>;
  pageRefs: RefObject<(HTMLDivElement | null)[]>;
  scale: number;
  documentKey: object;
  onZoom: (factor: number) => void;
}) {
  const anchor = useRef<Anchor | null>(null);
  const previousScale = useRef(scale);
  const zoom = useRef(onZoom);
  zoom.current = onZoom;

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    anchor.current = null;
    const capture = (clientX?: number, clientY?: number) => {
      const bounds = container.getBoundingClientRect();
      const x = clientX ?? bounds.left + container.clientWidth / 2;
      const y = clientY ?? bounds.top + container.clientHeight / 2;
      // Pages are ordered vertically. Find the nearest page without measuring every page.
      const pages = pageRefs.current;
      let low = 0, high = pages.length - 1;
      let page: HTMLElement | null = null;
      while (low <= high) {
        const mid = (low + high) >>> 1;
        const candidate = pages[mid];
        if (!candidate) break;
        page = candidate;
        const rect = candidate.getBoundingClientRect();
        if (y < rect.top) high = mid - 1;
        else if (y > rect.bottom) low = mid + 1;
        else break;
      }
      if (!page) return;
      const rect = page.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      anchor.current = { page, x: (x - rect.left) / rect.width, y: (y - rect.top) / rect.height,
        viewportX: x - bounds.left, viewportY: y - bounds.top };
    };
    const onScroll = () => capture();
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      capture(event.clientX, event.clientY);
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? container.clientHeight : 1;
      zoom.current(Math.exp(-event.deltaY * unit * 0.0015));
    };
    capture();
    container.addEventListener("scroll", onScroll, { passive: true });
    container.addEventListener("wheel", onWheel, { passive: false });
    // Refresh the centre after initial page sizing or a panel resize.
    const observer = new ResizeObserver(() => capture());
    observer.observe(container);
    return () => {
      observer.disconnect();
      container.removeEventListener("scroll", onScroll);
      container.removeEventListener("wheel", onWheel);
      anchor.current = null;
    };
  }, [containerRef, pageRefs, documentKey]);

  useLayoutEffect(() => {
    const changed = previousScale.current !== scale;
    previousScale.current = scale;
    const point = anchor.current;
    const container = containerRef.current;
    if (!changed || !container || !point || !container.contains(point.page)) return;
    const bounds = container.getBoundingClientRect();
    const rect = point.page.getBoundingClientRect();
    container.scrollLeft += rect.left + point.x * rect.width - bounds.left - point.viewportX;
    container.scrollTop += rect.top + point.y * rect.height - bounds.top - point.viewportY;
  }, [scale, containerRef]);
}
