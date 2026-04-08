import { useEffect, useState } from "react";
import { AlertCircle, Maximize2, Minimize2, RefreshCw } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@research-copilot/ui";
import KnowledgeClaimPanel from "./KnowledgeClaimPanel";
import KnowledgeCitationPanel from "./KnowledgeCitationPanel";
import KnowledgeGraphCanvas from "./KnowledgeGraphCanvas";
import KnowledgeGraphComposer from "./KnowledgeGraphComposer";
import KnowledgeGraphInspector from "./KnowledgeGraphInspector";
import KnowledgeTimelinePanel from "./KnowledgeTimelinePanel";
import { type KnowledgeGraphWorkspaceController } from "./useKnowledgeGraphWorkspace";

function MetricTile({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="rounded-[26px] border p-2"
      style={{
        borderColor: "var(--rc-border)",
        background: "var(--rc-panel-bg-soft, rgba(255,255,255,0.54))",
      }}
    >
      <div
        className="rc-muted-panel rounded-[22px] px-5 py-4"
        style={{
          boxShadow: "var(--rc-card-inset-shadow), inset 0 1px 0 rgb(255 255 255 / 0.45)",
        }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-tertiary">{label}</p>
        <p className="mt-3 text-[2.15rem] font-semibold leading-none text-ink-primary tabular-nums">{value}</p>
      </div>
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
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-ink-primary">知识图谱</h2>
          <p className="mt-1 text-sm text-ink-tertiary">
            把研究方向、论文、结论和实验串成可追溯关系网，回答“这个判断到底来自哪里”。
          </p>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading || busy}
            aria-label="刷新图谱"
            title="刷新图谱"
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              background: "var(--rc-control-bg)",
              border: "1px solid var(--rc-control-border)",
              boxShadow: "var(--rc-control-shadow)",
              color: "var(--rc-text)",
            }}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {error ? (
        <div
          className="flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm"
          style={{ borderColor: "rgba(255, 59, 48, 0.22)", background: "rgba(255, 59, 48, 0.08)" }}
        >
          <AlertCircle className="mt-0.5 h-4 w-4 text-apple-red" />
          <span className="text-ink-secondary">{error}</span>
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="研究方向" value={snapshot.summary.interestCount} />
        <MetricTile label="结论节点" value={snapshot.summary.claimCount} />
        <MetricTile label="证据关系" value={snapshot.summary.evidenceCount} />
        <MetricTile label="引用边" value={snapshot.summary.citationCount} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.5fr,0.85fr]">
        <Card padding="md">
          <CardHeader>
            <CardTitle>关系总览</CardTitle>
            <button
              type="button"
              onClick={() => setIsCanvasExpanded(true)}
              aria-label="最大化关系总览"
              title="最大化关系总览"
              className="inline-flex h-9 w-9 items-center justify-center rounded-2xl transition-colors"
              style={{
                background: "var(--rc-panel-bg-soft, rgba(255,255,255,0.6))",
                border: "1px solid var(--rc-border)",
                color: "var(--rc-text-secondary, var(--rc-text))",
              }}
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
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
          style={{ background: "rgba(15, 23, 42, 0.18)", backdropFilter: "blur(10px)" }}
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
                <p className="mt-1 text-xs text-ink-tertiary">滚轮缩放，拖动画布平移。</p>
              </div>
              <button
                type="button"
                onClick={() => setIsCanvasExpanded(false)}
                aria-label="退出最大化"
                title="退出最大化"
                className="inline-flex h-9 w-9 items-center justify-center rounded-2xl transition-colors"
                style={{
                  background: "var(--rc-panel-bg-soft, rgba(255,255,255,0.6))",
                  border: "1px solid var(--rc-border)",
                  color: "var(--rc-text-secondary, var(--rc-text))",
                }}
              >
                <Minimize2 className="h-3.5 w-3.5" />
              </button>
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
