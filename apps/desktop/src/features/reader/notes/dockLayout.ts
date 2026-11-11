import type { NormalizedRect, NoteDockSide, PaperNote } from "../readerTypes";

/**
 * 笔记栏的定位与自适应规则。
 *
 * 笔记栏不是新的数据实体：它就是「有正文内容的批注」换一种摆法，左右归属由批注
 * 自身的坐标推导，不落库、也不额外记状态。
 *
 * PDF 页在阅读区里水平居中，所以「离哪一栏更近」等价于「批注锚点在页面的左半还是右半」：
 * 页面中线就是左右两栏的中点。这样归属在缩放、拉宽、开关侧栏时都不会变。
 */

export const NOTE_DOCK_SIDES: readonly NoteDockSide[] = ["left", "right"];
export const NOTE_DOCK_MIN_WIDTH = 176;
export const NOTE_DOCK_MAX_WIDTH = 360;
export const NOTE_DOCK_DEFAULT_WIDTH = 216;
/** 收起后留在阅读区边上的细缝：只承载细线指示，不遮正文。 */
export const NOTE_DOCK_RAIL_WIDTH = 12;
/** 阅读区最小宽度：栏位再多也不能把正文挤到这条线以下。 */
export const MIN_READING_WIDTH = 460;

export function otherNoteDockSide(side: NoteDockSide): NoteDockSide {
  return side === "left" ? "right" : "left";
}

export function clampNoteDockWidth(width: number): number {
  if (!Number.isFinite(width)) return NOTE_DOCK_DEFAULT_WIDTH;
  return Math.min(NOTE_DOCK_MAX_WIDTH, Math.max(NOTE_DOCK_MIN_WIDTH, Math.round(width)));
}

/** 进笔记栏的批注：写了正文的批注（纯高亮/下划线/形状仍留在批注列表里）。 */
export function isDockNote(note: PaperNote): boolean {
  return note.content.trim().length > 0;
}

export interface NoteAnchorPoint {
  /** 页内横向中心（0..1）。 */
  x: number;
  /** 页内纵向中心（0..1），取选区最早一行。 */
  y: number;
}

/** 选区坐标 → 锚点：取最早一行文字的中心；无有效矩形返回 null。 */
export function anchorPointOfRects(rects: NormalizedRect[] | null | undefined): NoteAnchorPoint | null {
  const valid = (rects ?? []).filter((rect) => rect.w > 0 && rect.h > 0);
  if (valid.length === 0) return null;
  const top = valid.reduce((current, rect) => (rect.y < current.y ? rect : current));
  return {
    x: Math.min(1, Math.max(0, top.x + top.w / 2)),
    y: Math.min(1, Math.max(0, top.y + top.h / 2)),
  };
}

/** 批注锚点；无选区坐标返回 null。 */
export function noteAnchorPoint(note: PaperNote): NoteAnchorPoint | null {
  return anchorPointOfRects(note.highlight_positions);
}

/** 锚点 → 栏：页内中线（0.5）左侧进左栏，右侧进右栏。 */
export function resolveDockSideForAnchor(anchor: NoteAnchorPoint | null): NoteDockSide {
  if (!anchor) return "right";
  return anchor.x < 0.5 ? "left" : "right";
}

/**
 * 批注 → 笔记栏。
 * 页内中线（x < 0.5）左侧进左栏，右侧进右栏；显式换过栏的以记录为准。
 * 没有选区坐标的笔记（例如框选图像解读）没有可比较的位置，默认落在右栏。
 */
export function resolveNoteDockSide(note: PaperNote, overrides: Record<string, NoteDockSide> = {}): NoteDockSide {
  const override = overrides[note.id];
  if (override) return override;
  return resolveDockSideForAnchor(noteAnchorPoint(note));
}

/** 栏内排序：页码 → 页内位置 → 创建时间，让卡片顺序和正文顺序一致。 */
export function compareNoteDockNotes(a: PaperNote, b: PaperNote): number {
  if (a.page !== b.page) return a.page - b.page;
  const anchorA = noteAnchorPoint(a);
  const anchorB = noteAnchorPoint(b);
  if (anchorA && anchorB && anchorA.y !== anchorB.y) return anchorA.y - anchorB.y;
  if (anchorA === null && anchorB !== null) return 1;
  if (anchorA !== null && anchorB === null) return -1;
  if (a.created_at !== b.created_at) return a.created_at.localeCompare(b.created_at);
  return a.id.localeCompare(b.id);
}

