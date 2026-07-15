import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { mergeNormalizedRects, type NormalizedRect } from "./readerTypes";

export interface SearchMatch {
  pageNum: number;
  text: string;
  rects: NormalizedRect[];
}

interface TextContentItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
}

function isTextItem(item: unknown): item is TextContentItem {
  const r = item as Record<string, unknown>;
  return typeof r.str === "string" && Array.isArray(r.transform);
}

/**
 * Collect all text positions from a page, returning { str, x, y, w, h }[]
 * using the viewport to convert pdf coordinates to normalized (0..1) rects.
 */
async function getPageTextItems(
  page: Awaited<ReturnType<PDFDocumentProxy["getPage"]>>,
  scale: number,
): Promise<Array<{ str: string; rect: NormalizedRect }>> {
  const viewport = page.getViewport({ scale });
  const content = await page.getTextContent();
  const items: Array<{ str: string; rect: NormalizedRect }> = [];

  for (const raw of content.items) {
    const item = raw as Record<string, unknown>;
    if (!isTextItem(item)) continue;
    const tx = item.transform;
    // tx is [a, b, c, d, e, f] — e=translateX, f=translateY
    const x = tx[4] / viewport.width;
    const y = (tx[5] - item.height) / viewport.height;
    const w = item.width / viewport.width;
    const h = item.height / viewport.height;
    items.push({ str: item.str, rect: { x, y, w, h } });
  }
  return items;
}

export interface UsePdfSearchOptions {
  pdfDoc: PDFDocumentProxy | null;
  scale: number;
  numPages: number;
}

export function usePdfSearch({ pdfDoc, scale, numPages }: UsePdfSearchOptions) {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Cancel any in-flight search
  const cancelSearch = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  // Run search across all pages
  const doSearch = useCallback(
    async (q: string) => {
      cancelSearch();
      if (!q.trim() || !pdfDoc) {
        setMatches([]);
        setActiveIndex(-1);
        setSearching(false);
        return;
      }

      setSearching(true);
      const controller = new AbortController();
      abortRef.current = controller;

      const results: SearchMatch[] = [];
      try {
        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
          if (controller.signal.aborted) break;
          const page = await pdfDoc.getPage(pageNum);
          if (controller.signal.aborted) break;
          const items = await getPageTextItems(page, scale);

          // Build full text for this page and track item positions
          const fullText = items.map((it) => it.str).join("");
          const lowerText = fullText.toLowerCase();
          const qLower = q.toLowerCase();

          let pos = 0;
          while ((pos = lowerText.indexOf(qLower, pos)) !== -1) {
            // Find which items cover this match range
            let charCount = 0;
            const matchItems: typeof items = [];
            for (const item of items) {
              const start = charCount;
              const end = charCount + item.str.length;
              if (start < pos + q.length && end > pos) {
                matchItems.push(item);
              }
              charCount += item.str.length;
            }

            if (matchItems.length > 0) {
              const rects = matchItems.map((it) => it.rect);
              results.push({
                pageNum,
                text: fullText.slice(pos, pos + q.length),
                rects: mergeNormalizedRects(rects),
              });
            }
            pos += 1; // move past current match to find overlapping matches
          }
        }
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
        console.error("[usePdfSearch] search error:", err);
      }

      if (!controller.signal.aborted) {
        setMatches(results);
        setActiveIndex(results.length > 0 ? 0 : -1);
        setSearching(false);
      }
    },
    [pdfDoc, scale, numPages, cancelSearch],
  );

  // Debounced search when query changes
  useEffect(() => {
    if (!query.trim()) {
      setMatches([]);
      setActiveIndex(-1);
      return;
    }
    const timer = setTimeout(() => void doSearch(query), 250);
    return () => clearTimeout(timer);
  }, [query, doSearch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => cancelSearch();
  }, [cancelSearch]);

  const goNext = useCallback(() => {
    setActiveIndex((prev) => (matches.length > 0 ? (prev + 1) % matches.length : -1));
  }, [matches.length]);

  const goPrev = useCallback(() => {
    setActiveIndex((prev) => (matches.length > 0 ? (prev - 1 + matches.length) % matches.length : -1));
  }, [matches.length]);

  const openSearch = useCallback(() => setOpen(true), []);
  const closeSearch = useCallback(() => {
    setOpen(false);
    setQuery("");
    setMatches([]);
    setActiveIndex(-1);
  }, []);

  const activeMatch = activeIndex >= 0 && activeIndex < matches.length ? matches[activeIndex] : null;

  return {
    query,
    setQuery,
    matches,
    activeIndex,
    activeMatch,
    searching,
    open,
    openSearch,
    closeSearch,
    goNext,
    goPrev,
  };
}
