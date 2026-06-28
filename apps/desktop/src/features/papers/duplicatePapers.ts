import type { Paper } from "@research-copilot/types";

/** 归一化 DOI：去掉 doi.org 前缀与大小写差异，空值返回空串。 */
function normalizeDoi(doi?: string): string {
  if (!doi) return "";
  return doi
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//, "")
    .replace(/^doi:\s*/, "")
    .trim();
}

/** 归一化标题：转小写、去标点、合并空白，仅保留中英文与数字，用于判重。 */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9一-鿿]+/g, " ")
    .trim();
}

/** 计算论文的判重键：优先 DOI，其次归一化标题；都为空则返回空串（不参与判重）。 */
function duplicateKey(paper: Paper): string {
  const doi = normalizeDoi(paper.doi);
  if (doi) return `doi:${doi}`;
  const title = normalizeTitle(paper.title);
  return title ? `title:${title}` : "";
}

/**
 * 按 DOI / 归一化标题找出疑似重复的论文分组（仅返回 ≥2 篇的组）。
 * 组内按入库时间升序（最早在前），方便默认把最早入库的当主论文。
 */
export function findDuplicateGroups(papers: Paper[]): Paper[][] {
  const map = new Map<string, Paper[]>();
  for (const paper of papers) {
    const key = duplicateKey(paper);
    if (!key) continue;
    const list = map.get(key) ?? [];
    list.push(paper);
    map.set(key, list);
  }
  return [...map.values()]
    .filter((group) => group.length >= 2)
    .map((group) => [...group].sort((a, b) => a.created_at.localeCompare(b.created_at)));
}
