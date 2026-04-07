import { AlertCircle, FileSearch, Search } from "lucide-react";
import { Badge, Button, Card, Input } from "@research-copilot/ui";
import type { SourceLookupSection } from "@research-copilot/types";
import { CasQuartileBadge, CasTopBadge, CcfRatingBadge, JcrQuartileBadge, VenueTypeBadge, WosIndexBadge } from "../../components/CcfBadges";
import ExternalLink from "../../components/ExternalLink";

interface SourceLookupPanelProps {
  query: string;
  sections: SourceLookupSection[];
  loading: boolean;
  error: string;
  searched: boolean;
  onQueryChange: (value: string) => void;
  onSubmit: () => void | Promise<void>;
}

export function SourceLookupPanel({
  query,
  sections,
  loading,
  error,
  searched,
  onQueryChange,
  onSubmit,
}: SourceLookupPanelProps) {
  const journalSection = sections.find((section) => section.key === "journal_partition");
  const ccfSection = sections.find((section) => section.key === "ccf");

  return (
    <>
      <Card padding="md" className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-apple-blue/10 text-apple-blue">
            <FileSearch className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-ink-primary">刊会查询</p>
            <p className="mt-1 text-xs text-ink-tertiary">输入期刊或会议名称，小妍帮你查 CCF 等级、SCI 分区和期刊影响因子。</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="flex-1">
            <Input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void onSubmit();
                }
              }}
              placeholder="请输入会议、期刊名称或 ISSN"
            />
          </div>
          <Button onClick={() => void onSubmit()} loading={loading} disabled={!query.trim()}>
            <Search className="h-4 w-4" />
            查询
          </Button>
        </div>

        {error ? (
          <div className="flex items-start gap-2 rounded-2xl border border-apple-red/10 bg-[#F7ECEA] px-3 py-2 text-sm text-apple-red">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}
      </Card>

      {journalSection && journalSection.items.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="info">{journalSection.title}</Badge>
            <p className="text-sm font-semibold text-ink-primary">WoS / JCR / 中科院</p>
          </div>
          {journalSection.items.map((item, index) => (
            <Card key={`${item.source}-${item.name}-${item.issn}-${index}`} padding="sm" className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-ink-primary">{item.name}</p>
                {item.indexes.map((indexName) => (
                  <WosIndexBadge key={`${item.name}-${indexName}`} index={indexName} />
                ))}
                <JcrQuartileBadge quartile={item.jcr_quartile} />
                <CasQuartileBadge quartile={item.cas_quartile} />
                <CasTopBadge top={item.cas_top} />
                {item.open_access ? <Badge variant="success">OA</Badge> : null}
              </div>
              <p className="text-xs leading-5 text-ink-secondary">
                {[item.publisher, item.issn ? `ISSN ${item.issn}` : "", item.eissn ? `eISSN ${item.eissn}` : ""]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <p className="text-xs leading-5 text-ink-tertiary">
                {[item.jcr_category, item.jif ? `JIF ${item.jif}` : "", item.jif_rank ? `排名 ${item.jif_rank}` : ""]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {item.wos_categories.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {item.wos_categories.slice(0, 6).map((category) => (
                    <Badge key={`${item.name}-${category}`} variant="default">
                      {category}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      ) : null}

      {ccfSection && ccfSection.items.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="info">{ccfSection.title}</Badge>
            <p className="text-sm font-semibold text-ink-primary">会议 / 期刊推荐级别</p>
          </div>
          {ccfSection.items.map((item, index) => (
            <Card key={`${item.source}-${item.name}-${index}`} padding="sm" className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <ExternalLink
                  href={item.url}
                  className="text-sm font-semibold text-ink-primary hover:text-apple-blue hover:underline"
                >
                  {item.name}
                </ExternalLink>
                <CcfRatingBadge rating={item.rating} />
                <VenueTypeBadge type={item.entity_type} />
                {item.label ? <Badge variant="default">{item.label}</Badge> : null}
              </div>
              <p className="text-xs leading-5 text-ink-secondary">
                {item.area}
                {item.publisher ? ` · ${item.publisher}` : ""}
              </p>
            </Card>
          ))}
        </div>
      ) : null}

      {searched && !loading && !error && sections.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-16 text-center">
          <Search className="h-8 w-8 text-ink-tertiary" />
          <div>
            <p className="font-medium text-ink-secondary">没有匹配结果</p>
            <p className="mt-1 text-sm text-ink-tertiary">建议改用更完整的期刊名、会议全称或 ISSN 重试。</p>
          </div>
        </Card>
      ) : null}
    </>
  );
}
