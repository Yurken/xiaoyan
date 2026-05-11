import type { Paper } from "@research-copilot/types";

export type PaperFigure = {
  id: string;
  fig_index: number;
  kind?: "figure" | "table" | string;
  caption: string | null;
  data_url: string;
};

type FigureReferenceKind = "figure" | "table";

type FigureReference = {
  kind: FigureReferenceKind;
  index: number;
  offset: number;
};

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
}

const PAPER_TASK_STEP_RULES: Array<{ needle: string; label: string; detail: string; percent: number }> = [
  {
    needle: "图表提取超时",
    label: "图表提取超时，继续解读正文",
    detail: "图表识别没有卡住流程，小妍会先用正文上下文完成后续分析。",
    percent: 24,
  },
  {
    needle: "图表提取",
    label: "提取论文图表",
    detail: "正在整理 Figure / Table 上下文，后续分析会尽量引用图表编号。",
    percent: 14,
  },
  {
    needle: "问题背景分析",
    label: "分析研究问题与背景",
    detail: "正在梳理论文想解决的问题、动机和研究场景。",
    percent: 32,
  },
  {
    needle: "方法深度解析",
    label: "拆解核心方法",
    detail: "正在对齐方法模块、关键假设和与已有工作的差异。",
    percent: 50,
  },
  {
    needle: "实验结果分析",
    label: "核对实验设计与结果",
    detail: "正在检查数据集、指标、基线、消融和结果边界。",
    percent: 68,
  },
  {
    needle: "综合评审",
    label: "整理贡献、局限与结论",
    detail: "正在把前面几轮解读收束成可阅读的综合结论。",
    percent: 82,
  },
  {
    needle: "复现指南生成",
    label: "生成复现指南",
    detail: "正在整理代码、环境、数据、训练和评估路径。",
    percent: 46,
  },
  {
    needle: "复现指南整理",
    label: "整理复现指南",
    detail: "正在校验复现字段并保存结果。",
    percent: 88,
  },
];

export function expectedPaperTaskFinalStatuses(mode: PaperTaskMode): PaperTaskFinalStatus[] {
  if (mode === "combined") return ["analyzed", "reproduced"];
  if (mode === "reproduction") return ["reproduced"];
  return ["analyzed"];
}

export function initialPaperTaskProgress(mode: PaperTaskMode): PaperTaskProgress {
  if (mode === "reproduction") {
    return {
      label: "准备复现指南",
      detail: "正在读取论文上下文并连接复现模型。",
      percent: 8,
    };
  }

  if (mode === "combined") {
    return {
      label: "准备小妍解读",
      detail: "会同步生成论文解读和复现指南，完成后一起展示。",
      percent: 8,
    };
  }

  return {
    label: "准备论文解读",
    detail: "正在读取论文上下文并连接精读模型。",
    percent: 8,
  };
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
  const nextPercent = explicitPercent ?? matched?.percent ?? previous?.percent ?? 12;

  return {
    label: matched?.label ?? cleanPaperTaskStep(step) ?? previous?.label ?? "小妍正在处理论文",
    detail: matched?.detail ?? cleanPaperTaskStep(step) ?? previous?.detail ?? "后台任务已开始，正在等待阶段信息。",
    percent: Math.max(previous?.percent ?? 0, clampPaperTaskPercent(nextPercent)),
  };
}

export function progressForPendingPaperCompletions(
  waiting: Set<PaperTaskFinalStatus>,
  previous?: PaperTaskProgress,
): PaperTaskProgress {
  if (waiting.has("reproduced") && !waiting.has("analyzed")) {
    return {
      label: "论文解读已完成，复现指南收尾中",
      detail: "解读内容已经生成，正在等待复现指南完成后统一展示。",
      percent: Math.max(previous?.percent ?? 0, 88),
    };
  }

  if (waiting.has("analyzed") && !waiting.has("reproduced")) {
    return {
      label: "复现指南已完成，论文解读收尾中",
      detail: "复现部分已经生成，正在等待论文精读结果完成。",
      percent: Math.max(previous?.percent ?? 0, 72),
    };
  }

  return {
    label: "小妍正在并行处理论文",
    detail: "论文解读和复现指南仍在推进。",
    percent: Math.max(previous?.percent ?? 0, 60),
  };
}

function cleanPaperTaskStep(step?: string) {
  return step
    ?.replace(/[.。…\s]+$/g, "")
    .trim();
}

function clampPaperTaskPercent(value: number) {
  return Math.min(99, Math.max(0, Math.round(value)));
}
