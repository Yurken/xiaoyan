import { HIGHLIGHT_COLORS, type HighlightColor, type NoteDockSide, type PaperNote } from "../readerTypes";
import { isDockNote, noteAnchorPoint, resolveNoteDockSide } from "./dockLayout";

/** 收起状态下贴在原文位置的一条细线。 */
export interface NoteTick {
  note: PaperNote;
  side: NoteDockSide;
  color: HighlightColor;
  /** 相对页面顶部的纵向偏移（px）。 */
  offset: number;
}

/** 为该页构建细线：只保留进笔记栏、且该侧栏当前收起、且有选区坐标的批注。 */
export function buildNoteTicks(
  notes: PaperNote[],
  pageHeight: number,
  visible: Record<NoteDockSide, boolean>,
  overrides: Record<string, NoteDockSide> = {},
): NoteTick[] {
  if (!(pageHeight > 0)) return [];
  const ticks: NoteTick[] = [];
  for (const note of notes) {
    if (!isDockNote(note)) continue;
    const side = resolveNoteDockSide(note, overrides);
    if (!visible[side]) continue;
    const anchor = noteAnchorPoint(note);
    if (!anchor) continue;
    ticks.push({
      note,
      side,
      color: note.highlight_color,
      offset: Math.min(pageHeight - 1, Math.max(0, anchor.y * pageHeight)),
    });
  }
  return ticks.sort((a, b) => a.offset - b.offset);
}

/** 细线的尺寸与配色（展开/悬停时加粗一点，提示当前联动的批注）。 */
export function noteTickStyle(tick: NoteTick, active: boolean) {
  return {
    background: HIGHLIGHT_COLORS[tick.color].border,
    width: active ? 20 : 12,
    height: active ? 2 : 1,
    opacity: active ? 1 : 0.55,
  };
}
