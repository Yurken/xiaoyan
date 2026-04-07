import { type KnowledgeGraphCanvasEdge, type KnowledgeGraphCanvasNode } from "./graphView";

const KIND_STYLES = {
  interest: { fill: "rgba(0, 122, 255, 0.12)", border: "rgba(0, 122, 255, 0.26)", color: "#0F4FA8" },
  claim: { fill: "rgba(40, 82, 58, 0.12)", border: "rgba(40, 82, 58, 0.24)", color: "#215137" },
  paper: { fill: "rgba(107, 76, 154, 0.11)", border: "rgba(107, 76, 154, 0.2)", color: "#5A3C90" },
  experiment: { fill: "rgba(198, 110, 20, 0.12)", border: "rgba(198, 110, 20, 0.22)", color: "#9A570A" },
  note: { fill: "rgba(86, 94, 108, 0.12)", border: "rgba(86, 94, 108, 0.18)", color: "#495466" },
} as const;

function edgeColor(kind: KnowledgeGraphCanvasEdge["kind"]) {
  if (kind === "evidence") return "rgba(42, 99, 65, 0.34)";
  if (kind === "citation") return "rgba(121, 92, 170, 0.3)";
  return "rgba(0, 122, 255, 0.18)";
}

export default function KnowledgeGraphCanvas({
  nodes,
  edges,
  selectedNodeId,
  onSelectNode,
}: {
  nodes: KnowledgeGraphCanvasNode[];
  edges: KnowledgeGraphCanvasEdge[];
  selectedNodeId?: string | null;
  onSelectNode?: (id: string) => void;
}) {
  if (nodes.length === 0) {
    return (
      <div
        className="rounded-3xl border px-5 py-10 text-center text-sm"
        style={{ borderColor: "var(--rc-border)", background: "var(--rc-panel-bg-soft, rgba(255,255,255,0.58))" }}
      >
        当前还没有可视化关系。先新增一条结论，或把论文、实验、笔记绑定为证据。
      </div>
    );
  }

  const nodeMap = new Map(nodes.map((item) => [item.id, item]));
  const height = Math.max(320, Math.max(...nodes.map((item) => item.y)) + 96);
  const viewWidth = 1000;
  const laneLabels = [
    { key: "interest", label: "研究方向", x: "12%" },
    { key: "claim", label: "观点 / 结论", x: "42%" },
    { key: "evidence", label: "论文 / 实验 / 笔记", x: "75%" },
  ];

  return (
    <div
      className="relative overflow-hidden rounded-[28px] border"
      style={{
        height,
        borderColor: "var(--rc-border)",
        background:
          "radial-gradient(circle at top left, rgba(0,122,255,0.06), transparent 28%), linear-gradient(180deg, rgba(255,255,255,0.72), rgba(255,255,255,0.52))",
      }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16">
        {laneLabels.map((lane) => (
          <div
            key={lane.key}
            className="absolute top-4 -translate-x-1/2 rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide"
            style={{
              left: lane.x,
              color: "var(--rc-text-muted)",
              background: "rgba(255,255,255,0.78)",
              border: "1px solid rgba(15, 23, 42, 0.06)",
            }}
          >
            {lane.label}
          </div>
        ))}
      </div>

      <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${viewWidth} ${height}`} preserveAspectRatio="none" aria-hidden="true">
        {edges.map((edge) => {
          const from = nodeMap.get(edge.from);
          const to = nodeMap.get(edge.to);
          if (!from || !to) return null;

          const startX = (from.x / 100) * viewWidth;
          const startY = from.y + 28;
          const endX = (to.x / 100) * viewWidth;
          const endY = to.y + 28;
          const controlX = ((from.x + to.x) / 200) * viewWidth;
          const controlY = from.kind === "paper" && to.kind === "paper"
            ? Math.min(startY, endY) - 36
            : (startY + endY) / 2;

          return (
            <path
              key={edge.id}
              d={`M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`}
              fill="none"
              stroke={edgeColor(edge.kind)}
              strokeWidth={edge.kind === "citation" ? 1.4 : 1.8}
              strokeDasharray={edge.kind === "citation" ? "6 5" : edge.kind === "belongs" ? "4 7" : undefined}
            />
          );
        })}
      </svg>

      {nodes.map((node) => {
        const kindStyle = KIND_STYLES[node.kind];
        const active = selectedNodeId === node.id;

        return (
          <button
            key={node.id}
            type="button"
            onClick={() => onSelectNode?.(node.id)}
            className="absolute w-[188px] -translate-x-1/2 rounded-2xl border px-4 py-3 text-left transition-all duration-150 hover:-translate-y-0.5"
            style={{
              left: `${node.x}%`,
              top: node.y,
              background: kindStyle.fill,
              borderColor: active ? kindStyle.color : kindStyle.border,
              boxShadow: active
                ? `0 16px 34px ${kindStyle.fill}, 0 0 0 1px ${kindStyle.color}`
                : "0 10px 24px rgba(15, 23, 42, 0.06)",
            }}
          >
            <p className="line-clamp-2 text-sm font-semibold" style={{ color: kindStyle.color }}>
              {node.title}
            </p>
            {node.subtitle ? (
              <p className="mt-1 line-clamp-2 text-[11px]" style={{ color: "var(--rc-text-muted)" }}>
                {node.subtitle}
              </p>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
