import type { KnowledgeGraphNodeKind } from "./shared";

type KnowledgeGraphLane = "interest" | "claim" | "evidence";

export interface KnowledgeGraphCanvasNode {
  id: string;
  entityId: string;
  lane: KnowledgeGraphLane;
  kind: KnowledgeGraphNodeKind;
  title: string;
  subtitle?: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface KnowledgeGraphLayoutInputNode {
  id: string;
  entityId: string;
  lane: KnowledgeGraphLane;
  kind: KnowledgeGraphNodeKind;
  title: string;
  subtitle?: string;
}

const LANE_X = {
  interest: 14,
  claim: 45,
  evidence: 77,
} satisfies Record<KnowledgeGraphLane, number>;

const TOP_PADDING = 76;
const BOTTOM_PADDING = 44;
const LANE_GAP = 22;

export function buildKnowledgeGraphCanvasLayout(
  nodeOrder: Record<KnowledgeGraphLane, KnowledgeGraphLayoutInputNode[]>,
): KnowledgeGraphCanvasNode[] {
  const flattenedNodes = Object.values(nodeOrder).flat();
  const nodeWidth = estimateNodeWidth(flattenedNodes);
  const laneHeights = Object.fromEntries(
    (Object.entries(nodeOrder) as Array<[KnowledgeGraphLane, KnowledgeGraphLayoutInputNode[]]>).map(([lane, items]) => [
      lane,
      items.reduce((height, item, index) => {
        const nextHeight = estimateNodeHeight(item.title, item.subtitle, nodeWidth);
        return height + nextHeight + (index > 0 ? LANE_GAP : 0);
      }, 0),
    ])
  ) as Record<KnowledgeGraphLane, number>;

  const maxLaneHeight = Math.max(...Object.values(laneHeights), 0);

  return (Object.entries(nodeOrder) as Array<[KnowledgeGraphLane, KnowledgeGraphLayoutInputNode[]]>).flatMap(([lane, items]) => {
    let currentY = TOP_PADDING + (maxLaneHeight - laneHeights[lane]) / 2;

    return items.map<KnowledgeGraphCanvasNode>((item) => {
      const height = estimateNodeHeight(item.title, item.subtitle, nodeWidth);
      const node = {
        ...item,
        x: LANE_X[lane],
        y: currentY,
        width: nodeWidth,
        height,
      };
      currentY += height + LANE_GAP;
      return node;
    });
  });
}

export function computeKnowledgeGraphCanvasHeight(nodes: KnowledgeGraphCanvasNode[]) {
  if (nodes.length === 0) {
    return 320;
  }

  const contentBottom = Math.max(...nodes.map((node) => node.y + node.height));
  return Math.max(320, Math.ceil(contentBottom + BOTTOM_PADDING));
}

function estimateNodeWidth(nodes: KnowledgeGraphLayoutInputNode[]) {
  const longestTitleWeight = nodes.reduce((maxWeight, node) => Math.max(maxWeight, measureTextWeight(node.title)), 0);
  return Math.max(188, Math.min(240, 188 + Math.max(0, longestTitleWeight - 12) * 4));
}

function estimateNodeHeight(title: string, subtitle: string | undefined, nodeWidth: number) {
  const titleCharsPerLine = Math.max(11, Math.floor((nodeWidth - 32) / 14));
  const subtitleCharsPerLine = Math.max(18, Math.floor((nodeWidth - 32) / 9));
  const titleLines = estimateWrappedLines(title, titleCharsPerLine, 2);
  const subtitleLines = subtitle ? estimateWrappedLines(subtitle, subtitleCharsPerLine, 2) : 0;
  const titleHeight = titleLines * 20;
  const subtitleHeight = subtitleLines > 0 ? 8 + subtitleLines * 16 : 0;

  return Math.max(78, 24 + titleHeight + subtitleHeight + 18);
}

function estimateWrappedLines(text: string, charsPerLine: number, maxLines: number) {
  if (!text.trim()) {
    return 0;
  }
  return Math.min(maxLines, Math.max(1, Math.ceil(measureTextWeight(text) / charsPerLine)));
}

function measureTextWeight(text: string) {
  return Array.from(text).reduce((weight, char) => {
    if (/\s/.test(char)) {
      return weight + 0.3;
    }
    if (/[A-Za-z0-9]/.test(char)) {
      return weight + 0.58;
    }
    return weight + 1;
  }, 0);
}
