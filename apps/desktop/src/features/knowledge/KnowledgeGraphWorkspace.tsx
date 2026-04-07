import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button, Card, CardHeader, CardTitle } from "@research-copilot/ui";
import KnowledgeClaimPanel from "./KnowledgeClaimPanel";
import KnowledgeCitationPanel from "./KnowledgeCitationPanel";
import KnowledgeGraphCanvas from "./KnowledgeGraphCanvas";
import KnowledgeGraphComposer from "./KnowledgeGraphComposer";
import KnowledgeGraphInspector from "./KnowledgeGraphInspector";
import KnowledgeTimelinePanel from "./KnowledgeTimelinePanel";
import { useKnowledgeGraphWorkspace } from "./useKnowledgeGraphWorkspace";
import { interestDisplayName } from "./shared";

const SELECT_STYLE: CSSProperties = {
  width: "100%",
  borderRadius: "1rem",
  border: "1px solid var(--rc-control-border)",
  background: "var(--rc-control-bg)",
  boxShadow: "var(--rc-control-shadow)",
  color: "var(--rc-text)",
  padding: "0.7rem 0.95rem",
  fontSize: "0.875rem",
  outline: "none",
};

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="ml-1 text-xs font-medium text-ink-tertiary">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} style={SELECT_STYLE}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function MetricTile({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="rounded-[24px] border px-4 py-4"
      style={{ borderColor: "var(--rc-border)", background: "var(--rc-panel-bg-soft, rgba(255,255,255,0.54))" }}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-tertiary">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-ink-primary">{value}</p>
    </div>
  );
}

export default function KnowledgeGraphWorkspace() {
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
  } = useKnowledgeGraphWorkspace();

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  useEffect(() => {
    if (!view) return;
    if (selectedNodeId && view.nodes.some((item) => item.id === selectedNodeId)) return;
    setSelectedNodeId(view.nodes[0]?.id ?? null);
  }, [selectedNodeId, view]);

  const interestOptions = useMemo(
    () => [
      { value: "", label: "全部研究方向" },
      ...(snapshot?.interests ?? []).map((item) => ({
        value: item.id,
        label: interestDisplayName(item),
      })),
    ],
    [snapshot?.interests],
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
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-ink-primary">知识图谱</h2>
          <p className="mt-1 text-sm text-ink-tertiary">
            把研究方向、论文、结论和实验串成可追溯关系网，回答“这个判断到底来自哪里”。
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 md:w-[360px]">
          <SelectField
            label="聚焦研究方向"
            value={activeInterestId ?? ""}
            onChange={(value) => setActiveInterestId(value || null)}
            options={interestOptions}
          />
          <Button variant="secondary" size="sm" onClick={() => void refresh()} disabled={loading || busy}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            刷新图谱
          </Button>
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
    </div>
  );
}
