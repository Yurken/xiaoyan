import { useCallback, useEffect, type MutableRefObject, type RefObject } from "react";
import type * as pdfjsLib from "pdfjs-dist";

const RENDER_SCALE = 1.5;

interface UseWritingPdfPagesOptions {
  pdfDoc: pdfjsLib.PDFDocumentProxy | null;
  numPages: number;
  docGenerationRef: MutableRefObject<number>;
  scrollRef: RefObject<HTMLDivElement | null>;
  canvasRefs: MutableRefObject<Map<number, HTMLCanvasElement>>;
  renderTasksRef: MutableRefObject<Map<number, pdfjsLib.RenderTask>>;
  renderedPagesRef: MutableRefObject<Set<number>>;
  rootMargin: string;
}

export function useWritingPdfPages({
  pdfDoc,
  numPages,
  docGenerationRef,
  scrollRef,
  canvasRefs,
  renderTasksRef,
  renderedPagesRef,
  rootMargin,
}: UseWritingPdfPagesOptions) {
  const renderPage = useCallback(async (pageNum: number, doc: pdfjsLib.PDFDocumentProxy, generation: number) => {
    const canvas = canvasRefs.current.get(pageNum);
    if (!canvas) return;
    const existing = renderTasksRef.current.get(pageNum);
    if (existing) {
      try {
        existing.cancel();
      } catch {
        // 已结束任务的取消错误可以忽略。
      }
    }
    let task: pdfjsLib.RenderTask | null = null;
    try {
      const page = await doc.getPage(pageNum);
      if (docGenerationRef.current !== generation) return;
      renderedPagesRef.current.add(pageNum);
      const viewport = page.getViewport({ scale: RENDER_SCALE });
      const pixelRatio = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * pixelRatio);
      canvas.height = Math.floor(viewport.height * pixelRatio);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      task = page.render({ canvas, canvasContext: ctx, viewport });
      renderTasksRef.current.set(pageNum, task);
      await task.promise;
    } catch {
      // 文档替换或组件卸载时保留当前可用位图。
    } finally {
      if (task && renderTasksRef.current.get(pageNum) === task) {
        renderTasksRef.current.delete(pageNum);
      }
    }
  }, [canvasRefs, docGenerationRef, renderTasksRef, renderedPagesRef]);

  useEffect(() => {
    if (!pdfDoc || numPages === 0) return;
    const generation = docGenerationRef.current;
    const doc = pdfDoc;

    if (typeof IntersectionObserver === "undefined") {
      for (let i = 1; i <= numPages; i++) {
        if (!renderedPagesRef.current.has(i)) void renderPage(i, doc, generation);
      }
      return;
    }

    const pageByElement = new Map<Element, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const pageNum = pageByElement.get(entry.target);
          if (!pageNum || renderedPagesRef.current.has(pageNum)) continue;
          observer.unobserve(entry.target);
          void renderPage(pageNum, doc, generation);
        }
      },
      { root: scrollRef.current, rootMargin },
    );

    canvasRefs.current.forEach((canvas, pageNum) => {
      if (renderedPagesRef.current.has(pageNum)) return;
      pageByElement.set(canvas, pageNum);
      observer.observe(canvas);
    });

    return () => observer.disconnect();
  }, [canvasRefs, docGenerationRef, numPages, pdfDoc, renderPage, renderedPagesRef, rootMargin, scrollRef]);
}
