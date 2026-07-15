import { Badge, Card, CardHeader, CardTitle, IconButton } from "@research-copilot/ui";
import { FlaskConical, Link2, NotebookPen, Quote, Trash2 } from "lucide-react";
import { type KnowledgeGraphClaimBundle } from "./graphView";
import {
  CLAIM_STATUS_META,
  RELATION_META,
  sourceKindLabel,
} from "./shared";

function sourceIcon(kind: "paper" | "experiment" | "note") {
  if (kind === "paper") return Quote;
  if (kind === "experiment") return FlaskConical;
  return NotebookPen;
}

export default function KnowledgeClaimPanel({
  bundles,
  busy,
  onDeleteClaim,
  onDeleteEvidence,
}: {
  bundles: KnowledgeGraphClaimBundle[];
  busy?: boolean;
  onDeleteClaim: (id: string) => void;
  onDeleteEvidence: (id: string) => void;
}) {
  return (
    <Card padding="md">
      <CardHeader>
        <CardTitle>观点与证据对应关系</CardTitle>
      </CardHeader>

      {bundles.length === 0 ? (
        <p className="text-sm text-ink-tertiary">
          还没有结论节点。新增一条结论后，就可以把论文、实验或笔记挂到它下面形成证据链。
        </p>
      ) : (
        <div className="space-y-4">
          {bundles.map(({ claim, provenance, counts }) => {
            const meta = CLAIM_STATUS_META[claim.status];
            return (
              <div
                key={claim.id}
                className="knowledge-graph-claim-bundle rounded-[26px] px-5 py-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold text-ink-primary">{claim.title}</p>
                      <span
                        className={`knowledge-graph-claim-status knowledge-graph-claim-status--${claim.status} rounded-full px-2.5 py-0.5 text-[11px] font-semibold`}
                      >
                        {meta.label}
                      </span>
                      <Badge variant="default">{counts.paper} 篇论文</Badge>
                      <Badge variant="default">{counts.experiment} 个实验</Badge>
                      <Badge variant="default">{counts.note} 条笔记</Badge>
                    </div>
                    <p className="text-sm leading-6 text-ink-secondary">{claim.statement}</p>
                  </div>
                  <IconButton
                    disabled={busy}
                    onClick={() => onDeleteClaim(claim.id)}
                    aria-label="删除结论"
                    title="删除结论"
                    size="sm"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </IconButton>
                </div>

                <div className="knowledge-graph-evidence-list mt-4 space-y-3">
                  {provenance.length === 0 ? (
                    <div
                      className="knowledge-graph-evidence-empty rounded-2xl px-4 py-3 text-sm text-ink-tertiary"
                    >
                      这条结论还没有挂证据来源。
                    </div>
                  ) : (
                    provenance.map((item) => {
                      const Icon = sourceIcon(item.sourceKind);
                      const relation = RELATION_META[item.link.relationKind];
                      return (
                        <div
                          key={item.link.id}
                          className={`knowledge-graph-evidence-link knowledge-graph-evidence-link--${item.link.relationKind} rounded-2xl px-4 py-3`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <div
                                className="knowledge-graph-evidence-link__icon flex h-9 w-9 items-center justify-center rounded-2xl"
                              >
                                <Icon className="h-4 w-4" />
                              </div>
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-semibold text-ink-primary">{item.title}</p>
                                  <span
                                    className="knowledge-graph-relation-pill rounded-full px-2 py-0.5 text-[10px] font-semibold"
                                  >
                                    {relation.label}
                                  </span>
                                  <span className="text-[11px] text-ink-tertiary">
                                    {sourceKindLabel(item.sourceKind)}
                                  </span>
                                </div>
                                {item.subtitle ? (
                                  <p className="text-[11px] text-ink-tertiary">{item.subtitle}</p>
                                ) : null}
                                {item.detail ? (
                                  <p className="text-xs leading-5 text-ink-secondary">{item.detail}</p>
                                ) : null}
                              </div>
                            </div>

                            <IconButton
                              disabled={busy}
                              onClick={() => onDeleteEvidence(item.link.id)}
                              aria-label="解绑证据"
                              title="解绑证据"
                              size="sm"
                            >
                              <Link2 className="h-3.5 w-3.5" />
                            </IconButton>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
