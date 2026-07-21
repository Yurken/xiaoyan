import { useEffect, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

/** 将 PDF 字节解析为阅读器各功能共享的单一文档实例。 */
export function useReaderPdfDocument(data: Uint8Array | null) {
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!data) {
      setPdfDoc(null);
      setLoading(false);
      setError("");
      return;
    }

    let cancelled = false;
    let document: PDFDocumentProxy | null = null;
    const loadingTask = pdfjsLib.getDocument({ data: data.slice(0) });
    setPdfDoc(null);
    setLoading(true);
    setError("");

    void loadingTask.promise
      .then((nextDocument) => {
        document = nextDocument;
        if (cancelled) {
          void nextDocument.destroy();
          return;
        }
        setPdfDoc(nextDocument);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "PDF 加载失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (document) void document.destroy();
      else void loadingTask.destroy();
    };
  }, [data]);

  return { pdfDoc, loading, error };
}
