import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Paper } from "@research-copilot/types";
import {
  invalidatePaperListCache,
  loadPaperListOnce,
  readCachedPaperList,
  replaceCachedPaperList,
  resetPaperListCacheForTests,
} from "../../lib/paperListCache";

function paper(id: string): Paper {
  return {
    id,
    title: `Paper ${id}`,
    status: "parsed",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

describe("paperListCache", () => {
  beforeEach(() => resetPaperListCacheForTests());

  it("复用首次加载的列表并合并并发请求", async () => {
    const loader = vi.fn(async () => [paper("1")]);

    const [first, second] = await Promise.all([
      loadPaperListOnce(loader),
      loadPaperListOnce(loader),
    ]);
    const third = await loadPaperListOnce(loader);

    expect(loader).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
    expect(third).toBe(first);
  });

  it("只常驻一个最多 500 条的快照", () => {
    const cached = replaceCachedPaperList(Array.from({ length: 520 }, (_, index) => paper(String(index))));

    expect(cached).toHaveLength(500);
    expect(readCachedPaperList()).toBe(cached);
  });

  it("数据变更后失效且不会让旧请求覆盖新缓存", async () => {
    let resolveOld!: (papers: Paper[]) => void;
    const oldLoad = loadPaperListOnce(() => new Promise((resolve) => { resolveOld = resolve; }));

    invalidatePaperListCache();
    const fresh = await loadPaperListOnce(async () => [paper("fresh")]);
    resolveOld([paper("old")]);
    const oldCallerResult = await oldLoad;

    expect(oldCallerResult).toBe(fresh);
    expect(readCachedPaperList()).toBe(fresh);
    expect(readCachedPaperList()?.[0].id).toBe("fresh");
  });
});
