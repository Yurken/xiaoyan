import { Badge, Card } from "@research-copilot/ui";
import { CcfRatingBadge, VenueTypeBadge } from "../../components/CcfBadges";
import ExternalLink from "../../components/ExternalLink";
import type { SurveyPaperResult } from "./shared";

export default function SurveyCandidatePapersPanel({ papers }: { papers: SurveyPaperResult[] }) {
  if (papers.length === 0) return null;

  return (
    <Card padding="sm" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink-primary">候选文献</p>
        <Badge variant="default">{papers.length} 篇</Badge>
      </div>
      <div className="space-y-2">
        {papers.map((paper, index) => (
          <div key={paper.id || `${paper.title}-${index}`} className="rounded-2xl border border-nm-dark/10 bg-white/40 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <ExternalLink href={paper.paper_url} className="text-sm font-medium text-ink-primary hover:text-apple-blue hover:underline">
                [{index + 1}] {paper.title}
              </ExternalLink>
              <CcfRatingBadge rating={paper.ccf_rating} />
              <VenueTypeBadge type={paper.ccf_type} />
            </div>
            <p className="mt-1 text-xs text-ink-tertiary">
              {paper.authors || "未知作者"}
              {paper.year ? ` · ${paper.year}` : ""}
              {paper.venue ? " · " : ""}
              {paper.venue ? (
                <ExternalLink href={paper.venue_url} className="text-xs text-ink-tertiary hover:text-apple-blue hover:underline">
                  {paper.venue}
                </ExternalLink>
              ) : null}
              {paper.ccf_area ? ` · ${paper.ccf_area}` : ""}
            </p>
            {paper.doi ? (
              <p className="mt-1 text-[11px] text-ink-tertiary">
                DOI:{" "}
                <ExternalLink href={`https://doi.org/${paper.doi}`} className="hover:text-apple-blue hover:underline">
                  {paper.doi}
                </ExternalLink>
              </p>
            ) : null}
            {paper.abstract ? <p className="mt-2 line-clamp-3 text-xs leading-5 text-ink-secondary">{paper.abstract}</p> : null}
          </div>
        ))}
      </div>
    </Card>
  );
}
