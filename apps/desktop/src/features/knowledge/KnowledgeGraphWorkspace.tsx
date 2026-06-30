import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Compass,
  GitBranch,
  Lightbulb,
  Link2,
  Maximize2,
  Minimize2,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import { Card, CardHeader, CardTitle, IconButton, Select } from "@research-copilot/ui";
import { IS_MACOS_DESKTOP, MACOS_WINDOW_DRAG_HEIGHT } from "../../lib/windowChrome";
import KnowledgeClaimPanel from "./KnowledgeClaimPanel";
import KnowledgeCitationPanel from "./KnowledgeCitationPanel";
import KnowledgeGraphCanvas from "./KnowledgeGraphCanvas";
import KnowledgeGraphComposer from "./KnowledgeGraphComposer";
import KnowledgeGraphInspector from "./KnowledgeGraphInspector";
import KnowledgeTimelinePanel from "./KnowledgeTimelinePanel";
import { buildInterestSelectOptions } from "./shared";
import { type KnowledgeGraphWorkspaceController } from "./useKnowledgeGraphWorkspace";

interface MetricTileProps {
  label: string;
  value: number;
  icon: LucideIcon;
  tone: {
    background: string;
    color: string;
  };
}

function MetricTile({ label, value, icon: Icon, tone }: MetricTileProps) {
  return (
    <div
      className="flex items-center gap-1.5 rounded-2xl px-3 py-1.5"
      style={{ background: "var(--rc-chip-bg)", boxShadow: "var(--rc-chip-shadow)" }}
    >
      <span
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg"
        style={{ background: tone.background, color: tone.color }}
      >
        <Icon className="h-3 w-3" />
      </span>
      <span className="text-lg font-bold tabular-nums" style={{ color: tone.color }}>
        {value}
      </span>
      <span className="text-[11px] text-ink-tertiary">{label}</span>
    </div>
  );
}

function GraphOverviewControls({
  activeInterestId,
  disabled,
  interestOptions,
  loading,
  onChangeInterest,
  onRefresh,
}: {
  activeInterestId: string | null;
  disabled: boolean;
  interestOptions: Array<{ value: string; label: string }>;
  loading: boolean;
  onChangeInterest: (value: string | null) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Select
        aria-label="聚焦研究主题"
        className="w-40"
        disabled={disabled}
        value={activeInterestId ?? ""}
        onChange={(value) => onChangeInterest(value || null)}
        options={interestOptions}
        placeholder="全部研究主题"
      />
      <IconButton
        className="shrink-0"
        onClick={onRefresh}
        disabled={disabled}
        aria-label="刷新图谱"
        title="刷新图谱"
        size="sm"
      >
        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
      </IconButton>
    </div>
  );
}

function GraphOverviewStrip({
  activeInterestId,
  disabled,
  interestOptions,
  loading,
  metrics,
  onChangeInterest,
  onRefresh,
}: {
  activeInterestId: string | null;
  disabled: boolean;
  interestOptions: Array<{ value: string; label: string }>;
  loading: boolean;
  metrics: Array<MetricTileProps>;
  onChangeInterest: (value: string | null) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-2">
        {metrics.map((item) => (
          <MetricTile key={item.label} {...item} />
        ))}
      </div>
      <GraphOverviewControls
        activeInterestId={activeInterestId}
        disabled={disabled}
        interestOptions={interestOptions}
        loading={loading}
        onChangeInterest={onChangeInterest}
        onRefresh={onRefresh}
      />
    </div>
  );
}

