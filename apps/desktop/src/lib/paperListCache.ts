import type { Paper } from "@research-copilot/types";

// 论文库页面本身最多请求 500 条。这里只保留同一份数组快照，不按查询条件
// 建立多份缓存，避免论文分析文本长期占用成倍内存。
const MAX_CACHED_PAPERS = 500;

let cachedPapers: Paper[] | null = null;
let pendingLoad: Promise<Paper[]> | null = null;
let cacheRevision = 0;

export function readCachedPaperList(): Paper[] | null {
  return cachedPapers;
}

export function replaceCachedPaperList(papers: Paper[]): Paper[] {
  cachedPapers = papers.length > MAX_CACHED_PAPERS
    ? papers.slice(0, MAX_CACHED_PAPERS)
    : papers;
  return cachedPapers;
}

export function invalidatePaperListCache() {
  cachedPapers = null;
  pendingLoad = null;
  cacheRevision += 1;
}

export function loadPaperListOnce(loader: () => Promise<Paper[]>): Promise<Paper[]> {
  if (cachedPapers) return Promise.resolve(cachedPapers);
  if (pendingLoad) return pendingLoad;

  const loadRevision = cacheRevision;
  const request = loader()
    .then((papers) => {
      if (loadRevision === cacheRevision) return replaceCachedPaperList(papers);
      // 旧请求失效后，旧调用方也必须等待并获得当前修订的数据，不能把过期数组再写回快照。
      return cachedPapers ?? loadPaperListOnce(loader);
    })
    .finally(() => {
      if (pendingLoad === request) pendingLoad = null;
    });
  pendingLoad = request;
  return pendingLoad;
}

export function resetPaperListCacheForTests() {
  cachedPapers = null;
  pendingLoad = null;
  cacheRevision = 0;
}
