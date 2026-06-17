// 综述接口同时存在「扁平旧结构」和「report 嵌套结构」两种返回，统一归一化成 SurveyData。

export interface SurveyMethod {
  category: string;
  description: string;
  key_papers: number[];
  strengths: string;
  weaknesses: string;
}

export interface SurveyTrend {
  trend: string;
  description: string;
  evidence: string;
}

export interface SurveyDirection {
  direction: string;
  rationale: string;
}

export interface SurveyPaper {
  id?: string;
  title: string;
  authors: string;
  year: number;
  abstract: string;
  venue: string;
  citation_count: number;
  pdf_url: string;
  doi: string;
}

export interface SurveyData {
  query: string;
  background?: string;
  representative_methods: SurveyMethod[];
  research_trends: SurveyTrend[];
  existing_gaps: string[];
  future_directions: SurveyDirection[];
  key_takeaways?: string;
  papers: SurveyPaper[];
}

function asArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? (value as Array<Record<string, unknown>>) : [];
}

export function normalizeSurvey(input: Record<string, unknown>, fallbackQuery: string): SurveyData {
  const raw = (input.data && typeof input.data === "object" ? input.data : input) as Record<string, unknown>;
  const report = (raw.report ?? {}) as Record<string, unknown>;

  const methodsOld = asArray(raw.representative_methods).map((m) => ({
    category: String(m.category ?? "未命名方法"),
    description: String(m.description ?? ""),
    key_papers: Array.isArray(m.key_papers)
      ? m.key_papers.map((n) => Number(n)).filter((n) => Number.isFinite(n))
      : [],
    strengths: String(m.strengths ?? ""),
    weaknesses: String(m.weaknesses ?? ""),
  }));
  const methodsNew = asArray(report.major_methods).map((m, idx) => ({
    category: String(m.name ?? `方法 ${idx + 1}`),
    description: String(m.description ?? ""),
    key_papers: [] as number[],
    strengths: String(m.pros ?? ""),
    weaknesses: String(m.cons ?? ""),
  }));

  const trendsOld = asArray(raw.research_trends).map((t) => ({
    trend: String(t.trend ?? ""),
    description: String(t.description ?? ""),
    evidence: String(t.evidence ?? ""),
  }));
  const trendsNew = asArray(report.research_trends).map((t) => ({
    trend: String(t.trend ?? ""),
    description: String(t.signal ?? ""),
    evidence: "",
  }));

  const gapsOld = Array.isArray(raw.existing_gaps) ? raw.existing_gaps.map((g) => String(g)) : [];
  const gapsNew = Array.isArray(report.challenges) ? report.challenges.map((g) => String(g)) : [];

  const futureOld = asArray(raw.future_directions).map((d) => ({
    direction: String(d.direction ?? ""),
    rationale: String(d.rationale ?? ""),
  }));
  const futureNew = asArray(report.recommended_topics).map((d) => ({
    direction: String(d.topic ?? ""),
    rationale: `${String(d.why ?? "")} ${d.first_step ? `第一步：${d.first_step}` : ""}`.trim(),
  }));

  const papers = asArray(raw.papers).map((p) => ({
    id: p.id ? String(p.id) : undefined,
    title: String(p.title ?? "未命名论文"),
    authors: String(p.authors ?? "未知作者"),
    year: Number(p.year ?? 0),
    abstract: String(p.abstract ?? ""),
    venue: String(p.venue ?? ""),
    citation_count: Number(p.citation_count ?? 0),
    pdf_url: String(p.pdf_url ?? ""),
    doi: String(p.doi ?? ""),
  }));

  return {
    query: String(raw.query ?? fallbackQuery),
    background: (raw.background as string | undefined) ?? (report.background as string | undefined),
    representative_methods: methodsOld.length > 0 ? methodsOld : methodsNew,
    research_trends: trendsOld.length > 0 ? trendsOld : trendsNew,
    existing_gaps: gapsOld.length > 0 ? gapsOld : gapsNew,
    future_directions: futureOld.length > 0 ? futureOld : futureNew,
    key_takeaways: (raw.key_takeaways as string | undefined) ?? (report.overall_summary as string | undefined),
    papers,
  };
}