export default function KnowledgeGraphWorkspace({
  controller,
}: {
  controller: KnowledgeGraphWorkspaceController;
}) {
  const {
    snapshot,
    view,
    loading,
    busy,
    error,
    activeInterestId,
    setActiveInterestId,
    refresh,
    createClaim,
    deleteClaim,
    createEvidence,
    deleteEvidence,
    createCitation,
    deleteCitation,
  } = controller;

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isCanvasExpanded, setIsCanvasExpanded] = useState(false);

  useEffect(() => {
    if (!view) return;
    if (selectedNodeId && view.nodes.some((item) => item.id === selectedNodeId)) return;
    setSelectedNodeId(view.nodes[0]?.id ?? null);
  }, [selectedNodeId, view]);

  const interestOptions = useMemo(
    () => buildInterestSelectOptions(snapshot?.interests ?? []),
    [snapshot?.interests],
  );

  const metrics = useMemo(
    () => [
      {
        label: "研究主题",
        value: snapshot?.summary.interestCount ?? 0,
        icon: Compass,
        tone: { background: "rgba(0, 122, 255, 0.12)", color: "#007AFF" },
      },
      {
        label: "结论节点",
        value: snapshot?.summary.claimCount ?? 0,
        icon: Lightbulb,
        tone: { background: "rgba(52, 199, 89, 0.12)", color: "#2E7D32" },
      },
      {
        label: "证据关系",
        value: snapshot?.summary.evidenceCount ?? 0,
        icon: Link2,
        tone: { background: "rgba(255, 149, 0, 0.12)", color: "#B86A00" },
      },
      {
        label: "引用边",
        value: snapshot?.summary.citationCount ?? 0,
        icon: GitBranch,
        tone: { background: "rgba(88, 86, 214, 0.12)", color: "#5856D6" },
      },
    ],
    [snapshot?.summary.citationCount, snapshot?.summary.claimCount, snapshot?.summary.evidenceCount, snapshot?.summary.interestCount],
  );

  if (loading && !snapshot) {
    return (
      <Card padding="lg">
        <div className="flex items-center gap-3 text-sm text-ink-tertiary">
          <RefreshCw className="h-4 w-4 animate-spin" />
          正在构建知识图谱快照…
        </div>
      </Card>
    );
  }

  if (!snapshot || !view) {
    return (
      <Card padding="lg">
        <p className="text-sm text-ink-tertiary">暂时无法加载知识图谱。</p>
      </Card>
    );
  }

  return (
    <div className="mt-5 space-y-6">
      {error ? (
        <div
          className="flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm"
          style={{ borderColor: "rgba(255, 59, 48, 0.22)", background: "rgba(255, 59, 48, 0.08)" }}
        >
          <AlertCircle className="mt-0.5 h-4 w-4 text-apple-red" />
          <span className="text-ink-secondary">{error}</span>
        </div>
      ) : null}

      <GraphOverviewStrip
        activeInterestId={activeInterestId}
        disabled={loading || busy}
        interestOptions={interestOptions}
        loading={loading}
        metrics={metrics}
        onChangeInterest={setActiveInterestId}
        onRefresh={() => void refresh()}
      />

      <div className="grid gap-5 xl:grid-cols-[1.5fr,0.85fr]">
        <Card padding="md">
          <CardHeader>
            <CardTitle>关系总览</CardTitle>
            <IconButton
              onClick={() => setIsCanvasExpanded(true)}
              aria-label="最大化关系总览"
              title="最大化关系总览"
              size="sm"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </IconButton>
          </CardHeader>
          <KnowledgeGraphCanvas
            nodes={view.nodes}
            edges={view.edges}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
          />
        </Card>

        <KnowledgeGraphInspector
          snapshot={snapshot}
          claimBundles={view.claimBundles}
          selectedNodeId={selectedNodeId}
        />
      </div>

      <KnowledgeGraphComposer
        snapshot={snapshot}
        activeInterestId={activeInterestId}
        busy={busy}
        onCreateClaim={createClaim}
        onCreateEvidence={createEvidence}
        onCreateCitation={createCitation}
      />

      <div className="grid gap-5 xl:grid-cols-[1.2fr,0.8fr]">
        <KnowledgeClaimPanel
          bundles={view.claimBundles}
          busy={busy}
          onDeleteClaim={(id) => void deleteClaim(id)}
          onDeleteEvidence={(id) => void deleteEvidence(id)}
        />
        <KnowledgeCitationPanel
          citations={view.visibleCitations}
          papers={view.visiblePapers}
          busy={busy}
          onDeleteCitation={(id) => void deleteCitation(id)}
        />
      </div>

      <KnowledgeTimelinePanel entries={view.timelineEntries} />

      {isCanvasExpanded ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{
            background: "rgba(15, 23, 42, 0.18)",
            backdropFilter: "blur(10px)",
            paddingTop: IS_MACOS_DESKTOP ? `calc(1.5rem + ${MACOS_WINDOW_DRAG_HEIGHT}px)` : undefined,
          }}
        >
          <div
            className="flex h-full w-full max-w-[1440px] flex-col rounded-[32px] p-5"
            style={{
              background: "var(--rc-card-bg)",
              border: "1px solid var(--rc-card-outline)",
              boxShadow: "var(--rc-card-shadow)",
            }}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-ink-primary">关系总览</p>
                <p className="mt-1 text-xs text-ink-tertiary">Ctrl/⌘ + 滚轮缩放，拖动画布平移。</p>
              </div>
              <IconButton
                onClick={() => setIsCanvasExpanded(false)}
                aria-label="退出最大化"
                title="退出最大化"
                size="sm"
              >
                <Minimize2 className="h-3.5 w-3.5" />
              </IconButton>
            </div>

            <div className="min-h-0 flex-1">
              <KnowledgeGraphCanvas
                nodes={view.nodes}
                edges={view.edges}
                selectedNodeId={selectedNodeId}
                onSelectNode={setSelectedNodeId}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
