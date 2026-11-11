import { useCallback, useEffect, useRef, type RefObject } from "react";

/** Own navigation to lazy PDF pages; only the latest requested destination may move the viewport. */
export function usePdfNavigation({ containerRef, pageRefs, documentKey, layoutKey, onPageActive }: {
  containerRef: RefObject<HTMLDivElement | null>;
  pageRefs: RefObject<Array<HTMLDivElement | null>>;
  documentKey: object;
  layoutKey: string;
  onPageActive: (page: number) => void;
}) {
  const pending = useRef<MutationObserver | null>(null);
  const cancelPending = useCallback(() => {
    pending.current?.disconnect();
    pending.current = null;
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    container?.addEventListener("wheel", cancelPending, { passive: true });
    container?.addEventListener("pointerdown", cancelPending);
    container?.addEventListener("touchstart", cancelPending, { passive: true });
    return () => {
      cancelPending();
      container?.removeEventListener("wheel", cancelPending);
      container?.removeEventListener("pointerdown", cancelPending);
      container?.removeEventListener("touchstart", cancelPending);
    };
  }, [cancelPending, containerRef, documentKey, layoutKey]);

  const scrollToPage = useCallback((page: number, options?: { smooth?: boolean }) => {
    cancelPending();
    const element = pageRefs.current[page - 1];
    if (!element) return;
    onPageActive(page);
    element.scrollIntoView({ behavior: options?.smooth === false ? "auto" : "smooth", block: "start" });
  }, [cancelPending, onPageActive, pageRefs]);

  const scrollToNote = useCallback((page: number, anchorRatio: number) => {
    cancelPending();
    const container = containerRef.current;
    const element = pageRefs.current[page - 1];
    if (!container || !element) return;
    onPageActive(page);
    const ratio = Number.isFinite(anchorRatio) ? Math.min(1, Math.max(0, anchorRatio)) : 0;
    const reveal = () => {
      const containerRect = container.getBoundingClientRect();
      const pageRect = element.getBoundingClientRect();
      container.scrollTo({
        top: Math.max(0, container.scrollTop + pageRect.top - containerRect.top + pageRect.height * ratio - container.clientHeight / 3),
        behavior: "smooth",
      });
    };
    if (element.dataset.pageReady === "1") {
      reveal();
      return;
    }
    // A render can take longer than a fixed timeout. Wait for real geometry rather than
    // positioning against the 400px placeholder, and disconnect on another navigation.
    const observer = new MutationObserver(() => {
      if (pending.current !== observer || element.dataset.pageReady !== "1") return;
      cancelPending();
      if (container.contains(element)) reveal();
    });
    pending.current = observer;
    observer.observe(element, { attributes: true, attributeFilter: ["data-page-ready"] });
    element.scrollIntoView({ behavior: "auto", block: "center" });
  }, [cancelPending, containerRef, onPageActive, pageRefs]);

  return { scrollToPage, scrollToNote };
}
