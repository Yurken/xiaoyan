import type { AgentExecutionGraphView, AgentGraphNodeKey } from "./shared";

interface Point {
  x: number;
  y: number;
}

export interface AgentGraphLayoutPreset {
  baseNodeWidth: number;
  maxNodeWidth: number;
  nodeHeight: number;
  horizontalGap: number;
  verticalGap: number;
  sidePadding: number;
  topPadding: number;
  bottomPadding: number;
  minCanvasWidth: number;
  minCanvasHeight: number;
  maxViewportHeight: number;
}

export interface AgentGraphLayout {
  canvasWidth: number;
  canvasHeight: number;
  viewportHeight: number;
  nodeWidth: number;
  nodeHeight: number;
  positions: Map<AgentGraphNodeKey, Point>;
}

export const AGENT_GRAPH_LAYOUT_PRESETS = {
  regular: {
    baseNodeWidth: 188,
    maxNodeWidth: 244,
    nodeHeight: 90,
    horizontalGap: 82,
    verticalGap: 26,
    sidePadding: 34,
    topPadding: 30,
    bottomPadding: 32,
    minCanvasWidth: 860,
    minCanvasHeight: 320,
    maxViewportHeight: 440,
  },
  compact: {
    baseNodeWidth: 144,
    maxNodeWidth: 176,
    nodeHeight: 74,
    horizontalGap: 52,
    verticalGap: 18,
    sidePadding: 18,
    topPadding: 18,
    bottomPadding: 24,
    minCanvasWidth: 620,
    minCanvasHeight: 240,
    maxViewportHeight: 240,
  },
} satisfies Record<"regular" | "compact", AgentGraphLayoutPreset>;

export function buildAgentGraphLayout(
  graph: AgentExecutionGraphView,
  preset: AgentGraphLayoutPreset,
): AgentGraphLayout {
  const workerNodes = graph.nodes.filter((node) => node.lane === "worker");
  const hasRetrieval = graph.nodes.some((node) => node.id === "retrieval");
  const hasSynthesis = graph.nodes.some((node) => node.id === "synthesis");
  const longestTitleLength = graph.nodes.reduce((maxLength, node) => Math.max(maxLength, node.title.length), 0);
  const adaptiveNodeWidth = Math.max(
    preset.baseNodeWidth,
    Math.min(preset.maxNodeWidth, preset.baseNodeWidth + Math.max(0, longestTitleLength - 8) * 6)
  );

  const laneCounts = [1, hasRetrieval ? 1 : 0, workerNodes.length, hasSynthesis ? 1 : 0].filter((count) => count > 0);
  const maxLaneCount = Math.max(...laneCounts, 1);
  const contentHeight = maxLaneCount * preset.nodeHeight + (maxLaneCount - 1) * preset.verticalGap;
  const canvasHeight = Math.max(
    preset.minCanvasHeight,
    preset.topPadding + contentHeight + preset.bottomPadding
  );

  const positions = new Map<AgentGraphNodeKey, Point>();
  let currentX = preset.sidePadding + adaptiveNodeWidth / 2;

  positions.set("start", {
    x: currentX,
    y: laneCenterY(0, 1, contentHeight, preset),
  });

  if (hasRetrieval) {
    currentX += adaptiveNodeWidth + preset.horizontalGap;
    positions.set("retrieval", {
      x: currentX,
      y: laneCenterY(0, 1, contentHeight, preset),
    });
  }

  if (workerNodes.length > 0) {
    currentX += adaptiveNodeWidth + preset.horizontalGap;
    workerNodes.forEach((node, index) => {
      positions.set(node.id, {
        x: currentX,
        y: laneCenterY(index, workerNodes.length, contentHeight, preset),
      });
    });
  }

  if (hasSynthesis) {
    currentX += adaptiveNodeWidth + preset.horizontalGap;
    positions.set("synthesis", {
      x: currentX,
      y: laneCenterY(0, 1, contentHeight, preset),
    });
  }

  const canvasWidth = Math.max(
    preset.minCanvasWidth,
    currentX + adaptiveNodeWidth / 2 + preset.sidePadding
  );

  return {
    canvasWidth,
    canvasHeight,
    viewportHeight: Math.min(canvasHeight, preset.maxViewportHeight),
    nodeWidth: adaptiveNodeWidth,
    nodeHeight: preset.nodeHeight,
    positions,
  };
}

function laneCenterY(
  index: number,
  laneCount: number,
  contentHeight: number,
  preset: AgentGraphLayoutPreset,
) {
  const laneHeight = laneCount * preset.nodeHeight + (laneCount - 1) * preset.verticalGap;
  const laneTop = preset.topPadding + (contentHeight - laneHeight) / 2;
  return laneTop + preset.nodeHeight / 2 + index * (preset.nodeHeight + preset.verticalGap);
}
