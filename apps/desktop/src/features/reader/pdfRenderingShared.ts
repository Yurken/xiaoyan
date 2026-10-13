export interface PdfLink {
  left: number;
  top: number;
  width: number;
  height: number;
  url?: string;
  dest?: unknown;
}

export const MAX_RETAINED_PDF_PAGES = 8;
export const MAX_CANVAS_SIDE = 4096;
export const MAX_CANVAS_PIXELS = 12_000_000;

export function resolveCanvasOutputScale(viewport: { width: number; height: number }, devicePixelRatio: number) {
  const preferred = Math.min(2, Math.max(2, devicePixelRatio || 1));
  // Large PDF page sizes must be allowed below 1x to respect allocation limits.
  return Math.min(preferred, MAX_CANVAS_SIDE / Math.max(1, viewport.width),
    MAX_CANVAS_SIDE / Math.max(1, viewport.height),
    Math.sqrt(MAX_CANVAS_PIXELS / Math.max(1, viewport.width * viewport.height)));
}

export function retainPdfPages(active: Set<number>, previous: Set<number>) {
  const retained = new Set(active);
  for (const page of [...previous].reverse()) {
    if (retained.size >= MAX_RETAINED_PDF_PAGES) break;
    retained.add(page);
  }
  // Active pages are pinned even if an unusually large viewport exceeds the cache size.
  return new Set([...retained].filter((page) => !active.has(page)).reverse().concat([...active]));
}
