import { useMemo } from "react";
import { ArrowRight, CheckCircle2, Clock3, Loader2, Sparkles, XCircle } from "lucide-react";
import { toCapabilityModelName, type AgentPlanStep, type AgentRun } from "@research-copilot/types";
import { buildAgentExecutionGraph, type AgentExecutionGraphView, type AgentGraphEdgeStatus, type AgentGraphNodeStatus } from "./shared";

interface AgentStateGraphPanelProps {
  plan: AgentPlanStep[];
  runs: AgentRun[];
  sending?: boolean;
  compact?: boolean;
  emptyText?: string;
}

interface Point {
  x: number;
  y: number;
}

const NODE_SIZE = {
  regular: { width: 156, height: 78, canvasWidth: 700, canvasHeight: 292, workerGap: 68 },
  compact: { width: 136, height: 66, canvasWidth: 620, canvasHeight: 240, workerGap: 58 },
};

export default function AgentStateGraphPanel({
  plan,
  runs,
  sending = false,
  compact = false,
  emptyText = "提交问题后，这里会展示状态图中的节点状态与边流转。",
}: AgentStateGraphPanelProps) {
  const graph = useMemo(() => buildAgentExecutionGraph(plan, runs, sending), [plan, runs, sending]);
  const preset = compact ? NODE_SIZE.compact : NODE_SIZE.regular;
  const positions = useMemo(() => buildNodePositions(graph, preset), [graph, preset]);

  if (graph.nodes.length === 0) {
    return <p className="text-xs leading-5 text-ink-tertiary">{emptyText}</p>;
  }

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      <div className="overflow-x-auto pb-1">
        <div
          className="relative"
          style={{
            minWidth: preset.canvasWidth,
            height: preset.canvasHeight,
          }}
        >
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox={`0 0 ${preset.canvasWidth} ${preset.canvasHeight}`}
            fill="none"
          >
            {graph.edges.map((edge) => {
              const source = positions.get(edge.from);
              const target = positions.get(edge.to);
              if (!source || !target) return null;
              const path = buildEdgePath(source, target);
              const tone = edgeTone(edge.status);
              return (
                <g key={edge.id}>
                  <path d={path} stroke="rgba(15, 23, 42, 0.08)" strokeWidth={compact ? 6 : 7} strokeLinecap="round" />
                  <path
                    d={path}
                    stroke={tone.stroke}
                    strokeWidth={compact ? 2.5 : 3}
                    strokeLinecap="round"
                    strokeDasharray={edge.status === "active" ? "8 8" : undefined}
                    opacity={edge.status === "pending" ? 0.4 : 1}
                  />
                </g>
              );
            })}
          </svg>

          {graph.edges
            .filter((edge) => edge.status === "active")
            .map((edge) => {
              const source = positions.get(edge.from);
              const target = positions.get(edge.to);
              if (!source || !target) return null;
              return (
                <span
                  key={`${edge.id}-pulse`}
                  className="absolute h-3 w-3 rounded-full animate-pulse"
                  style={{
                    left: (source.x + target.x) / 2 - 6,
                    top: (source.y + target.y) / 2 - 6,
                    background: "linear-gradient(145deg, #2563EB, #60A5FA)",
                    boxShadow: "0 0 0 4px rgba(37, 99, 235, 0.12)",
                  }}
                />
              );
            })}

          {graph.nodes.map((node) => {
            const position = positions.get(node.id);
            if (!position) return null;
            const tone = nodeTone(node.status);

            return (
              <div
                key={node.id}
                className="absolute rounded-[22px] px-3 py-2.5 transition-all duration-200"
                style={{
                  width: preset.width,
                  minHeight: preset.height,
                  left: position.x - preset.width / 2,
                  top: position.y - preset.height / 2,
                  background: tone.background,
                  boxShadow: tone.shadow,
                  border: `1px solid ${tone.border}`,
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className={`truncate font-semibold text-ink-primary ${compact ? "text-[13px]" : "text-sm"}`}>{node.title}</div>
                    {node.agentName && (
                      <div className="mt-0.5 truncate text-[10px] text-ink-tertiary">
                        {toCapabilityModelName(node.agentName)}
                      </div>
                    )}
                  </div>
                  <div
                    className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium"
                    style={{
                      color: tone.badgeColor,
                      background: tone.badgeBackground,
                    }}
                  >
                    {tone.icon}
                    {tone.label}
                  </div>
                </div>
                <p className={`mt-2 line-clamp-2 text-ink-tertiary ${compact ? "text-[10px] leading-4" : "text-[11px] leading-5"}`}>{node.goal}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className={compact ? "space-y-1.5" : "space-y-2"}>
        <div className="flex items-center justify-between gap-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-tertiary">边流转</div>
          <div className="text-[11px] text-ink-tertiary">
            {graph.edges.filter((edge) => edge.status === "active").length > 0 ? "当前有节点在推进" : "等待下一跳"}
          </div>
        </div>

        <div className="space-y-2">
          {graph.edges.slice(0, compact ? 3 : 6).map((edge) => {
            const tone = edgeTone(edge.status);
            return (
              <div
                key={`${edge.id}-row`}
                className={`rounded-2xl px-3 ${compact ? "py-2" : "py-2.5"}`}
                style={{
                  background: "var(--rc-card-inset-bg, rgba(255,255,255,0.56))",
                  boxShadow: "var(--rc-inset-shadow, inset 1px 1px 3px rgba(15, 23, 42, 0.08))",
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex items-center gap-2 text-xs text-ink-primary">
                    <span className="truncate font-medium">{edge.sourceTitle}</span>
                    <ArrowRight className="h-3.5 w-3.5 flex-shrink-0 text-ink-tertiary" />
                    <span className="truncate font-medium">{edge.targetTitle}</span>
                  </div>
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium"
                    style={{ color: tone.stroke, background: tone.background }}
                  >
                    {tone.icon}
                    {tone.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function buildNodePositions(
  graph: AgentExecutionGraphView,
  preset: typeof NODE_SIZE.regular,
) {
  const positions = new Map<string, Point>();
  const centerY = preset.canvasHeight / 2;
  const hasRetrieval = graph.nodes.some((node) => node.id === "retrieval");
  const workerNodes = graph.nodes.filter((node) => node.lane === "worker");
  const workerX = hasRetrieval ? 418 : 320;
  const synthesisX = hasRetrieval ? 648 : 584;
  const baseY =
    centerY - ((Math.max(workerNodes.length, 1) - 1) * preset.workerGap) / 2;

  positions.set("start", { x: 88, y: centerY });
  if (hasRetrieval) {
    positions.set("retrieval", { x: 246, y: centerY });
  }
  workerNodes.forEach((node, index) => {
    positions.set(node.id, { x: workerX, y: baseY + index * preset.workerGap });
  });
  if (graph.nodes.some((node) => node.id === "synthesis")) {
    positions.set("synthesis", { x: synthesisX, y: centerY });
  }

  return positions;
}

function buildEdgePath(source: Point, target: Point) {
  const curve = Math.max(54, (target.x - source.x) * 0.38);
  return `M ${source.x} ${source.y} C ${source.x + curve} ${source.y}, ${target.x - curve} ${target.y}, ${target.x} ${target.y}`;
}

function nodeTone(status: AgentGraphNodeStatus) {
  if (status === "done") {
    return {
      label: "完成",
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      background: "linear-gradient(180deg, rgba(236, 253, 245, 0.96) 0%, rgba(209, 250, 229, 0.94) 100%)",
      border: "rgba(22, 163, 74, 0.16)",
      shadow: "0 18px 36px rgba(22, 163, 74, 0.10)",
      badgeColor: "#15803D",
      badgeBackground: "rgba(22, 163, 74, 0.12)",
    };
  }
  if (status === "failed") {
    return {
      label: "失败",
      icon: <XCircle className="h-3.5 w-3.5" />,
      background: "linear-gradient(180deg, rgba(254, 242, 242, 0.98) 0%, rgba(254, 226, 226, 0.94) 100%)",
      border: "rgba(220, 38, 38, 0.14)",
      shadow: "0 18px 36px rgba(220, 38, 38, 0.08)",
      badgeColor: "#B91C1C",
      badgeBackground: "rgba(220, 38, 38, 0.12)",
    };
  }
  if (status === "running") {
    return {
      label: "运行中",
      icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
      background: "linear-gradient(180deg, rgba(239, 246, 255, 0.98) 0%, rgba(219, 234, 254, 0.94) 100%)",
      border: "rgba(37, 99, 235, 0.16)",
      shadow: "0 18px 38px rgba(37, 99, 235, 0.12)",
      badgeColor: "#1D4ED8",
      badgeBackground: "rgba(37, 99, 235, 0.12)",
    };
  }
  if (status === "pending") {
    return {
      label: "待命",
      icon: <Clock3 className="h-3.5 w-3.5" />,
      background: "linear-gradient(180deg, rgba(248, 250, 252, 0.98) 0%, rgba(241, 245, 249, 0.94) 100%)",
      border: "rgba(148, 163, 184, 0.2)",
      shadow: "0 16px 28px rgba(148, 163, 184, 0.08)",
      badgeColor: "#475569",
      badgeBackground: "rgba(148, 163, 184, 0.14)",
    };
  }
  return {
    label: "空闲",
    icon: <Sparkles className="h-3.5 w-3.5" />,
    background: "linear-gradient(180deg, rgba(248, 250, 252, 0.9) 0%, rgba(241, 245, 249, 0.82) 100%)",
    border: "rgba(203, 213, 225, 0.18)",
    shadow: "0 10px 20px rgba(148, 163, 184, 0.06)",
    badgeColor: "#64748B",
    badgeBackground: "rgba(148, 163, 184, 0.12)",
  };
}

function edgeTone(status: AgentGraphEdgeStatus) {
  if (status === "active") {
    return {
      label: "流转中",
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
      stroke: "#2563EB",
      background: "rgba(37, 99, 235, 0.12)",
    };
  }
  if (status === "failed") {
    return {
      label: "阻塞",
      icon: <XCircle className="h-3 w-3" />,
      stroke: "#DC2626",
      background: "rgba(220, 38, 38, 0.12)",
    };
  }
  if (status === "done") {
    return {
      label: "已流转",
      icon: <CheckCircle2 className="h-3 w-3" />,
      stroke: "#16A34A",
      background: "rgba(22, 163, 74, 0.12)",
    };
  }
  return {
    label: "未触发",
    icon: <Clock3 className="h-3 w-3" />,
    stroke: "#94A3B8",
    background: "rgba(148, 163, 184, 0.12)",
  };
}
