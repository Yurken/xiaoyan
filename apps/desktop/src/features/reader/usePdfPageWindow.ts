import { useEffect, useState, type RefObject } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { retainPdfPages } from "./pdfRenderingShared";

export function usePdfPageWindow(
  pdfDoc: PDFDocumentProxy,
  containerRef: RefObject<HTMLDivElement | null>,
  pageRefs: RefObject<Array<HTMLDivElement | null>>,
  initialPage = 1,
) {
  const [window, setWindow] = useState(() => {
    const pages = new Set([Math.min(pdfDoc.numPages, Math.max(1, initialPage))]);
    return { document: pdfDoc, activePages: pages, retainedPages: pages };
  });
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const active = new Set<number>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const page = Number((entry.target as HTMLElement).dataset.pageNum);
        if (!page) continue;
        if (entry.isIntersecting) active.add(page);
        else active.delete(page);
      }
      setWindow((previous) => ({
        document: pdfDoc,
        activePages: new Set(active),
        retainedPages: retainPdfPages(active, previous.document === pdfDoc ? previous.retainedPages : new Set()),
      }));
    }, { root: container, rootMargin: "600px 0px" });
    pageRefs.current.forEach((page) => { if (page) observer.observe(page); });
    return () => observer.disconnect();
  }, [pdfDoc, containerRef, pageRefs]);

  if (window.document === pdfDoc) return window;
  const pages = new Set([Math.min(pdfDoc.numPages, Math.max(1, initialPage))]);
  return { activePages: pages, retainedPages: pages };
}
