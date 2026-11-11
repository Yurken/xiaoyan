import { describe, expect, it } from "vitest";
import type { PaperNote } from "../../../features/reader/readerTypes";
import {
  NOTE_DOCK_MIN_WIDTH,
  anchorPointOfRects,
  resolveDockSideForAnchor,
  resolveNoteDockLayout,
  resolveNoteDockSide,
  splitNoteDockNotes,
} from "../../../features/reader/notes/dockLayout";
import { buildNoteTicks } from "../../../features/reader/notes/noteTicks";

function note(overrides: Partial<PaperNote> = {}): PaperNote {
  return {
    id: "note-a",
    paper_id: "paper-a",
    page: 1,
    content: "一段笔记",
    highlight_text: "原文",
    highlight_color: "yellow",
    highlight_positions: [{ x: 0.2, y: 0.3, w: 0.2, h: 0.02 }],
    style: "highlight",
    fill_color: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const layoutBase = {
  rowWidth: 1440,
  navWidth: 256,
  railWidth: 40,
  auxWidth: 0,
  width: 216,
  open: { left: true, right: true },
  priority: "left" as const,
};

describe("笔记栏归属规则", () => {
  it("按选区锚点落在页面中线哪侧决定左右栏", () => {
    expect(resolveDockSideForAnchor({ x: 0.2, y: 0.5 })).toBe("left");
    expect(resolveDockSideForAnchor({ x: 0.79, y: 0.5 })).toBe("right");
    // 正好在中线上时取右栏，避免同一位置左右来回跳。
    expect(resolveDockSideForAnchor({ x: 0.5, y: 0.5 })).toBe("right");
    expect(resolveDockSideForAnchor(null)).toBe("right");
  });

  it("锚点取选区最先一行，而不是整块的中心", () => {
    const anchor = anchorPointOfRects([
      { x: 0.1, y: 0.6, w: 0.8, h: 0.02 },
      { x: 0.7, y: 0.2, w: 0.2, h: 0.02 },
    ]);
    expect(anchor?.x).toBeCloseTo(0.8);
    expect(anchor?.y).toBeCloseTo(0.21);
  });

  it("手动换过栏的批注以记录为准", () => {
    const left = note();
    expect(resolveNoteDockSide(left)).toBe("left");
    expect(resolveNoteDockSide(left, { "note-a": "right" })).toBe("right");
  });
});

describe("笔记栏内容", () => {
  it("只有带正文的批注进入笔记栏，纯高亮留在批注列表", () => {
    const groups = splitNoteDockNotes([
      note({ id: "plain", content: "" }),
      note({ id: "left-note", content: "左" }),
      note({ id: "right-note", content: "右", highlight_positions: [{ x: 0.7, y: 0.3, w: 0.1, h: 0.02 }] }),
    ]);
    expect(groups.left.map((item) => item.id)).toEqual(["left-note"]);
    expect(groups.right.map((item) => item.id)).toEqual(["right-note"]);
  });

  it("栏内按页码与页内位置排序，越靠前越靠上", () => {
    const groups = splitNoteDockNotes([
      note({ id: "p2", page: 2, highlight_positions: [{ x: 0.1, y: 0.1, w: 0.2, h: 0.02 }] }),
      note({ id: "low", page: 1, highlight_positions: [{ x: 0.1, y: 0.8, w: 0.2, h: 0.02 }] }),
      note({ id: "high", page: 1, highlight_positions: [{ x: 0.1, y: 0.2, w: 0.2, h: 0.02 }] }),
    ]);
    expect(groups.left.map((item) => item.id)).toEqual(["high", "low", "p2"]);
  });
});

describe("笔记栏自适应", () => {
  it("空间充足时两栏展开，共用同一宽度", () => {
    const layout = resolveNoteDockLayout(layoutBase);
    expect(layout.modes).toEqual({ left: "expanded", right: "expanded" });
    expect(layout.width).toBe(216);
    expect(layout.readingWidth).toBeGreaterThanOrEqual(460);
  });

  it("两栏放不下时按最小栏宽收敛，而不是挤压正文", () => {
    const layout = resolveNoteDockLayout({ ...layoutBase, rowWidth: 1180 });
    // 预算 884，留给栏位 424 → 每侧 212（≥176）
    expect(layout.modes).toEqual({ left: "expanded", right: "expanded" });
    expect(layout.width).toBe(212);
    expect(layout.readingWidth).toBeGreaterThanOrEqual(460);
  });

  it("只够一栏时保留最近操作的一栏，另一栏收成细缝", () => {
    const layout = resolveNoteDockLayout({ ...layoutBase, rowWidth: 1000, priority: "right" });
    expect(layout.modes).toEqual({ left: "collapsed", right: "expanded" });
    expect(layout.autoCollapsed).toEqual(["left"]);
    expect(layout.readingWidth).toBeGreaterThanOrEqual(460);
  });

  it("连一栏都放不下时两栏都收成细缝", () => {
    const layout = resolveNoteDockLayout({ ...layoutBase, rowWidth: 800 });
    expect(layout.modes).toEqual({ left: "collapsed", right: "collapsed" });
    expect(layout.autoCollapsed).toEqual(["left", "right"]);
  });

  it("还没量到行宽时先按用户意图展开，避免闪一下", () => {
    const layout = resolveNoteDockLayout({ ...layoutBase, rowWidth: 0 });
    expect(layout.modes).toEqual({ left: "expanded", right: "expanded" });
  });
});

describe("收起时的细线", () => {
  it("只给收起那一侧的笔记画线，位置取锚点的页内纵坐标", () => {
    const ticks = buildNoteTicks(
      [note({ id: "left-note" }), note({ id: "right-note", highlight_positions: [{ x: 0.8, y: 0.6, w: 0.1, h: 0.02 }] })],
      1000,
      { left: true, right: false },
      {},
    );
    expect(ticks).toHaveLength(1);
    expect(ticks[0].note.id).toBe("left-note");
    expect(ticks[0].side).toBe("left");
    expect(ticks[0].offset).toBeCloseTo(310);
  });

  it("纯高亮没有正文，不产生细线", () => {
    const ticks = buildNoteTicks([note({ content: "" })], 1000, { left: true, right: true });
    expect(ticks).toEqual([]);
  });

  it("细线按纵向位置排序，且不超过页面高度", () => {
    const ticks = buildNoteTicks(
      [
        note({ id: "b", highlight_positions: [{ x: 0.1, y: 0.9, w: 0.1, h: 0.02 }] }),
        note({ id: "a", highlight_positions: [{ x: 0.1, y: 0.1, w: 0.1, h: 0.02 }] }),
      ],
      200,
      { left: true, right: true },
    );
    expect(ticks.map((tick) => tick.note.id)).toEqual(["a", "b"]);
    expect(ticks.every((tick) => tick.offset >= 0 && tick.offset < 200)).toBe(true);
  });
});

describe("最小栏宽常量", () => {
  it("窄栏仍能放下一行笔记摘要", () => {
    expect(NOTE_DOCK_MIN_WIDTH).toBeGreaterThanOrEqual(160);
  });
});
