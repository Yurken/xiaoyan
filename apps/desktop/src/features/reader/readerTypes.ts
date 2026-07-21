/** PDF 阅读器 / 批注类型定义（桌面端） */

export type HighlightColor = "yellow" | "green" | "blue" | "pink" | "purple";
/** 行内样式（逐行渲染）：高亮/下划线/删除线。 */
export type LineStyle = "highlight" | "underline" | "strike";
/** 形状框选样式（整段外接一个形状）：矩形/圆角矩形/椭圆。 */
export type ShapeStyle = "rect" | "rounded" | "ellipse";
/** 自由文本批注（点击页面任意位置后输入文字）。 */
export type TextStyle = "text";
export type TextAnnotationStyle = LineStyle | TextStyle;
export type AnnotationStyle = LineStyle | ShapeStyle | TextStyle;

/** 可选的形状（顺序即 UI 展示顺序）。 */
export const SHAPE_STYLES: readonly ShapeStyle[] = ["rect", "rounded", "ellipse"];
export const SHAPE_LABELS: Record<ShapeStyle, string> = {
  rect: "矩形",
  rounded: "圆角矩形",
  ellipse: "椭圆",
};
/** 形状外框的 CSS 圆角：矩形≈直角、圆角矩形、椭圆=全圆。 */
export const SHAPE_BORDER_RADIUS: Record<ShapeStyle, number | string> = {
  rect: 2,
  rounded: 10,
  ellipse: "50%",
};

const SHAPE_SET = new Set<string>(SHAPE_STYLES);
export function isShapeStyle(style: AnnotationStyle): style is ShapeStyle {
  return SHAPE_SET.has(style);
}

export function isTextStyle(style: AnnotationStyle): style is TextStyle {
  return style === "text";
}

/** 阅读器顶部工具栏直接区分阅读、文本批注和形状批注。 */
export type ReaderMode = "view" | "text-annotation" | "shape-annotation";

export const HIGHLIGHT_COLORS: Record<
  HighlightColor,
  { bg: string; border: string; label: string }
> = {
  yellow: { bg: "rgba(253, 224, 71, 0.18)", border: "rgba(202, 138, 4, 0.85)", label: "黄色" },
  green: { bg: "rgba(74, 222, 128, 0.16)", border: "rgba(22, 163, 74, 0.8)", label: "绿色" },
  blue: { bg: "rgba(96, 165, 250, 0.16)", border: "rgba(37, 99, 235, 0.8)", label: "蓝色" },
  pink: { bg: "rgba(244, 114, 182, 0.16)", border: "rgba(219, 39, 119, 0.8)", label: "粉色" },
  purple: { bg: "rgba(167, 139, 250, 0.16)", border: "rgba(124, 58, 237, 0.8)", label: "紫色" },
};

/** 归一化坐标（相对页面宽高的 0..1 比例），与缩放无关 */
export interface NormalizedRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * 把零碎矩形按“同一行”合并成连贯整行条。
 * 以矩形竖直中心是否落在某行容差内归行（容差取行/矩形较大高度的一半），
 * 因此公式的上下标、分式、大括号都会并进同一行，而正常行距的相邻行不会被并；
 * 同一行内取 top=最小、bottom=最大（按最高对齐），left/right 取整行跨度，消除中间断裂。
 */
export function mergeNormalizedRects(rects: NormalizedRect[]): NormalizedRect[] {
  const sorted = rects
    .filter((rect) => rect.w > 0 && rect.h > 0)
    .sort((a, b) => a.y - b.y || a.x - b.x);

  const lines: NormalizedRect[] = [];
  for (const rect of sorted) {
    const rectCenter = rect.y + rect.h / 2;
    const line = lines.find((l) => {
      const lineCenter = l.y + l.h / 2;
      const tolerance = Math.max(l.h, rect.h) * 0.5;
      return Math.abs(rectCenter - lineCenter) <= tolerance;
    });
    if (line) {
      const left = Math.min(line.x, rect.x);
      const top = Math.min(line.y, rect.y);
      const right = Math.max(line.x + line.w, rect.x + rect.w);
      const bottom = Math.max(line.y + line.h, rect.y + rect.h);
      line.x = left;
      line.y = top;
      line.w = right - left;
      line.h = bottom - top;
    } else {
      lines.push({ ...rect });
    }
  }
  return lines;
}

/** 取一组矩形的并集外接框（「形状」类批注用：整段套一个外框）。无有效矩形返回 null。 */
export function boundingRect(rects: NormalizedRect[]): NormalizedRect | null {
  const valid = rects.filter((rect) => rect.w > 0 && rect.h > 0);
  if (valid.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const rect of valid) {
    minX = Math.min(minX, rect.x);
    minY = Math.min(minY, rect.y);
    maxX = Math.max(maxX, rect.x + rect.w);
    maxY = Math.max(maxY, rect.y + rect.h);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export interface ReaderSelection {
  text: string;
  page: number;
  positions: NormalizedRect[];
  popupX: number;
  popupY: number;
}

export interface ReaderImageSelection {
  page: number;
  rect: NormalizedRect;
  data: string;
  mediaType: string;
  width: number;
  height: number;
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
  /** 形状内部填充色；null = 不填充（仅描边）。 */
  fill_color: HighlightColor | null;
  created_at: string;
  updated_at: string;
}

const VALID_COLORS = new Set<string>(["yellow", "green", "blue", "pink", "purple"]);
const VALID_STYLES = new Set<string>(["highlight", "underline", "strike", "rect", "rounded", "ellipse", "text"]);

/** 把后端返回的原始记录规整成 PaperNote */
export function normalizePaperNote(raw: unknown): PaperNote | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.paper_id !== "string") return null;

  const color = typeof record.highlight_color === "string" && VALID_COLORS.has(record.highlight_color)
    ? (record.highlight_color as HighlightColor)
    : "yellow";
  const style: AnnotationStyle =
    typeof record.style === "string" && VALID_STYLES.has(record.style)
      ? (record.style as AnnotationStyle)
      : "highlight";
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

  const fillColor: HighlightColor | null =
    typeof record.fill_color === "string" && VALID_COLORS.has(record.fill_color)
      ? (record.fill_color as HighlightColor)
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
    fill_color: fillColor,
    created_at: typeof record.created_at === "string" ? record.created_at : "",
    updated_at: typeof record.updated_at === "string" ? record.updated_at : "",
  };
}
