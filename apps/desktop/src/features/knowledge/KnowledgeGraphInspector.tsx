import { Badge, Card, CardHeader, CardTitle } from "@research-copilot/ui";
import { type KnowledgeGraphClaimBundle } from "./graphView";
import { CLAIM_STATUS_META, interestDisplayName, sourceKindLabel, truncateText, type KnowledgeGraphSnapshot } from "./shared";

export default function KnowledgeGraphInspector({
  snapshot,
  claimBundles,
  selectedNodeId,
}: {
  snapshot: KnowledgeGraphSnapshot;
  claimBundles: KnowledgeGraphClaimBundle[];
  selectedNodeId: string | null;
}) {
  if (!selectedNodeId) {
    return (
      <Card padding="md">
        <CardHeader>
          <CardTitle>图节点详情</CardTitle>
        </CardHeader>
        <p className="text-sm text-ink-tertiary">
          点击上面的图节点，可以查看这条方向、结论、论文或实验在图谱中的位置。
        </p>
      </Card>
    );
  }

  const [kind, entityId] = selectedNodeId.split(":");
  const interestMap = new Map(snapshot.interests.map((item) => [item.id, item]));
  const paperMap = new Map(snapshot.papers.map((item) => [item.id, item]));
  const noteMap = new Map(snapshot.notes.map((item) => [item.id, item]));
  const experimentMap = new Map(snapshot.experiments.map((item) => [item.id, item]));

  if (kind === "claim") {
    const bundle = claimBundles.find((item) => item.claim.id === entityId);
    if (!bundle) return null;
    const meta = CLAIM_STATUS_META[bundle.claim.status];
    return (
      <Card padding="md">
        <CardHeader>
          <CardTitle>图节点详情</CardTitle>
        </CardHeader>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold text-ink-primary">{bundle.claim.title}</p>
            <span
              className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
              style={{ background: meta.tone, color: "var(--rc-text)" }}
            >
              {meta.label}
            </span>
          </div>
          <p className="text-sm leading-6 text-ink-secondary">{bundle.claim.statement}</p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="default">{bundle.counts.paper} 篇论文</Badge>
            <Badge variant="default">{bundle.counts.experiment} 个实验</Badge>
            <Badge variant="default">{bundle.counts.note} 条笔记</Badge>
          </div>
          {bundle.provenance.length > 0 ? (
            <div className="space-y-2">
              {bundle.provenance.slice(0, 4).map((item) => (
                <div
                  key={item.link.id}
                  className="knowledge-graph-provenance rounded-2xl px-3 py-2"
                >
                  <p className="text-sm font-medium text-ink-primary">{item.title}</p>
                  <p className="text-xs text-ink-tertiary">{sourceKindLabel(item.sourceKind)}</p>
                  {item.detail ? <p className="mt-1 text-xs leading-5 text-ink-secondary">{item.detail}</p> : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </Card>
    );
  }

  if (kind === "interest") {
    const interest = interestMap.get(entityId);
    if (!interest) return null;
    return (
      <Card padding="md">
        <CardHeader>
          <CardTitle>图节点详情</CardTitle>
        </CardHeader>
        <div className="space-y-3">
          <p className="text-base font-semibold text-ink-primary">{interestDisplayName(interest)}</p>
          <p className="text-sm text-ink-secondary">{interest.topic}</p>
          <div className="flex flex-wrap gap-2">
            {interest.keywords.map((item) => (
              <Badge key={item} variant="default">{item}</Badge>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  if (kind === "paper") {
    const paper = paperMap.get(entityId);
    if (!paper) return null;
    return (
      <Card padding="md">
        <CardHeader>
          <CardTitle>图节点详情</CardTitle>
        </CardHeader>
        <div className="space-y-3">
          <p className="text-base font-semibold text-ink-primary">{paper.title}</p>
          <p className="text-sm text-ink-tertiary">{[paper.year, paper.venue, paper.authors].filter(Boolean).join(" · ")}</p>
          <p className="text-sm leading-6 text-ink-secondary">
            {truncateText(paper.keyConclusions || paper.notes || "这篇论文已进入图谱，但还没有补充分析或笔记。", 220)}
          </p>
        </div>
      </Card>
    );
  }

  if (kind === "experiment") {
    const experiment = experimentMap.get(entityId);
    if (!experiment) return null;
    return (
      <Card padding="md">
        <CardHeader>
          <CardTitle>图节点详情</CardTitle>
        </CardHeader>
        <div className="space-y-3">
          <p className="text-base font-semibold text-ink-primary">{experiment.title}</p>
          <p className="text-sm leading-6 text-ink-secondary">
            {truncateText(experiment.result || experiment.notes || "实验节点已加入图谱。", 220)}
          </p>
        </div>
      </Card>
    );
  }

  const note = noteMap.get(entityId);
  if (!note) return null;

  return (
    <Card padding="md">
      <CardHeader>
        <CardTitle>图节点详情</CardTitle>
      </CardHeader>
      <div className="space-y-3">
        <p className="text-base font-semibold text-ink-primary">{note.title}</p>
        <p className="text-sm text-ink-tertiary">{note.sourceType === "web_clip" ? "网页摘录" : "知识笔记"}</p>
        <p className="text-sm leading-6 text-ink-secondary">{truncateText(note.content, 220)}</p>
      </div>
    </Card>
  );
}
