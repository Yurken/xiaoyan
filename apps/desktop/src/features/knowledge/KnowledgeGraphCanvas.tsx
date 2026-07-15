import { useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from "react";
import { type KnowledgeGraphCanvasEdge } from "./graphView";
import { computeKnowledgeGraphCanvasHeight, computeKnowledgeGraphEdgeGeometry, type KnowledgeGraphCanvasNode } from "./knowledgeGraphLayout";
import { useElementWidth } from "../../hooks/useElementWidth";

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
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const dragStateRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number; moved: boolean } | null>(null);
  const [containerRef, containerWidth] = useElementWidth<HTMLDivElement>();
  const nodeMap = new Map(nodes.map((item) => [item.id, item]));
  const height = computeKnowledgeGraphCanvasHeight(nodes);
  const viewWidth = 1000;
  const laneLabels = [
    { key: "interest", label: "研究主题", x: "12%" },
    { key: "claim", label: "观点 / 结论", x: "42%" },
    { key: "evidence", label: "论文 / 实验 / 笔记", x: "75%" },
  ];

  if (nodes.length === 0) {
    return (
      <div
        className="knowledge-graph-empty rounded-3xl px-5 py-10 text-center text-sm text-ink-secondary"
      >
        当前还没有可视化关系。先新增一条结论，或把论文、实验、笔记绑定为证据。
      </div>
    );
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: offset.x,
      originY: offset.y,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    const nextX = dragState.originX + event.clientX - dragState.startX;
    const nextY = dragState.originY + event.clientY - dragState.startY;
    if (!dragState.moved && (Math.abs(nextX - dragState.originX) > 3 || Math.abs(nextY - dragState.originY) > 3)) {
      dragState.moved = true;
    }
    setOffset({ x: nextX, y: nextY });
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    dragStateRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    // 只在按住 Ctrl/⌘ 时缩放（macOS 触控板 pinch 也会带 ctrlKey），
    // 普通滚轮放行，让外层页面正常滚动。
    if (!(event.ctrlKey || event.metaKey)) return;
    event.preventDefault();
    event.stopPropagation();
    const delta = event.deltaY < 0 ? 0.08 : -0.08;
    setScale((prev) => Math.max(0.6, Math.min(2.2, Number((prev + delta).toFixed(2)))));
  };

  return (
    <div
      ref={containerRef}
      className="knowledge-graph-canvas relative overflow-hidden rounded-[28px] border select-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
      style={{
        height,
        cursor: dragStateRef.current ? "grabbing" : "grab",
      }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16">
        {laneLabels.map((lane) => (
          <div
            key={lane.key}
            className="knowledge-graph-lane absolute top-4 -translate-x-1/2 rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide"
            style={{
              left: lane.x,
            }}
          >
            {lane.label}
          </div>
        ))}
      </div>

      <div
        className="absolute inset-0"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transformOrigin: "center center",
          transition: dragStateRef.current ? "none" : "transform 0.08s ease-out",
        }}
      >
        <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${viewWidth} ${height}`} preserveAspectRatio="none" aria-hidden="true">
          {edges.map((edge) => {
            const from = nodeMap.get(edge.from);
            const to = nodeMap.get(edge.to);
            if (!from || !to) return null;
            const geo = computeKnowledgeGraphEdgeGeometry(from, to, containerWidth, viewWidth);

            return (
              <path
                key={edge.id}
                d={`M ${geo.startX} ${geo.startY} Q ${geo.controlX} ${geo.controlY} ${geo.endX} ${geo.endY}`}
                fill="none"
                className={`knowledge-graph-edge knowledge-graph-edge--${edge.kind}`}
                strokeWidth={edge.kind === "citation" ? 1.4 : 1.8}
                strokeDasharray={edge.kind === "citation" ? "6 5" : edge.kind === "belongs" ? "4 7" : undefined}
              />
            );
          })}
        </svg>

        {nodes.map((node) => {
          const active = selectedNodeId === node.id;

          return (
            <button
              key={node.id}
              type="button"
              aria-pressed={active}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => {
                if (dragStateRef.current?.moved) return;
                onSelectNode?.(node.id);
              }}
              className={`knowledge-graph-node knowledge-graph-node--${node.kind} absolute -translate-x-1/2 rounded-2xl border px-4 py-3 text-left transition-all duration-150 hover:-translate-y-0.5`}
              style={{
                width: node.width,
                minHeight: node.height,
                left: `${node.x}%`,
                top: node.y,
                cursor: "pointer",
              }}
            >
              <p className="knowledge-graph-node__title line-clamp-2 text-sm font-semibold">
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
    </div>
  );
}