export function splitNoteDockNotes(
  notes: PaperNote[],
  overrides: Record<string, NoteDockSide> = {},
): Record<NoteDockSide, PaperNote[]> {
  const grouped: Record<NoteDockSide, PaperNote[]> = { left: [], right: [] };
  for (const note of notes) {
    if (!isDockNote(note)) continue;
    grouped[resolveNoteDockSide(note, overrides)].push(note);
  }
  grouped.left.sort(compareNoteDockNotes);
  grouped.right.sort(compareNoteDockNotes);
  return grouped;
}

export type NoteDockMode = "expanded" | "collapsed";

export interface NoteDockLayoutInput {
  /** 阅读行可用总宽；<= 0 表示还没量到（先按用户意图乐观展开）。 */
  rowWidth: number;
  navWidth: number;
  railWidth: number;
  auxWidth: number;
  /** 用户是否展开该侧笔记栏。 */
  open: Record<NoteDockSide, boolean>;
  /** 两栏共用同一个宽度。 */
  width: number;
  /** 最近操作的一栏：空间只够一栏时优先保留它。 */
  priority: NoteDockSide;
  minReadingWidth?: number;
}

export interface NoteDockLayoutResult {
  modes: Record<NoteDockSide, NoteDockMode>;
  /** 实际使用的展开宽度（收起时组件改用细缝宽度）。 */
  width: number;
  readingWidth: number;
  /** 用户想展开、但被空间挤回收起的栏。 */
  autoCollapsed: NoteDockSide[];
}

/**
 * 两栏与阅读区的空间分配。
 *
 * 降级顺序固定：两栏都放不下就收窄到最小栏宽；仍放不下就只保留最近操作的一栏；
 * 再不够就两栏都收成细缝。阅读区始终不小于 minReadingWidth——栏位只会推开正文，
 * 不会盖住正文。
 */
export function resolveNoteDockLayout(input: NoteDockLayoutInput): NoteDockLayoutResult {
  const minReading = input.minReadingWidth ?? MIN_READING_WIDTH;
  const budget = Math.max(0, input.rowWidth - input.navWidth - input.railWidth - input.auxWidth);
  const width = clampNoteDockWidth(input.width);
  const openSides = NOTE_DOCK_SIDES.filter((side) => input.open[side]);

  const result: NoteDockLayoutResult = {
    modes: { left: "collapsed", right: "collapsed" },
    width,
    readingWidth: budget,
    autoCollapsed: [],
  };
  if (openSides.length === 0) return result;

  // 首帧还没测到行宽：先尊重用户意图，避免闪一下再展开。
  if (input.rowWidth <= 0) {
    for (const side of openSides) result.modes[side] = "expanded";
    return result;
  }

  const room = budget - minReading;
  if (openSides.length === 2) {
    const perSide = Math.floor(room / 2);
    if (perSide >= NOTE_DOCK_MIN_WIDTH) {
      result.modes = { left: "expanded", right: "expanded" };
      result.width = Math.min(width, perSide);
      result.readingWidth = Math.max(minReading, budget - result.width * 2);
      return result;
    }

    const keep = openSides.includes(input.priority) ? input.priority : openSides[0];
    const drop = otherNoteDockSide(keep);
    const fitted = Math.min(width, Math.max(0, room));
    if (fitted >= NOTE_DOCK_MIN_WIDTH) {
      result.modes[keep] = "expanded";
      result.width = fitted;
      result.readingWidth = Math.max(minReading, budget - fitted);
      result.autoCollapsed = [drop];
      return result;
    }
    result.autoCollapsed = [keep, drop];
    return result;
  }

  const [side] = openSides;
  const fitted = Math.min(width, Math.max(0, room));
  if (fitted >= NOTE_DOCK_MIN_WIDTH) {
    result.modes[side] = "expanded";
    result.width = fitted;
    result.readingWidth = Math.max(minReading, budget - fitted);
    return result;
  }
  result.autoCollapsed = [side];
  return result;
}
