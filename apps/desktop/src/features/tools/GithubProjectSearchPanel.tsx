import { AlertCircle, Github, History, Search, Star, Trash2 } from "lucide-react";
import { Badge, Button, Card, Input } from "@research-copilot/ui";
import type { GithubProjectSearchResponse, GithubProjectSearchHistoryEntry } from "@research-copilot/types";
import ExternalLink from "../../components/ExternalLink";

interface GithubProjectSearchPanelProps {
  query: string;
  result: GithubProjectSearchResponse | null;
  loading: boolean;
  error: string;
  searched: boolean;
  history: GithubProjectSearchHistoryEntry[];
  historyLoading: boolean;
  onQueryChange: (value: string) => void;
  onSubmit: () => void | Promise<void>;
  onApplyHistory: (entry: GithubProjectSearchHistoryEntry) => void;
  onRemoveHistory: (id: string) => void | Promise<void>;
}

function formatStars(count: number): string {
  if (count >= 10000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return count.toString();
}

function formatDate(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("zh-CN");
}

export function GithubProjectSearchPanel({
  query,
  result,
  loading,
  error,
  searched,
  history,
  historyLoading,
  onQueryChange,
  onSubmit,
  onApplyHistory,
  onRemoveHistory,
}: GithubProjectSearchPanelProps) {
  return (
    <div className="space-y-4">
      <Card padding="md" className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-apple-blue/10 text-apple-blue">
            <Github className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-ink-primary">GitHub 项目检索</p>
            <p className="mt-1 text-xs text-ink-tertiary">输入研究主题或关键词，小妍帮你检索最相关的开源项目。未配置 Token 时会自动降级为联网搜索。</p>
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
              placeholder="例如：diffusion model image generation"
            />
          </div>
          <Button onClick={() => void onSubmit()} loading={loading} disabled={!query.trim()}>
            <Search className="h-4 w-4" />
            检索
          </Button>
        </div>

        {error ? (
          <div className="flex items-start gap-2 rounded-2xl border border-apple-red/10 bg-[#F7ECEA] px-3 py-2 text-sm text-apple-red">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        {history.length > 0 || historyLoading ? (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-ink-secondary">
              <History className="h-3.5 w-3.5" />
              <span>历史搜索</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {historyLoading && history.length === 0 ? (
                <span className="text-xs text-ink-tertiary">加载中...</span>
              ) : null}
              {history.map((entry) => (
                <div
                  key={entry.id}
                  className="group inline-flex max-w-full items-center gap-1.5 rounded-xl border border-apple-blue/15 bg-apple-blue/5 px-2.5 py-1 text-xs text-ink-secondary transition-colors hover:border-apple-blue/30 hover:bg-apple-blue/10"
                >
                  <button
                    type="button"
                    onClick={() => onApplyHistory(entry)}
                    className="min-w-0 truncate text-left"
                    title={entry.query}
                  >
                    {entry.query}
                  </button>
                  <button
                    type="button"
                    onClick={() => void onRemoveHistory(entry.id)}
                    className="shrink-0 rounded p-0.5 text-ink-tertiary opacity-60 transition-opacity hover:text-apple-red hover:opacity-100"
                    title="删除该条历史"
                    aria-label="删除该条历史"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </Card>

      {result ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info">{result.provider === "github_api" ? "GitHub API" : "联网搜索"}</Badge>
            <span className="text-xs text-ink-tertiary">候选 {result.candidate_count} · {result.llm_used ? "模型精排" : "启发式排序"}</span>
          </div>

          {result.overall_summary ? (
            <Card padding="sm" className="text-sm text-ink-secondary">
              {result.overall_summary}
            </Card>
          ) : null}

          {result.repos.length === 0 && searched ? (
            <Card padding="sm" className="text-sm text-ink-tertiary">
              未找到相关项目，建议更换关键词后重试。
            </Card>
          ) : null}

          {result.repos.map((repo) => (
            <Card key={repo.full_name} padding="sm" className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <ExternalLink
                  href={repo.html_url}
                  className="text-sm font-semibold text-ink-primary hover:text-apple-blue"
                >
                  {repo.full_name}
                </ExternalLink>
                {repo.language ? <Badge variant="default">{repo.language}</Badge> : null}
                {repo.license ? <Badge variant="success">{repo.license}</Badge> : null}
              </div>

              {repo.description ? (
                <p className="text-xs leading-5 text-ink-secondary">{repo.description}</p>
              ) : null}

              <div className="flex flex-wrap items-center gap-3 text-xs text-ink-tertiary">
                <span className="flex items-center gap-1">
                  <Star className="h-3 w-3" /> {formatStars(repo.stargazers_count)}
                </span>
                {repo.forks_count > 0 ? <span>Fork {repo.forks_count}</span> : null}
                {repo.updated_at ? <span>更新于 {formatDate(repo.updated_at)}</span> : null}
              </div>

              {(repo.topics ?? []).length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {(repo.topics ?? []).slice(0, 6).map((topic) => (
                    <Badge key={topic} variant="default" className="text-[10px]">
                      {topic}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
