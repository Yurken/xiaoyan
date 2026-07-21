import { useEffect, useMemo, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  deriveOutlineFromPages,
  searchReaderPages,
  supplementSparseOutline,
  type ReaderOutlineEntry,
  type ReaderPageContent,
  type ReaderPageLine,
} from "./readerNavigation";

const THUMBNAIL_PIXEL_WIDTH = 640;
const NAVIGATION_BATCH_SIZE = 4;

function textLines(items: unknown[]) {
  const lines: ReaderPageLine[] = [];
  let current = "";
  let currentFontSize = 0;
  for (const item of items as Array<{ str?: string; hasEOL?: boolean; height?: number; transform?: number[] }>) {
    const value = item.str ?? "";
    current += `${current && value ? " " : ""}${value}`;
    currentFontSize = Math.max(currentFontSize, Math.abs(item.transform?.[3] ?? item.height ?? 0));
    if (item.hasEOL) {
      if (current.trim()) lines.push({ text: current.trim(), fontSize: currentFontSize });
      current = "";
      currentFontSize = 0;
    }
  }
  if (current.trim()) lines.push({ text: current.trim(), fontSize: currentFontSize });
  return lines;
}

async function outlinePage(doc: PDFDocumentProxy, dest: unknown) {
  try {
    const explicit = typeof dest === "string" ? await doc.getDestination(dest) : dest;
    const ref = Array.isArray(explicit) ? explicit[0] : null;
    if (!ref) return 1;
    return (await doc.getPageIndex(ref)) + 1;
  } catch {
    return 1;
  }
}

async function flattenOutline(
  doc: PDFDocumentProxy,
  items: Awaited<ReturnType<PDFDocumentProxy["getOutline"]>>,
  depth = 0,
  path = "root",
): Promise<ReaderOutlineEntry[]> {
  if (!items) return [];
  const result: ReaderOutlineEntry[] = [];
  for (const [index, item] of items.entries()) {
    const itemPath = `${path}-${index}`;
    result.push({
      id: `outline-${itemPath}`,
      title: item.title?.trim() || "未命名章节",
      page: await outlinePage(doc, item.dest),
      depth,
    });
    result.push(...await flattenOutline(doc, item.items, depth + 1, itemPath));
  }
  return result;
}

export function useReaderDocumentNavigation(document: PDFDocumentProxy | null, query: string) {
  const [outline, setOutline] = useState<ReaderOutlineEntry[]>([]);
  const [pages, setPages] = useState<ReaderPageContent[]>([]);
  const [thumbnails, setThumbnails] = useState<Record<number, string>>({});
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!document) {
      setOutline([]);
      setPages([]);
      setThumbnails({});
      setNumPages(0);
      setLoading(false);
      setError("");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    setOutline([]);
    setPages([]);
    setThumbnails({});

    void (async () => {
      try {
        setNumPages(document.numPages);
        const nativeOutline = await document.getOutline();
        const resolvedOutline = await flattenOutline(document, nativeOutline);
        if (resolvedOutline.length > 0) setOutline(resolvedOutline);
        const pageContents: ReaderPageContent[] = [];
        let thumbnailBatch: Record<number, string> = {};

        const flushBatch = () => {
          if (cancelled) return;
          setPages([...pageContents]);
          if (Object.keys(thumbnailBatch).length > 0) {
            const readyThumbnails = thumbnailBatch;
            thumbnailBatch = {};
            setThumbnails((current) => ({ ...current, ...readyThumbnails }));
          }
        };

        for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
          if (cancelled) return;
          const page = await document.getPage(pageNumber);
          const content = await page.getTextContent();
          const lineDetails = textLines(content.items);
          const lines = lineDetails.map((line) => line.text);
          pageContents.push({ page: pageNumber, lines, lineDetails, text: lines.join("\n") });

          const baseViewport = page.getViewport({ scale: 1 });
          const scale = THUMBNAIL_PIXEL_WIDTH / Math.max(1, baseViewport.width);
          const viewport = page.getViewport({ scale });
          const canvas = globalThis.document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(viewport.width));
          canvas.height = Math.max(1, Math.round(viewport.height));
          const context = canvas.getContext("2d", { alpha: false });
          if (context) {
            await page.render({ canvas, canvasContext: context, viewport, background: "white" }).promise;
            if (!cancelled) thumbnailBatch[pageNumber] = canvas.toDataURL("image/webp", 0.9);
          }
          if (pageNumber % NAVIGATION_BATCH_SIZE === 0 || pageNumber === document.numPages) flushBatch();
        }
        if (!cancelled) {
          const derivedOutline = deriveOutlineFromPages(pageContents);
          setOutline(supplementSparseOutline(resolvedOutline, derivedOutline));
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "无法读取 PDF 导航信息。");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [document]);

  const searchResults = useMemo(() => searchReaderPages(pages, query), [pages, query]);
  return { outline, pages, thumbnails, numPages, loading, error, searchResults };
}
