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

export interface KnowledgeGraphEdgeGeometry {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  controlX: number;
  controlY: number;
}

/**
 * 计算知识图谱连线端点与二次贝塞尔控制点。
 *
 * 节点用像素宽度、SVG 用 viewBox 坐标，二者通过 containerWidth 换算：
 * 节点半宽在 viewBox 单位下 = (node.width / 2 / containerWidth) * viewWidth。
 *
 * - 不同列：端点贴左/右边缘，方向由 from→to 的 x 相对位置决定；
 * - 同列（垂直走向）：端点贴上/下边缘，避免穿过节点内部；
 * - containerWidth<=0（未测量）：退回中心，与旧行为一致，避免除零。
 */
export function computeKnowledgeGraphEdgeGeometry(
  from: KnowledgeGraphCanvasNode,
  to: KnowledgeGraphCanvasNode,
  containerWidth: number,
  viewWidth: number,
): KnowledgeGraphEdgeGeometry {
  const fromCenterX = (from.x / 100) * viewWidth;
  const toCenterX = (to.x / 100) * viewWidth;
  const fromCenterY = from.y + from.height / 2;
  const toCenterY = to.y + to.height / 2;

  // 同列（几乎相同的 x）：连线竖直，端点贴上/下边缘
  if (Math.abs(from.x - to.x) < 0.5) {
    const fromAbove = from.y + from.height <= to.y;
    const startY = fromAbove ? from.y + from.height : from.y;
    const endY = fromAbove ? to.y : to.y + to.height;
    return {
      startX: fromCenterX,
      startY,
      endX: toCenterX,
      endY,
      controlX: fromCenterX,
      controlY: (startY + endY) / 2,
    };
  }

  // 不同列：端点贴左/右边缘，方向由 from→to 决定
  const direction = to.x > from.x ? 1 : -1;
  const fromHalf = containerWidth > 0 ? (from.width / 2 / containerWidth) * viewWidth : 0;
  const toHalf = containerWidth > 0 ? (to.width / 2 / containerWidth) * viewWidth : 0;
  const startX = fromCenterX + direction * fromHalf;
  const endX = toCenterX - direction * toHalf;
  const controlX = (fromCenterX + toCenterX) / 2;
  const controlY =
    from.kind === "paper" && to.kind === "paper"
      ? Math.min(fromCenterY, toCenterY) - 36
      : (fromCenterY + toCenterY) / 2;
  return { startX, startY: fromCenterY, endX, endY: toCenterY, controlX, controlY };
}
