/** 阅读区的页面排布：单页（逐页纵向排列）或双页（两页并排，适合对读图表/双栏排版）。 */
export type ReaderPageLayout = "single" | "spread";

export interface ReaderPageSize { width: number; height: number }

/** 双页模式下两页之间的间距（px），与行容器的 gap-4 保持一致。 */
export const SPREAD_GAP = 16;

/**
 * 按布局把页码分行。
 * - single：每页一行；
 * - spread：第一页单独占一行（论文首页是标题/摘要页，和正文并排会把两页都挤小），
 *   其后按 2-3、4-5… 两页一行；余下一页时末页单独显示。
 */
export function groupPageRows(
  numPages: number,
  layout: ReaderPageLayout,
  coverAlone = true,
): number[][] {
  if (!Number.isFinite(numPages) || numPages <= 0) return [];
  const total = Math.floor(numPages);
  const rows: number[][] = [];

  if (layout === "single") {
    for (let page = 1; page <= total; page += 1) rows.push([page]);
    return rows;
  }

  let page = 1;
  if (coverAlone) {
    rows.push([1]);
    page = 2;
  }
  while (page <= total) {
    const row = page + 1 <= total ? [page, page + 1] : [page];
    rows.push(row);
    page += 2;
  }
  return rows;
}

export interface SpreadFitInput {
  /** 滚动容器的 clientWidth（已扣掉滚动条，仍包含左右内边距）。 */
  containerWidth: number;
  /** 容器左右内边距之和（px）。 */
  horizontalPadding: number;
  /** 单页在 100% 比例下的宽度（px）。 */
  pageWidth: number;
  /** 另一页的真实宽度；省略时按两页等宽估计。 */
  secondPageWidth?: number;
  /** 当前缩放比例。 */
  scale: number;
  gap?: number;
}

/**
 * 双页并排时两页会占掉一倍宽度，超出阅读区就再也看不见另一页。
 * 这里算一个 0..1 的收敛系数，把页面压到「刚好放得下」；
 * 容器还没量出宽度、或本来就放得下时返回 1（不干预用户缩放）。
 *
 * 注意系数作用在视觉缩放上而不是 PDF 渲染比例：只要不超过 1，
 * 就是把已渲染的位图缩小显示，不会变糊。
 */
export function resolveSpreadFit({
  containerWidth,
  horizontalPadding,
  pageWidth,
  secondPageWidth = pageWidth,
  scale,
  gap = SPREAD_GAP,
}: SpreadFitInput): number {
  if (!(containerWidth > 0) || !(pageWidth > 0) || !(scale > 0)) return 1;
  const available = containerWidth - horizontalPadding;
  const pagesNeeded = (pageWidth + secondPageWidth) * scale;
  if (available <= 0 || pagesNeeded <= 0) return 1;
  if (pagesNeeded + gap <= available) return 1;
  // 页间固定间距不参与缩放，先扣掉再分摊到两页上。
  return Math.max(Number.EPSILON, (available - gap) / pagesNeeded);
}

/** In a spread, explicit navigation or a click identifies which of two equally placed pages is active. */
export function resolveViewportPage(
  pages: Array<{ page: number; top: number; height: number }>,
  viewportTop: number,
  viewportHeight: number,
  preferredPage: number,
): number {
  const center = viewportTop + viewportHeight * 0.42;
  let nearest: (typeof pages)[number] | undefined;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const page of pages) {
    const distance = Math.abs(page.top + Math.min(page.height / 2, viewportHeight * 0.35) - center);
    if (distance < nearestDistance) {
      nearest = page;
      nearestDistance = distance;
    }
  }
  if (!nearest) return 1;
  const preferred = pages.find((page) => page.page === preferredPage);
  return preferred && Math.abs(preferred.top - nearest.top) < 1 ? preferred.page : nearest.page;
}
