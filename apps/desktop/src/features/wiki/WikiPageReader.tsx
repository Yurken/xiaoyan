import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowUpRight, Check, Edit3, FileText, Link2, Save, X } from "lucide-react";
import { Badge, Button, Input, MarkdownRenderer, Textarea } from "@research-copilot/ui";
import { WIKI_STATUS_LABELS, WIKI_TYPE_LABELS, wikiMarkdownForDisplay, type WikiPageDetail, type WikiPageStatus } from "./shared";

interface WikiPageReaderProps {
  detail: WikiPageDetail;
  saving: boolean;
  onSelectSlug: (slug: string) => void;
  onUpdate: (patch: {
    title?: string;
    summary?: string;
    content?: string;
    status?: WikiPageStatus;
    change_summary?: string;
  }) => Promise<WikiPageDetail | null>;
}

function statusVariant(status: WikiPageStatus): "success" | "warning" | "danger" | "default" {
  if (status === "reviewed") return "success";
  if (status === "contested") return "danger";
  if (status === "draft") return "warning";
  return "default";
}

export default function WikiPageReader({ detail, saving, onSelectSlug, onUpdate }: WikiPageReaderProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(detail.title);
  const [summary, setSummary] = useState(detail.summary);
  const [content, setContent] = useState(detail.content);

  useEffect(() => {
    setEditing(false);
    setTitle(detail.title);
    setSummary(detail.summary);
    setContent(detail.content);
  }, [detail.id, detail.content, detail.summary, detail.title]);

  const displayContent = useMemo(
    () => wikiMarkdownForDisplay(detail.content, detail.sources),
    [detail.content, detail.sources],
  );

  const save = async () => {
    const result = await onUpdate({
      title: title.trim(),
      summary: summary.trim(),
      content: content.trim(),
      change_summary: "人工编辑页面",
    });
    if (result) setEditing(false);
  };

  return (
    <article className="min-w-0 px-5 py-6 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[820px]">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={statusVariant(detail.status)}>{WIKI_STATUS_LABELS[detail.status]}</Badge>
          <Badge>{WIKI_TYPE_LABELS[detail.page_type]}</Badge>
          <span className="text-xs tabular-nums" style={{ color: "var(--rc-text-muted)" }}>
            修订 {detail.current_revision} · 置信度 {Math.round(detail.confidence * 100)}%
          </span>
        </div>

        {editing ? (
          <div className="mt-6 space-y-4">
            <label className="block space-y-2 text-sm font-medium" style={{ color: "var(--rc-text)" }}>
              页面标题
              <Input value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label className="block space-y-2 text-sm font-medium" style={{ color: "var(--rc-text)" }}>
              摘要
              <Textarea rows={3} value={summary} onChange={(event) => setSummary(event.target.value)} />
            </label>
            <label className="block space-y-2 text-sm font-medium" style={{ color: "var(--rc-text)" }}>
              Markdown 正文
              <Textarea className="min-h-[420px] font-mono text-[13px] leading-6" value={content} onChange={(event) => setContent(event.target.value)} />
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditing(false)} disabled={saving}><X className="h-4 w-4" />取消</Button>
              <Button onClick={() => void save()} loading={saving} disabled={!title.trim() || !content.trim()}><Save className="h-4 w-4" />保存修订</Button>
            </div>
          </div>
        ) : (
          <>
            <header className="mt-5 border-b pb-6" style={{ borderColor: "var(--rc-border)" }}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h1 className="text-3xl font-semibold tracking-[-0.035em] sm:text-4xl" style={{ color: "var(--rc-text)" }}>
                    {detail.title}
                  </h1>
                  <p className="mt-3 max-w-2xl text-[15px] leading-7" style={{ color: "var(--rc-text-muted)" }}>
                    {detail.summary || "这篇页面尚未补充摘要。"}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setEditing(true)}><Edit3 className="h-4 w-4" />编辑</Button>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {detail.status !== "reviewed" ? (
                  <Button size="sm" variant="secondary" loading={saving} onClick={() => void onUpdate({ status: "reviewed", change_summary: "人工审核通过" })}>
                    <Check className="h-4 w-4" />审核通过
                  </Button>
                ) : null}
                {detail.status !== "contested" ? (
                  <Button size="sm" variant="ghost" disabled={saving} onClick={() => void onUpdate({ status: "contested", change_summary: "人工标记为有争议" })}>
                    <AlertTriangle className="h-4 w-4" />标记争议
                  </Button>
                ) : null}
              </div>
            </header>

            <MarkdownRenderer
              content={displayContent}
              highlightSourceTags
              className="mt-8 prose-headings:scroll-mt-8 prose-h2:mt-10 prose-h2:border-b prose-h2:pb-2 prose-h2:text-xl"
              onLinkClick={(href) => {
                if (href.startsWith("#wiki:")) onSelectSlug(decodeURIComponent(href.slice(6)));
              }}
            />

            <section className="mt-12 border-t pt-7" style={{ borderColor: "var(--rc-border)" }}>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" style={{ color: "var(--rc-text-muted)" }} />
                <h2 className="text-sm font-semibold" style={{ color: "var(--rc-text)" }}>来源依据</h2>
                <span className="text-xs tabular-nums" style={{ color: "var(--rc-text-muted)" }}>{detail.sources.length}</span>
              </div>
              <div className="mt-3 divide-y" style={{ borderColor: "var(--rc-border)" }}>
                {detail.sources.map((source) => (
                  <details key={source.id} className="group py-3">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-apple-blue/30">
                      <span className="min-w-0 truncate font-medium" style={{ color: "var(--rc-text)" }}>{source.source_title || source.source_id}</span>
                      <span className="shrink-0 text-xs" style={{ color: "var(--rc-text-muted)" }}>{source.source_kind === "paper" ? "论文" : "笔记"}</span>
                    </summary>
                    <p className="mt-2 text-sm leading-6" style={{ color: "var(--rc-text-muted)" }}>{source.excerpt}</p>
                  </details>
                ))}
                {detail.sources.length === 0 ? <p className="py-4 text-sm" style={{ color: "var(--rc-text-muted)" }}>尚无来源记录。</p> : null}
              </div>
            </section>

            {(detail.links.length > 0 || detail.backlinks.length > 0) ? (
              <section className="mt-8 border-t pt-7" style={{ borderColor: "var(--rc-border)" }}>
                <div className="flex items-center gap-2"><Link2 className="h-4 w-4" /><h2 className="text-sm font-semibold">页面关系</h2></div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[...detail.links, ...detail.backlinks].map((link) => (
                    <button
                      key={`${link.id}-${link.target_slug}`}
                      type="button"
                      disabled={!link.target_page_id}
                      onClick={() => onSelectSlug(link.target_slug)}
                      className="inline-flex min-h-9 items-center gap-1 rounded-xl border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-apple-blue/30 disabled:opacity-50"
                      style={{ borderColor: "var(--rc-border)", color: "var(--rc-text-muted)" }}
                    >
                      {link.target_title || link.target_slug}<ArrowUpRight className="h-3 w-3" />
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="mt-8 border-t pt-7" style={{ borderColor: "var(--rc-border)" }}>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold" style={{ color: "var(--rc-text)" }}>修订记录</h2>
                <span className="text-xs tabular-nums" style={{ color: "var(--rc-text-muted)" }}>{detail.revisions.length} 次</span>
              </div>
              <ol className="mt-3 divide-y" style={{ borderColor: "var(--rc-border)" }}>
                {detail.revisions.slice(0, 8).map((revision) => (
                  <li key={revision.id} className="flex items-start justify-between gap-4 py-3 text-xs">
                    <div>
                      <p className="font-medium" style={{ color: "var(--rc-text)" }}>修订 {revision.revision_number} · {revision.change_summary || "内容更新"}</p>
                      <p className="mt-1" style={{ color: "var(--rc-text-muted)" }}>{revision.generator === "llm-wiki" ? "LLM Wiki 编译" : "人工编辑"}</p>
                    </div>
                    <time className="shrink-0 tabular-nums" style={{ color: "var(--rc-text-muted)" }}>{new Date(revision.created_at).toLocaleDateString()}</time>
                  </li>
                ))}
              </ol>
            </section>
          </>
        )}
      </div>
    </article>
  );
}
