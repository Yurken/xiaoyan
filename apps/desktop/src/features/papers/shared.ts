import type { Paper } from "@research-copilot/types";

export type PaperSortKey = "created_at" | "title" | "importance" | "manual";
export type PaperSortDirection = "desc" | "asc";

export type PaperFigure = {
  id: string;
  fig_index: number;
  kind?: "figure" | "table" | string;
  caption: string | null;
  data_url: string;
};

export type PaperParseRunStatus = "running" | "done" | "failed";

export type PaperParseRun = {
  id: string;
  paperId: string;
  parserName: string;
  status: PaperParseRunStatus;
  startedAt: Date;
  finishedAt?: Date;
  durationMs?: number;
  textLength: number;
  previewLength: number;
  sectionCount: number;
  figureCount: number;
  fallbackPath?: string;
  error?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

type FigureReferenceKind = "figure" | "table";

type FigureReference = {
  kind: FigureReferenceKind;
  index: number;
  offset: number;
};

type UnknownRow = Record<string, unknown>;

function asRow(value: unknown): UnknownRow {
  return value !== null && typeof value === "object" ? value as UnknownRow : {};
}

function stringField(row: UnknownRow, key: string, fallback = ""): string {
  const value = row[key];
  return typeof value === "string" ? value : fallback;
}

function optionalStringField(row: UnknownRow, key: string): string | undefined {
  const value = row[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function numberField(row: UnknownRow, key: string, fallback = 0): number {
  const value = row[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function optionalNumberField(row: UnknownRow, key: string): number | undefined {
  const value = row[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function dateField(row: UnknownRow, key: string): Date | undefined {
  const value = row[key];
  if (typeof value !== "string" && typeof value !== "number" && !(value instanceof Date)) {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function parseRunStatusField(value: unknown): PaperParseRunStatus {
  return value === "running" || value === "failed" ? value : "done";
}

export function rowToPaperParseRun(value: unknown): PaperParseRun {
  const row = asRow(value);
  return {
    id: stringField(row, "id"),
    paperId: stringField(row, "paperId"),
    parserName: stringField(row, "parserName"),
    status: parseRunStatusField(row.status),
    startedAt: dateField(row, "startedAt") ?? new Date(),
    finishedAt: dateField(row, "finishedAt"),
    durationMs: optionalNumberField(row, "durationMs"),
    textLength: numberField(row, "textLength"),
    previewLength: numberField(row, "previewLength"),
    sectionCount: numberField(row, "sectionCount"),
    figureCount: numberField(row, "figureCount"),
    fallbackPath: optionalStringField(row, "fallbackPath"),
    error: optionalStringField(row, "error"),
    metadata: asRow(row.metadata),
    createdAt: dateField(row, "createdAt") ?? new Date(),
    updatedAt: dateField(row, "updatedAt") ?? new Date(),
  };
}

export function findReferencedFigures(text: string, figures: PaperFigure[]): PaperFigure[] {
  if (!figures.length || !text) return [];

  const refs = extractFigureReferences(text);
  if (!refs.length) return [];

  const result: PaperFigure[] = [];
  const usedIds = new Set<string>();

  for (const ref of refs) {
    const matched = figures.find((figure) => figureMatchesReference(figure, ref, usedIds));
    if (matched) {
      usedIds.add(matched.id);
      result.push(matched);
    }
  }

  return result;
}

export function findMethodReferencedFigures(text: string, figures: PaperFigure[]): PaperFigure[] {
  // 模型显式引用到的图直接展示（仅限图片类），不再二次按“方法图”剔除。
  return findReferencedFigures(text, figures).filter((figure) => normalizeFigureKind(figure.kind) === "figure");
}

// 解读正文未显式写出图号时的兜底：按“方法/框架相关度”排序后展示。
// 关键：不再硬性剔除结果图等，否则实验型论文会一张都不展示；只做降权，保证有图就能看到。
export function selectDisplayableMethodFigures(figures: PaperFigure[], limit = 4): PaperFigure[] {
  const figureKind = figures.filter((figure) => normalizeFigureKind(figure.kind) === "figure");
  const pool = figureKind.length ? figureKind : figures;
  return pool
    .map((figure, order) => ({ figure, order, score: methodFigureScore(figure) }))
    .sort((left, right) => right.score - left.score || left.order - right.order)
    .slice(0, limit)
    .map((item) => item.figure);
}

function methodFigureScore(figure: PaperFigure): number {
  const caption = normalizeCaption(figure.caption ?? "");
  if (!caption) return 1; // 无题图仍可作为候选展示
  if (METHOD_FIGURE_INCLUDE_KEYWORDS.some((keyword) => caption.includes(keyword))) return 3;
  if (METHOD_FIGURE_EXCLUDE_KEYWORDS.some((keyword) => caption.includes(keyword))) return -1; // 结果图降权但不剔除
  return 1;
}

const METHOD_FIGURE_INCLUDE_KEYWORDS = [
  "architecture",
  "framework",
  "overview",
  "pipeline",
  "model",
  "module",
  "method",
  "network",
  "algorithm",
  "workflow",
  "system",
  "approach",
  "schema",
  "diagram",
  "structure",
  "encoder",
  "decoder",
  "架构",
  "框架",
  "流程",
  "方法",
  "模型",
  "模块",
  "网络",
  "算法",
  "结构",
  "示意",
  "概览",
] as const;

const METHOD_FIGURE_EXCLUDE_KEYWORDS = [
  "result",
  "performance",
  "experiment",
  "comparison",
  "ablation",
  "quantitative",
  "qualitative",
  "accuracy",
  "benchmark",
  "dataset",
  "baseline",
  "evaluation",
  "visualization",
  "curve",
  "结果",
  "性能",
  "实验",
  "对比",
  "消融",
  "准确",
  "指标",
  "曲线",
  "评估",
  "数据集",
  "基线",
  "可视化",
] as const;

function extractFigureReferences(text: string): FigureReference[] {
  const refs: FigureReference[] = [];
  const patterns: Array<{ kind: FigureReferenceKind; regex: RegExp }> = [
    { kind: "figure", regex: /\bfig(?:ure)?s?\.?\s*(\d{1,3})(?:\s*[a-z])?/gi },
    { kind: "figure", regex: /图\s*(\d{1,3})/g },
    { kind: "table", regex: /\btab(?:le)?s?\.?\s*(\d{1,3})(?:\s*[a-z])?/gi },
    { kind: "table", regex: /表\s*(\d{1,3})/g },
  ];

  for (const { kind, regex } of patterns) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const index = Number.parseInt(match[1], 10);
      if (Number.isFinite(index) && index > 0) {
        refs.push({ kind, index, offset: match.index });
      }
    }
  }

  return refs
    .sort((left, right) => left.offset - right.offset)
    .filter((ref, index, all) => {
      const previous = all[index - 1];
      return !previous || previous.kind !== ref.kind || previous.index !== ref.index;
    });
}

function figureMatchesReference(figure: PaperFigure, ref: FigureReference, usedIds: Set<string>) {
  if (usedIds.has(figure.id)) return false;
  const kind = normalizeFigureKind(figure.kind);
  if (kind && kind !== ref.kind) return false;
  if (figure.fig_index === ref.index) return true;

  if (!figure.caption) return false;
  const caption = normalizeCaption(figure.caption);
  if (ref.kind === "figure") {
    return [`figure ${ref.index}`, `fig ${ref.index}`, `图${ref.index}`].some((needle) => caption.includes(needle));
  }
  return [`table ${ref.index}`, `tab ${ref.index}`, `表${ref.index}`].some((needle) => caption.includes(needle));
}

function normalizeFigureKind(kind: PaperFigure["kind"]): FigureReferenceKind | null {
  if (!kind) return null;
  const normalized = kind.trim().toLowerCase();
  if (normalized === "figure" || normalized === "fig" || normalized === "图") return "figure";
  if (normalized === "table" || normalized === "tab" || normalized === "表") return "table";
  return null;
}

function normalizeCaption(caption: string) {
  return caption
    .toLowerCase()
    .replace(/\bfig\./g, "fig")
    .replace(/\btab\./g, "tab")
    .replace(/\s+/g, " ")
    .trim();
}

export type PaperCitationFormat = "gbt7714" | "apa" | "mla" | "ieee" | "bibtex";

export const PAPER_CITATION_FORMATS: Array<{ value: PaperCitationFormat; label: string }> = [
  { value: "gbt7714", label: "GB/T 7714" },
  { value: "apa", label: "APA" },
  { value: "mla", label: "MLA" },
  { value: "ieee", label: "IEEE" },
  { value: "bibtex", label: "BibTeX" },
];

export function formatPaperCitation(paper: Paper, format: PaperCitationFormat): string {
  const title = cleanCitationPart(paper.title) || "Untitled";
  const authors = cleanCitationPart(paper.authors);
  const year = paper.year ? String(paper.year) : "";
  const venue = cleanCitationPart(paper.venue);
  const doi = cleanDoi(paper.doi);
  const doiUrl = doi ? `https://doi.org/${doi}` : "";

  if (format === "bibtex") {
    return formatBibTeX({ paper, title, authors, year, venue, doi });
  }

  if (format === "apa") {
    return [
      authors ? `${authors}.` : "",
      year ? `(${year}).` : "",
      `${title}.`,
      venue ? `${venue}.` : "",
      doiUrl,
    ].filter(Boolean).join(" ");
  }

  if (format === "mla") {
    return [
      authors ? `${authors}.` : "",
      `"${title}."`,
      venue ? `${venue},` : "",
      year ? `${year}.` : "",
      doi ? `doi:${doi}` : "",
    ].filter(Boolean).join(" ");
  }

  if (format === "ieee") {
    return [
      authors ? `${authors},` : "",
      `"${title},"`,
      venue ? `${venue},` : "",
      year ? `${year}.` : "",
      doi ? `doi: ${doi}` : "",
    ].filter(Boolean).join(" ");
  }

  const sourceMark = paper.ccf_type === "journal" || paper.journal_issn || paper.journal_eissn ? "J" : "C";
  return [
    authors ? `${authors}.` : "",
    `${title}[${sourceMark}].`,
    venue ? `${venue},` : "",
    year ? `${year}.` : "",
    doi ? `DOI:${doi}` : "",
  ].filter(Boolean).join(" ");
}

function formatBibTeX({
  paper,
  title,
  authors,
  year,
  venue,
  doi,
}: {
  paper: Paper;
  title: string;
  authors: string;
  year: string;
  venue: string;
  doi: string;
}) {
  const entryType = paper.ccf_type === "journal" || paper.journal_issn || paper.journal_eissn ? "article" : "inproceedings";
  const venueField = entryType === "article" ? "journal" : "booktitle";
  const fields = [
    ["title", title],
    ["author", authorsToBibTeX(authors)],
    [venueField, venue],
    ["year", year],
    ["doi", doi],
  ].filter(([, value]) => value);

  const body = fields
    .map(([key, value]) => `  ${key} = {${escapeBibTeX(String(value))}}`)
    .join(",\n");

  return `@${entryType}{${makeBibTeXKey(paper, authors, year, title)},\n${body}\n}`;
}

function cleanCitationPart(value?: string | null) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function cleanDoi(value?: string | null) {
  return cleanCitationPart(value)
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "");
}

function authorsToBibTeX(authors: string) {
  if (!authors) return "";
  return authors
    .split(/\s*(?:,|;|；|，)\s*/)
    .map((author) => author.trim())
    .filter(Boolean)
    .join(" and ");
}

function makeBibTeXKey(paper: Paper, authors: string, year: string, title: string) {
  const firstAuthor = authors
    .split(/\s*(?:,|;|；|，)\s*/)
    .find(Boolean)
    ?.split(/\s+/)
    .at(-1) ?? "paper";
  const firstTitleWord = title.match(/[A-Za-z0-9]+/)?.[0] ?? paper.id.slice(0, 6);
  return `${firstAuthor}${year || "nd"}${firstTitleWord}`
    .replace(/[^A-Za-z0-9_:-]/g, "")
    .slice(0, 64);
}

function escapeBibTeX(value: string) {
  return value.replace(/[{}]/g, "");
}

export type PaperTaskMode = "analysis" | "reproduction" | "combined";
export type PaperTaskFinalStatus = "analyzed" | "reproduced";
export type PaperTaskTrackKey = "analysis" | "reproduction";

export interface PaperStatusEventPayload {
  paper_id: string;
  status: string;
  error?: string;
  step?: string;
  progress?: number;
}

export interface PaperTaskProgress {
  label: string;
  detail: string;
  percent: number;
  mode: PaperTaskMode;
  tracks?: Partial<Record<PaperTaskTrackKey, PaperTaskTrackProgress>>;
}

export interface PaperTaskTrackProgress {
  label: string;
  detail: string;
  percent: number;
  done?: boolean;
}

const TRACK_LABELS: Record<PaperTaskTrackKey, string> = {
  analysis: "论文解读",
  reproduction: "复现/验证指南",
};

const COMBINED_TRACK_WEIGHTS: Record<PaperTaskTrackKey, number> = {
  analysis: 0.68,
  reproduction: 0.32,
};

const COMBINED_BASE_PERCENT = 6;
const COMBINED_WORK_PERCENT = 93;

const TRACK_INITIAL_PERCENT = 4;
const TRACK_DONE_PERCENT = 100;

const PAPER_TASK_STEP_RULES: Array<{
  needle: string;
  track: PaperTaskTrackKey;
  label: string;
  detail: string;
  percent: number;
  step: number;
  total: number;
}> = [
  {
    needle: "图表提取超时",
    track: "analysis",
    label: "图表提取超时，继续解读正文",
    detail: "图表识别没有卡住流程，小妍会先用正文上下文完成后续分析。",
    percent: 18,
    step: 1,
    total: 6,
  },
  {
    needle: "图表提取",
    track: "analysis",
    label: "提取论文图表",
    detail: "正在整理可用的方法图上下文，后续只在需要时引用。",
    percent: 12,
    step: 1,
    total: 6,
  },
  {
    needle: "问题背景分析",
    track: "analysis",
    label: "分析问题、论题与语境",
    detail: "正在按论文类型梳理问题、动机、理论空白或材料语境。",
    percent: 30,
    step: 2,
    total: 6,
  },
  {
    needle: "方法深度解析",
    track: "analysis",
    label: "拆解方法、框架或论证路径",
    detail: "正在对齐技术方法、综述框架、证明链条或解释策略。",
    percent: 48,
    step: 3,
    total: 6,
  },
  {
    needle: "证据与结果分析",
    track: "analysis",
    label: "核对证据、验证与结果",
    detail: "正在按论文类型检查实验、证明、综述归纳或材料证据。",
    percent: 66,
    step: 4,
    total: 6,
  },
  {
    needle: "综合评审",
    track: "analysis",
    label: "整理贡献、局限与结论",
    detail: "正在把前面几轮解读收束成可阅读的综合结论。",
    percent: 84,
    step: 5,
    total: 6,
  },
  {
    needle: "复现/验证指南生成",
    track: "reproduction",
    label: "生成复现/验证指南",
    detail: "正在判断适合工程复现、理论复核、综述复核还是材料复核。",
    percent: 45,
    step: 1,
    total: 2,
  },
  {
    needle: "复现/验证指南整理",
    track: "reproduction",
    label: "整理复现/验证指南",
    detail: "正在校验可用字段并保存结果。",
    percent: 86,
    step: 2,
    total: 2,
  },
];

export function expectedPaperTaskFinalStatuses(mode: PaperTaskMode): PaperTaskFinalStatus[] {
  if (mode === "combined") return ["analyzed", "reproduced"];
  if (mode === "reproduction") return ["reproduced"];
  return ["analyzed"];
}

export function initialPaperTaskProgress(mode: PaperTaskMode): PaperTaskProgress {
  if (mode === "reproduction") {
    return buildPaperTaskProgress({
      label: "准备复现/验证指南",
      detail: "正在读取论文上下文并连接复现/验证模型。",
      mode,
      tracks: {
        reproduction: initialTrackProgress("reproduction"),
      },
    });
  }

  if (mode === "combined") {
    return buildPaperTaskProgress({
      label: "准备小妍解读",
      detail: "会同步生成论文解读和复现/验证指南，完成后一起展示。",
      mode,
      tracks: {
        analysis: initialTrackProgress("analysis"),
        reproduction: initialTrackProgress("reproduction"),
      },
    });
  }

  return buildPaperTaskProgress({
    label: "准备论文解读",
    detail: "正在读取论文上下文并连接精读模型。",
    mode,
    tracks: {
      analysis: initialTrackProgress("analysis"),
    },
  });
}

export function progressFromPaperStatusEvent(
  payload: PaperStatusEventPayload,
  previous?: PaperTaskProgress,
): PaperTaskProgress {
  const step = payload.step?.trim();
  const matched = step ? PAPER_TASK_STEP_RULES.find((rule) => step.includes(rule.needle)) : undefined;
  const explicitPercent = typeof payload.progress === "number" && Number.isFinite(payload.progress)
    ? clampPaperTaskPercent(payload.progress)
    : undefined;
  const mode = previous?.mode ?? modeFromTrack(matched?.track);
  const tracks = ensureTracksForMode(mode, previous?.tracks);

  if (matched) {
    const previousTrack = tracks[matched.track];
    const trackPercent = Math.max(
      previousTrack?.percent ?? 0,
      clampPaperTaskPercent(explicitPercent ?? matched.percent),
    );
    tracks[matched.track] = {
      label: TRACK_LABELS[matched.track],
      detail: `${matched.step}/${matched.total} · ${matched.label}`,
      percent: trackPercent,
    };
  }

  return buildPaperTaskProgress({
    label: matched?.label ?? cleanPaperTaskStep(step) ?? previous?.label ?? "小妍正在处理论文",
    detail: matched?.detail ?? cleanPaperTaskStep(step) ?? previous?.detail ?? "后台任务已开始，正在等待阶段信息。",
    mode,
    tracks,
    previousPercent: previous?.percent,
  });
}

export function progressForPendingPaperCompletions(
  waiting: Set<PaperTaskFinalStatus>,
  previous?: PaperTaskProgress,
): PaperTaskProgress {
  const mode = previous?.mode ?? "combined";
  const tracks = ensureTracksForMode(mode, previous?.tracks);

  if (!waiting.has("analyzed") && tracks.analysis) {
    tracks.analysis = completeTrackProgress("analysis");
  }
  if (!waiting.has("reproduced") && tracks.reproduction) {
    tracks.reproduction = completeTrackProgress("reproduction");
  }

  if (waiting.has("reproduced") && !waiting.has("analyzed")) {
    return buildPaperTaskProgress({
      label: "论文解读已完成，复现/验证指南收尾中",
      detail: "解读内容已经生成，正在等待复现/验证指南完成后统一展示。",
      mode,
      tracks,
      previousPercent: previous?.percent,
    });
  }

  if (waiting.has("analyzed") && !waiting.has("reproduced")) {
    return buildPaperTaskProgress({
      label: "复现/验证指南已完成，论文解读收尾中",
      detail: "复现/验证部分已经生成，正在等待论文精读结果完成。",
      mode,
      tracks,
      previousPercent: previous?.percent,
    });
  }

  return buildPaperTaskProgress({
    label: "小妍正在并行处理论文",
    detail: "论文解读和复现/验证指南仍在推进。",
    mode,
    tracks,
    previousPercent: previous?.percent,
  });
}

function cleanPaperTaskStep(step?: string) {
  return step
    ?.replace(/[.。…\s]+$/g, "")
    .trim();
}

function clampPaperTaskPercent(value: number) {
  return Math.min(99, Math.max(0, Math.round(value)));
}

function modeFromTrack(track: PaperTaskTrackKey | undefined): PaperTaskMode {
  if (track === "reproduction") return "reproduction";
  return "analysis";
}

function initialTrackProgress(track: PaperTaskTrackKey): PaperTaskTrackProgress {
  return {
    label: TRACK_LABELS[track],
    detail: "等待阶段信息",
    percent: TRACK_INITIAL_PERCENT,
  };
}

function completeTrackProgress(track: PaperTaskTrackKey): PaperTaskTrackProgress {
  return {
    label: TRACK_LABELS[track],
    detail: "已完成",
    percent: TRACK_DONE_PERCENT,
    done: true,
  };
}

function ensureTracksForMode(
  mode: PaperTaskMode,
  previous?: Partial<Record<PaperTaskTrackKey, PaperTaskTrackProgress>>,
): Partial<Record<PaperTaskTrackKey, PaperTaskTrackProgress>> {
  const tracks: Partial<Record<PaperTaskTrackKey, PaperTaskTrackProgress>> = {
    ...previous,
  };

  if (mode === "analysis" || mode === "combined") {
    tracks.analysis ??= initialTrackProgress("analysis");
  }
  if (mode === "reproduction" || mode === "combined") {
    tracks.reproduction ??= initialTrackProgress("reproduction");
  }

  return tracks;
}

function buildPaperTaskProgress({
  label,
  detail,
  mode,
  tracks,
  previousPercent,
}: {
  label: string;
  detail: string;
  mode: PaperTaskMode;
  tracks?: Partial<Record<PaperTaskTrackKey, PaperTaskTrackProgress>>;
  previousPercent?: number;
}): PaperTaskProgress {
  const nextPercent = calculateTaskPercent(mode, tracks);
  return {
    label,
    detail,
    mode,
    tracks,
    percent: Math.max(previousPercent ?? 0, nextPercent),
  };
}

function calculateTaskPercent(
  mode: PaperTaskMode,
  tracks?: Partial<Record<PaperTaskTrackKey, PaperTaskTrackProgress>>,
) {
  if (mode === "combined") {
    const weightedTrackPercent = (
      (tracks?.analysis?.percent ?? TRACK_INITIAL_PERCENT) * COMBINED_TRACK_WEIGHTS.analysis
      + (tracks?.reproduction?.percent ?? TRACK_INITIAL_PERCENT) * COMBINED_TRACK_WEIGHTS.reproduction
    );
    return clampPaperTaskPercent(
      COMBINED_BASE_PERCENT + weightedTrackPercent / 100 * COMBINED_WORK_PERCENT,
    );
  }

  const track = mode === "reproduction" ? tracks?.reproduction : tracks?.analysis;
  return clampPaperTaskPercent(track?.percent ?? TRACK_INITIAL_PERCENT);
}
