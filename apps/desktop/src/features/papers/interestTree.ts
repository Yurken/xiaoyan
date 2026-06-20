import type { ResearchInterest } from "@research-copilot/types";
import { interestFolderName } from "../../lib/interestUtils";

/**
 * 论文文件夹层级工具：把扁平的 research_interests 按 parent_id 组织成树。
 * 文件夹即研究主题（ResearchInterest），parent_id 为空表示顶层文件夹。
 */
export interface InterestTreeNode {
  interest: ResearchInterest;
  depth: number;
  children: InterestTreeNode[];
}

const normalizedParentId = (interest: ResearchInterest): string | null =>
  interest.parent_id?.trim() || null;

/**
 * 把扁平 interests 组织成森林（顶层节点数组）。
 * 防御性处理：parent_id 指向不存在的节点时视为顶层；自环/互引用通过 visited 去重。
 */
export function buildInterestForest(interests: ResearchInterest[]): InterestTreeNode[] {
  const byId = new Map(interests.map((interest) => [interest.id, interest]));
  const childrenOf = new Map<string | null, ResearchInterest[]>();
  for (const interest of interests) {
    const rawParent = normalizedParentId(interest);
    const parent = rawParent && byId.has(rawParent) ? rawParent : null;
    const list = childrenOf.get(parent) ?? [];
    list.push(interest);
    childrenOf.set(parent, list);
  }

  const visited = new Set<string>();
  const build = (parentId: string | null, depth: number): InterestTreeNode[] => {
    const nodes: InterestTreeNode[] = [];
    for (const interest of childrenOf.get(parentId) ?? []) {
      if (visited.has(interest.id)) continue;
      visited.add(interest.id);
      nodes.push({ interest, depth, children: build(interest.id, depth + 1) });
    }
    return nodes;
  };

  return build(null, 0);
}

/** 前序遍历森林，得到带 depth 的有序列表（用于下拉缩进、扁平渲染）。 */
export function flattenInterestForest(forest: InterestTreeNode[]): InterestTreeNode[] {
  const out: InterestTreeNode[] = [];
  const walk = (nodes: InterestTreeNode[]) => {
    for (const node of nodes) {
      out.push(node);
      walk(node.children);
    }
  };
  walk(forest);
  return out;
}

/** 收集某文件夹的全部子孙 id（含自身）：用于移动防环、删除受影响范围计算。 */
export function collectInterestSubtreeIds(
  interests: ResearchInterest[],
  rootId: string,
): string[] {
  const childrenOf = new Map<string, string[]>();
  for (const interest of interests) {
    const parent = normalizedParentId(interest);
    if (!parent) continue;
    const list = childrenOf.get(parent) ?? [];
    list.push(interest.id);
    childrenOf.set(parent, list);
  }

  const ids: string[] = [];
  const seen = new Set<string>();
  const stack = [rootId];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    if (seen.has(current)) continue;
    seen.add(current);
    ids.push(current);
    for (const child of childrenOf.get(current) ?? []) stack.push(child);
  }
  return ids;
}

export interface FolderSelectOption {
  value: string;
  label: string;
}

/**
 * 生成带层级缩进的文件夹下拉选项（前序遍历）。
 * 子文件夹用全角空格缩进并加「└ 」前缀，便于在「选择文件夹」「移动到」等下拉里辨认层级。
 */
export function buildFolderSelectOptions(interests: ResearchInterest[]): FolderSelectOption[] {
  return flattenInterestForest(buildInterestForest(interests)).map((node) => ({
    value: node.interest.id,
    label: `${"　".repeat(node.depth)}${node.depth > 0 ? "└ " : ""}${interestFolderName(node.interest)}`,
  }));
}
