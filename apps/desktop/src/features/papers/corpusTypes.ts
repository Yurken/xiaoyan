/** 论文语料库类型定义 */

export interface CorpusEntry {
  id: string;
  paper_id?: string | null;
  paper_title?: string | null;
  text: string;
  note: string;
  page?: number | null;
  tags?: string[] | null;
  created_at: string;
}

export function normalizeCorpusEntry(raw: unknown): CorpusEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.text !== "string") return null;
  return {
    id: record.id,
    paper_id: typeof record.paper_id === "string" ? record.paper_id : null,
    paper_title: typeof record.paper_title === "string" ? record.paper_title : null,
    text: record.text,
    note: typeof record.note === "string" ? record.note : "",
    page: typeof record.page === "number" ? record.page : null,
    tags: Array.isArray(record.tags) ? (record.tags as string[]) : null,
    created_at: typeof record.created_at === "string" ? record.created_at : "",
  };
}
