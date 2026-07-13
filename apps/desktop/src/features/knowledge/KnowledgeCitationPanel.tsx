import { Button, Card, CardHeader, CardTitle } from "@research-copilot/ui";
import { ArrowRight, Trash2 } from "lucide-react";
import { type KnowledgeGraphCitation, type KnowledgeGraphPaper, truncateText } from "./shared";

export default function KnowledgeCitationPanel({
  citations,
  papers,
  busy,
  onDeleteCitation,
}: {
  citations: KnowledgeGraphCitation[];
  papers: KnowledgeGraphPaper[];
  busy?: boolean;
  onDeleteCitation: (id: string) => void;
}) {
  const paperMap = new Map(papers.map((item) => [item.id, item]));

  return (
    <Card padding="md">
      <CardHeader>
        <CardTitle>论文之间的引用关系</CardTitle>
      </CardHeader>

      {citations.length === 0 ? (
        <p className="text-sm text-ink-tertiary">
          目前还没有显式记录引用边。你可以手动把关键论文串起来，形成更可靠的阅读脉络。
        </p>
      ) : (
        <div className="space-y-3">
          {citations.map((citation) => {
            const citing = paperMap.get(citation.citingPaperId);
            const cited = paperMap.get(citation.citedPaperId);

            if (!citing || !cited) return null;

            return (
              <div
                key={citation.id}
                className="knowledge-graph-citation-card rounded-2xl px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="knowledge-graph-citation-route flex items-center gap-2 text-sm font-semibold text-ink-primary">
                      <span className="knowledge-graph-citation-route__paper">{truncateText(citing.title, 54)}</span>
                      <span className="knowledge-graph-citation-route__arrow"><ArrowRight className="h-3.5 w-3.5" /></span>
                      <span className="knowledge-graph-citation-route__paper">{truncateText(cited.title, 54)}</span>
                    </div>
                    <p className="knowledge-graph-citation-meta text-xs text-ink-tertiary">
                      <span>{[citing.year, citing.venue].filter(Boolean).join(" · ") || "引用论文"}</span>
                      <ArrowRight className="h-3 w-3" />
                      <span>{[cited.year, cited.venue].filter(Boolean).join(" · ") || "被引论文"}</span>
                    </p>
                    {citation.context ? (
                      <p className="text-xs leading-5 text-ink-secondary">{citation.context}</p>
                    ) : null}
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => onDeleteCitation(citation.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    删除
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
