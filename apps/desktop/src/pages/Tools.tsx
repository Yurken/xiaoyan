import { useState } from "react";
import { AlertCircle, Search, Wrench } from "lucide-react";
import { Badge, Button, Card, Input } from "@research-copilot/ui";
import type { CcfEntry } from "@research-copilot/types";
import { CcfRatingBadge, VenueTypeBadge } from "../components/CcfBadges";
import { apiClient, formatErrorMessage } from "../lib/client";

export default function Tools() {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<CcfEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  const handleLookup = async () => {
    if (!query.trim() || loading) return;

    try {
      setLoading(true);
      setError("");
      setSearched(true);
      const result = await apiClient.ccf.lookup(query.trim(), 10);
      setMatches(result.matches ?? []);
    } catch (nextError) {
      setMatches([]);
      setError(formatErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ink-primary">实用工具</h1>
        <p className="mt-1 text-sm text-ink-tertiary">
          输入期刊或会议简称、全称，立即查询 CCF 评级、类别与所属领域。
        </p>
      </div>

      <Card padding="md" className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-apple-blue/10 text-apple-blue">
            <Wrench className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-ink-primary">CCF 评级查询</p>
            <p className="mt-1 text-xs text-ink-tertiary">支持示例：`CVPR`、`TKDE`、`ACM SIGMOD Conference`。</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="flex-1">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void handleLookup();
                }
              }}
              placeholder="输入会议或期刊名称"
            />
          </div>
          <Button onClick={() => void handleLookup()} loading={loading} disabled={!query.trim()}>
            <Search className="h-4 w-4" />
            查询 CCF
          </Button>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-2xl border border-apple-red/10 bg-[#F7ECEA] px-3 py-2 text-sm text-apple-red">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </Card>

      {matches.length > 0 ? (
        <div className="space-y-3">
          {matches.map((match, index) => (
            <Card key={`${match.full_name}-${index}`} padding="sm" className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-ink-primary">{match.full_name}</p>
                <CcfRatingBadge rating={match.rating} />
                <VenueTypeBadge type={match.kind} />
                {match.label && <Badge variant="default">{match.label}</Badge>}
              </div>
              <p className="text-xs leading-5 text-ink-secondary">
                {match.area}
                {match.publisher ? ` · ${match.publisher}` : ""}
              </p>
            </Card>
          ))}
        </div>
      ) : searched && !loading && !error ? (
        <Card className="flex flex-col items-center gap-3 py-16 text-center">
          <Search className="h-8 w-8 text-ink-tertiary" />
          <div>
            <p className="font-medium text-ink-secondary">没有匹配结果</p>
            <p className="mt-1 text-sm text-ink-tertiary">建议改用官方简称或更完整的全称重试。</p>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
