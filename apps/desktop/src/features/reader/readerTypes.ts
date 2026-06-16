/** PDF 阅读器 / 批注类型定义（桌面端） */

export type HighlightColor = "yellow" | "green" | "blue" | "pink" | "purple";
export type AnnotationStyle = "highlight" | "underline" | "strike";

export const HIGHLIGHT_COLORS: Record<
  HighlightColor,
  { bg: string; border: string; label: string }
> = {
  yellow: { bg: "rgba(253, 224, 71, 0.40)", border: "rgba(202, 138, 4, 0.9)", label: "黄色" },
  green: { bg: "rgba(74, 222, 128, 0.34)", border: "rgba(22, 163, 74, 0.9)", label: "绿色" },
  blue: { bg: "rgba(96, 165, 250, 0.34)", border: "rgba(37, 99, 235, 0.9)", label: "蓝色" },
  pink: { bg: "rgba(244, 114, 182, 0.34)", border: "rgba(219, 39, 119, 0.9)", label: "粉色" },
  purple: { bg: "rgba(167, 139, 250, 0.34)", border: "rgba(124, 58, 237, 0.9)", label: "紫色" },
};

/** 归一化坐标（相对页面宽高的 0..1 比例），与缩放无关 */
export interface NormalizedRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ReaderSelection {
  text: string;
  page: number;
  positions: NormalizedRect[];
  popupX: number;
  popupY: number;
}

export interface PaperNote {
  id: string;
  paper_id: string;
  page: number;
  content: string;
  highlight_text?: string | null;
  highlight_color: HighlightColor;
  highlight_positions?: NormalizedRect[] | null;
  style: AnnotationStyle;
  created_at: string;
  updated_at: string;
}

const VALID_COLORS = new Set<string>(["yellow", "green", "blue", "pink", "purple"]);

/** 把后端返回的原始记录规整成 PaperNote */
export function normalizePaperNote(raw: unknown): PaperNote | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.paper_id !== "string") return null;

  const color = typeof record.highlight_color === "string" && VALID_COLORS.has(record.highlight_color)
    ? (record.highlight_color as HighlightColor)
    : "yellow";
  const style: AnnotationStyle =
    record.style === "underline" ? "underline" : record.style === "strike" ? "strike" : "highlight";
  const positions = Array.isArray(record.highlight_positions)
    ? (record.highlight_positions as NormalizedRect[]).filter(
        (rect) =>
          rect &&
          typeof rect.x === "number" &&
          typeof rect.y === "number" &&
          typeof rect.w === "number" &&
          typeof rect.h === "number",
      )
    : null;

  return {
    id: record.id,
    paper_id: record.paper_id,
    page: typeof record.page === "number" ? record.page : Number(record.page) || 1,
    content: typeof record.content === "string" ? record.content : "",
    highlight_text: typeof record.highlight_text === "string" ? record.highlight_text : null,
    highlight_color: color,
    highlight_positions: positions,
    style,
    created_at: typeof record.created_at === "string" ? record.created_at : "",
    updated_at: typeof record.updated_at === "string" ? record.updated_at : "",
  };
}
