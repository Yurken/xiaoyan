import { AlertCircle, BookOpen, CheckCircle2, FileClock, GitBranch, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { Badge, Button, Input, Select } from "@research-copilot/ui";
import WikiPageReader from "./WikiPageReader";
import { formatWikiRunStatus, WIKI_ISSUE_LABELS, WIKI_STATUS_LABELS, WIKI_STATUS_OPTIONS, WIKI_TYPE_LABELS, type WikiIssue, type WikiPage } from "./shared";
import { useWikiWorkspace } from "./useWikiWorkspace";

function issueVariant(severity: WikiIssue["severity"]): "danger" | "warning" | "default" {
  return severity === "error" ? "danger" : severity === "warning" ? "warning" : "default";
}

function WikiIndexItem({ page, active, onClick }: { page: WikiPage; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full border-b px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-apple-blue/30"
      style={{
        borderColor: "var(--rc-border)",
        background: active ? "var(--rc-button-ghost-bg-hover)" : "transparent",
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="line-clamp-2 text-sm font-semibold leading-5" style={{ color: "var(--rc-text)" }}>{page.title}</span>
        <span className="shrink-0 text-[10px] font-medium uppercase tracking-[0.08em]" style={{ color: "var(--rc-text-muted)" }}>
          {WIKI_TYPE_LABELS[page.page_type]}
        </span>
      </div>
      <p className="mt-1.5 line-clamp-2 text-xs leading-5" style={{ color: "var(--rc-text-muted)" }}>{page.summary || "暂无摘要"}</p>
      <div className="mt-2 flex items-center gap-2 text-[11px] tabular-nums" style={{ color: "var(--rc-text-muted)" }}>
        <span>{WIKI_STATUS_LABELS[page.status]}</span><span>·</span><span>{page.source_count} 来源</span><span>·</span><span>{page.link_count + page.backlink_count} 连接</span>
      </div>
    </button>
  );
}

export default function WikiWorkspace({ interestId }: { interestId?: string }) {
  const workspace = useWikiWorkspace(interestId);

  if (!interestId) {
    return (
      <div className="flex min-h-[420px] items-center justify-center border-y" style={{ borderColor: "var(--rc-border)" }}>
        <div className="max-w-md px-6 text-center">
          <BookOpen className="mx-auto h-8 w-8" style={{ color: "var(--rc-text-muted)" }} />
          <h2 className="mt-4 text-lg font-semibold" style={{ color: "var(--rc-text)" }}>先选择一个研究主题</h2>
          <p className="mt-2 text-sm leading-6" style={{ color: "var(--rc-text-muted)" }}>Wiki 会把该主题下的论文和笔记编译成互相连接、可追溯的知识页面。</p>
        </div>
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-[24px] border" style={{ borderColor: "var(--rc-border)", background: "var(--rc-panel-bg)" }}>
      <header className="relative flex flex-col gap-4 border-b px-5 py-4 lg:flex-row lg:items-center lg:justify-between" style={{ borderColor: "var(--rc-border)" }}>
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" style={{ color: "var(--rc-text-muted)" }} />
            <h2 className="text-sm font-semibold tracking-[-0.01em]" style={{ color: "var(--rc-text)" }}>研究 Wiki</h2>
            <span className="text-xs tabular-nums" style={{ color: "var(--rc-text-muted)" }}>{workspace.counts.total} 页</span>
          </div>
          <p className="mt-1 text-xs" style={{ color: "var(--rc-text-muted)" }}>
            来源变更后增量编译；AI 生成内容默认进入待审阅状态。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="ghost" loading={workspace.linting} onClick={() => void workspace.lint()}><ShieldCheck className="h-4 w-4" />检查</Button>
          <Button size="sm" variant="secondary" disabled={workspace.compiling} onClick={() => void workspace.compile(true)}><RefreshCw className="h-4 w-4" />全部重编</Button>
          <Button size="sm" loading={workspace.compiling} onClick={() => void workspace.compile(false)}><GitBranch className="h-4 w-4" />增量编译</Button>
        </div>
        {workspace.compiling ? (
          <div className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-apple-blue/10" aria-label="Wiki 正在编译">
            <div className="h-full w-1/3 animate-[pulse_1.2s_ease-in-out_infinite] bg-apple-blue" />
          </div>
        ) : null}
      </header>

      {workspace.error ? (
        <div className="flex items-start gap-2 border-b px-5 py-3 text-sm" style={{ borderColor: "var(--rc-border)", color: "var(--rc-danger-text, #b42318)" }} role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{workspace.error}
        </div>
      ) : null}
      {workspace.lastCompile ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-5 py-2.5 text-xs" style={{ borderColor: "var(--rc-border)", color: "var(--rc-text-muted)" }}>
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span>{formatWikiRunStatus(workspace.lastCompile.status)}</span>
          <span>创建 {workspace.lastCompile.pages_created} 页</span>
          <span>更新 {workspace.lastCompile.pages_updated} 页</span>
          {workspace.lastCompile.remaining_source_count > 0 ? <span>尚有 {workspace.lastCompile.remaining_source_count} 个来源待下次编译</span> : null}
        </div>
      ) : null}

      <div className="grid min-h-[620px] grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)_260px]">
        <aside className="border-b xl:border-b-0 xl:border-r" style={{ borderColor: "var(--rc-border)" }} aria-label="Wiki 页面索引">
          <div className="space-y-2 border-b p-3" style={{ borderColor: "var(--rc-border)" }}>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--rc-text-muted)" }} />
              <Input aria-label="搜索 Wiki 页面" className="pl-9" value={workspace.search} onChange={(event) => workspace.setSearch(event.target.value)} placeholder="搜索页面与正文" />
            </div>
            <Select
              aria-label="筛选 Wiki 页面状态"
              value={workspace.statusFilter}
              onChange={(value) => workspace.setStatusFilter(value as typeof workspace.statusFilter)}
              options={[...WIKI_STATUS_OPTIONS]}
            />
          </div>
          <div className="max-h-[520px] overflow-y-auto xl:max-h-[650px]">
            {workspace.pages.map((page) => (
              <WikiIndexItem key={page.id} page={page} active={page.id === workspace.selectedPageId} onClick={() => workspace.setSelectedPageId(page.id)} />
            ))}
            {!workspace.loading && workspace.pages.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <FileClock className="mx-auto h-6 w-6" style={{ color: "var(--rc-text-muted)" }} />
                <p className="mt-3 text-sm font-medium" style={{ color: "var(--rc-text)" }}>还没有 Wiki 页面</p>
                <p className="mt-1 text-xs leading-5" style={{ color: "var(--rc-text-muted)" }}>先为主题加入论文或笔记，再运行增量编译。</p>
              </div>
            ) : null}
            {workspace.loading ? <div className="space-y-3 p-4" aria-label="正在加载 Wiki"><div className="h-16 animate-pulse rounded-xl bg-black/5" /><div className="h-16 animate-pulse rounded-xl bg-black/5" /></div> : null}
          </div>
        </aside>

        <main className="min-w-0">
          {workspace.detail ? (
            <WikiPageReader detail={workspace.detail} saving={workspace.saving} onSelectSlug={workspace.selectSlug} onUpdate={workspace.updatePage} />
          ) : workspace.detailLoading ? (
            <div className="mx-auto max-w-[820px] space-y-5 px-8 py-10" aria-label="正在加载页面"><div className="h-9 w-2/3 animate-pulse rounded-lg bg-black/5" /><div className="h-20 animate-pulse rounded-lg bg-black/5" /><div className="h-48 animate-pulse rounded-lg bg-black/5" /></div>
          ) : (
            <div className="flex min-h-[420px] items-center justify-center"><p className="text-sm" style={{ color: "var(--rc-text-muted)" }}>从左侧选择页面。</p></div>
          )}
        </main>

        <aside className="border-t p-4 xl:border-l xl:border-t-0" style={{ borderColor: "var(--rc-border)", background: "var(--rc-panel-bg-soft)" }} aria-label="Wiki 健康状态">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--rc-text-muted)" }}>健康状态</h3>
            <Badge variant={workspace.issues.some((issue) => issue.severity === "error") ? "danger" : workspace.issues.length ? "warning" : "success"}>{workspace.issues.length}</Badge>
          </div>
          <div className="mt-4 space-y-3">
            {workspace.issues.slice(0, 8).map((issue) => (
              <button key={issue.id} type="button" onClick={() => issue.page_id && workspace.setSelectedPageId(issue.page_id)} className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-apple-blue/30">
                <Badge variant={issueVariant(issue.severity)}>{WIKI_ISSUE_LABELS[issue.issue_type] ?? issue.issue_type}</Badge>
                <p className="mt-1.5 text-xs leading-5" style={{ color: "var(--rc-text-muted)" }}>{issue.message}</p>
              </button>
            ))}
            {workspace.issues.length === 0 ? <p className="text-xs leading-5" style={{ color: "var(--rc-text-muted)" }}>没有发现断链、孤立页面或无来源内容。</p> : null}
          </div>
          <div className="mt-8 border-t pt-4" style={{ borderColor: "var(--rc-border)" }}>
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--rc-text-muted)" }}>最近编译</h3>
            <div className="mt-3 space-y-3">
              {workspace.runs.slice(0, 4).map((run) => (
                <div key={run.id} className="text-xs leading-5" style={{ color: "var(--rc-text-muted)" }}>
                  <div className="flex items-center justify-between gap-2"><span className="font-medium" style={{ color: "var(--rc-text)" }}>{formatWikiRunStatus(run.status)}</span><span>{new Date(run.started_at).toLocaleDateString()}</span></div>
                  <p>来源 {run.changed_source_count}/{run.source_count} · 页面 +{run.pages_created} / ~{run.pages_updated}</p>
                </div>
              ))}
              {workspace.runs.length === 0 ? <p className="text-xs" style={{ color: "var(--rc-text-muted)" }}>尚未运行编译。</p> : null}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
