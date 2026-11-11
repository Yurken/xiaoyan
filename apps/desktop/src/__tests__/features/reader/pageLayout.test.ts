import { describe, expect, it } from "vitest";
import { groupPageRows, resolveSpreadFit, resolveViewportPage } from "../../../features/reader/pageLayout";

describe("groupPageRows", () => {
  it("单页：每页一行", () => {
    expect(groupPageRows(3, "single")).toEqual([[1], [2], [3]]);
  });

  it("双页：首页单独一行，其后两页一行", () => {
    expect(groupPageRows(5, "spread")).toEqual([[1], [2, 3], [4, 5]]);
  });

  it("双页：总页数为偶数时最后一行落单", () => {
    expect(groupPageRows(6, "spread")).toEqual([[1], [2, 3], [4, 5], [6]]);
  });

  it("双页：只有一页时不会排出空行", () => {
    expect(groupPageRows(1, "spread")).toEqual([[1]]);
  });

  it("双页：关掉「首页单独」就从 1-2 开始配对", () => {
    expect(groupPageRows(4, "spread", false)).toEqual([[1, 2], [3, 4]]);
  });

  it("页数为 0 或非法值时返回空数组", () => {
    expect(groupPageRows(0, "spread")).toEqual([]);
    expect(groupPageRows(Number.NaN, "single")).toEqual([]);
  });
});

describe("resolveSpreadFit", () => {
  const base = { horizontalPadding: 48, pageWidth: 600, scale: 1, gap: 16 };

  it("放得下时不做收敛", () => {
    expect(resolveSpreadFit({ ...base, containerWidth: 1400 })).toBe(1);
  });

  it("放不下时把两页压到刚好容纳", () => {
    // 可用宽度 1000 - 48 = 952；两页所需 600 * 2 = 1200，页间距 16 不参与缩放。
    const fit = resolveSpreadFit({ ...base, containerWidth: 1000 });
    expect(fit).toBeCloseTo((952 - 16) / 1200, 5);
    expect(600 * fit * 2 + 16).toBeCloseTo(952, 5);
  });

  it("容器还没量出宽度时退回 1", () => {
    expect(resolveSpreadFit({ ...base, containerWidth: 0 })).toBe(1);
  });

  it("缩小到放得下之后不再收敛", () => {
    expect(resolveSpreadFit({ ...base, scale: 0.5, containerWidth: 1000 })).toBe(1);
  });

  it("高倍缩放和窄阅读区仍然适宽，不受 20% 收敛下限限制", () => {
    const fit = resolveSpreadFit({ ...base, containerWidth: 400, scale: 3 });
    expect(fit).toBeLessThan(0.2);
    expect(600 * 3 * fit * 2 + 16).toBeCloseTo(400 - 48, 5);
  });

  it("同一行横版和竖版页按各自真实宽度共同收敛", () => {
    const fit = resolveSpreadFit({ ...base, secondPageWidth: 900, containerWidth: 1000 });
    expect((600 + 900) * fit + 16).toBeCloseTo(1000 - 48, 5);
  });

  it("页面尺寸未知时不做收敛", () => {
    expect(resolveSpreadFit({ ...base, pageWidth: 0, containerWidth: 400 })).toBe(1);
  });
});

describe("resolveViewportPage", () => {
  const pages = [
    { page: 1, top: -800, height: 700 },
    { page: 2, top: 0, height: 700 },
    { page: 3, top: 0, height: 700 },
    { page: 4, top: 716, height: 700 },
    { page: 5, top: 716, height: 700 },
  ];

  it("定位右页后，同一行不会被左页覆盖", () => {
    expect(resolveViewportPage(pages, 0, 600, 3)).toBe(3);
  });

  it("默认选择当前行左页，滚到下一行不会锁在旧的右页", () => {
    expect(resolveViewportPage(pages, 0, 600, 1)).toBe(2);
    expect(resolveViewportPage(pages, 716, 600, 3)).toBe(4);
  });

  it("同一行页面高度不同时仍保留明确选中的页", () => {
    expect(resolveViewportPage(pages.map((page) => page.page === 3 ? { ...page, height: 200 } : page), 0, 600, 3)).toBe(3);
  });
});
