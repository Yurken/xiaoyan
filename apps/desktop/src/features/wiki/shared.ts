export type WikiPageStatus = "draft" | "reviewed" | "contested" | "archived";
export type WikiPageType = "overview" | "concept" | "method" | "entity" | "comparison" | "synthesis";

export interface WikiPage {
  id: string;
  research_interest_id: string;
  slug: string;
  title: string;
  page_type: WikiPageType;
  summary: string;
  content: string;
  status: WikiPageStatus;
  confidence: number;
  current_revision: number;
  source_count: number;
  link_count: number;
  backlink_count: number;
  created_at: string;
  updated_at: string;
}

export interface WikiPageSource {
  id: string;
  source_kind: "paper" | "note";
  source_id: string;
  source_title: string;
  locator: string;
  relation_kind: "supports" | "contradicts" | "background";
  excerpt: string;
}

export interface WikiPageLink {
  id: string;
  target_slug: string;
  target_title?: string;
  target_page_id?: string;
  relation_kind: string;
}

export interface WikiPageRevision {
  id: string;
  revision_number: number;
  change_summary: string;
  generator: string;
  created_at: string;
}

export interface WikiPageDetail extends WikiPage {
  sources: WikiPageSource[];
  links: WikiPageLink[];
  backlinks: WikiPageLink[];
  revisions: WikiPageRevision[];
}

export interface WikiIssue {
  id: string;
  page_id?: string;
  page_title?: string;
  issue_type: string;
  severity: "error" | "warning" | "info";
  message: string;
  status: string;
  created_at: string;
}

export interface WikiCompileRun {
  id: string;
  status: string;
  source_count: number;
  changed_source_count: number;
  pages_created: number;
  pages_updated: number;
  issue_count: number;
  error?: string;
  started_at: string;
  finished_at?: string;
}

export interface WikiCompileSummary {
  run_id: string;
  status: string;
  source_count: number;
  changed_source_count: number;
  remaining_source_count: number;
  pages_created: number;
  pages_updated: number;
  embeddings_refreshed: number;
  issue_count: number;
}

export interface WikiLintSummary {
  issue_count: number;
  errors: number;
  warnings: number;
}

export const WIKI_STATUS_LABELS: Record<WikiPageStatus, string> = {
  draft: "待审阅",
  reviewed: "已审阅",
  contested: "有争议",
  archived: "已归档",
};

export const WIKI_TYPE_LABELS: Record<WikiPageType, string> = {
  overview: "总览",
  concept: "概念",
  method: "方法",
  entity: "实体",
  comparison: "比较",
  synthesis: "综合",
};

export const WIKI_STATUS_OPTIONS = [
  { value: "", label: "全部状态" },
  { value: "draft", label: "待审阅" },
  { value: "reviewed", label: "已审阅" },
  { value: "contested", label: "有争议" },
  { value: "archived", label: "已归档" },
] as const;

export const WIKI_ISSUE_LABELS: Record<string, string> = {
  missing_source: "缺少来源",
  missing_source_record: "来源已删除",
  missing_summary: "缺少摘要",
  orphan_page: "孤立页面",
  broken_link: "链接断开",
  invalid_source_ref: "来源引用无效",
};

export function wikiMarkdownForDisplay(content: string, sources: WikiPageSource[]): string {
  const sourceMap = new Map(sources.map((source) => [
    `${source.source_kind}:${source.source_id}`,
    source.source_title || source.source_id,
  ]));
  return content
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_match, slug: string, label?: string) => (
      `[${label?.trim() || slug.trim()}](#wiki:${encodeURIComponent(slug.trim())})`
    ))
    .replace(/\[source:(paper|note):([^\]\s]+)\]/g, (_match, kind: string, id: string) => {
      const title = sourceMap.get(`${kind}:${id}`) ?? id;
      return `**来源：${title}**`;
    });
}

export function formatWikiRunStatus(status: string): string {
  const labels: Record<string, string> = {
    running: "编译中",
    completed: "已完成",
    partial: "部分完成",
    unchanged: "无需更新",
    failed: "失败",
  };
  return labels[status] ?? status;
}
