import { useEffect, useRef, useState, type MutableRefObject } from "react";
import * as pdfjsLib from "pdfjs-dist";

interface UseWritingPdfDocumentOptions {
  pdfPath: string | null;
  renderedPagesRef: MutableRefObject<Set<number>>;
  cancelRenderTasks: () => void;
}

export function useWritingPdfDocument({
  pdfPath,
  renderedPagesRef,
  cancelRenderTasks,
}: UseWritingPdfDocumentOptions) {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState(false);
  const activeDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const docGenerationRef = useRef(0);

  useEffect(() => {
    if (!pdfPath) {
      docGenerationRef.current += 1;
      cancelRenderTasks();
      renderedPagesRef.current.clear();
      const stale = activeDocRef.current;
      activeDocRef.current = null;
      setPdfDoc(null);
      setNumPages(0);
      setPdfLoading(false);
      setPdfError(false);
      if (stale) void stale.destroy();
      return;
    }

    let disposed = false;
    docGenerationRef.current += 1;

    void (async () => {
      setPdfLoading(true);
      setPdfError(false);
      try {
        const { readFile } = await import("@tauri-apps/plugin-fs");
        const bytes = await readFile(pdfPath);
        if (disposed) return;
        const doc = await pdfjsLib.getDocument({ data: bytes }).promise;
        if (disposed) {
          void doc.destroy();
          return;
        }
        cancelRenderTasks();
        renderedPagesRef.current.clear();
        const prev = activeDocRef.current;
        activeDocRef.current = doc;
        setPdfDoc(doc);
        setNumPages(doc.numPages);
        if (prev && prev !== doc) void prev.destroy();
      } catch {
        if (!disposed) setPdfError(true);
      } finally {
        if (!disposed) setPdfLoading(false);
      }
    })();

    return () => {
      disposed = true;
    };
  }, [cancelRenderTasks, pdfPath, renderedPagesRef]);

  useEffect(() => () => {
    docGenerationRef.current += 1;
    cancelRenderTasks();
    const doc = activeDocRef.current;
    activeDocRef.current = null;
    if (doc) void doc.destroy();
  }, [cancelRenderTasks]);

  return { pdfDoc, numPages, pdfLoading, pdfError, docGenerationRef };
}
