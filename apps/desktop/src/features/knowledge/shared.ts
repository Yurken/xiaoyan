import type { LearningPath, Paper, ResearchInterest } from "@research-copilot/types";

export type KnowledgeClaimStatus = "hypothesis" | "supported" | "contested" | "open";
export type KnowledgeGraphSourceKind = "paper" | "experiment" | "note";
export type KnowledgeEvidenceRelationKind = "supports" | "contradicts" | "background";
export type KnowledgeGraphNodeKind = "interest" | "claim" | "paper" | "experiment" | "note";
export type KnowledgeGraphEdgeKind = "belongs" | "evidence" | "citation";

export interface KnowledgeGraphInterest {
  id: string;
  topic: string;
  folderName?: string | null;
  keywords: string[];
  status: string;
  createdAt: string;
}

export interface KnowledgeGraphPaper {
  id: string;
  title: string;
  authors?: string | null;
  year?: number;
  venue?: string | null;
  researchInterestId?: string | null;
  tags: string[];
  status: string;
  notes?: string | null;
  keyConclusions?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeGraphNote {
  id: string;
  title: string;
  content: string;
  sourceType: string;
  sourceId?: string | null;
  tags: string[];
  researchInterestId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeGraphExperiment {
  id: string;
  title: string;
  result: string;
  notes: string;
  linkedSubmissionId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeGraphClaim {
  id: string;
  title: string;
  statement: string;
  researchInterestId?: string | null;
  status: KnowledgeClaimStatus;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeGraphEvidenceLink {
  id: string;
  claimId: string;
  sourceKind: KnowledgeGraphSourceKind;
  sourceId: string;
  relationKind: KnowledgeEvidenceRelationKind;
  evidenceSummary: string;
  createdAt: string;
}

export interface KnowledgeGraphCitation {
  id: string;
  citingPaperId: string;
  citedPaperId: string;
  context?: string | null;
  createdAt: string;
}

export interface CitationCentralityEntry {
  paperId: string;
  title: string;
  year?: number;
  venue?: string | null;
  inDegree: number;
  outDegree: number;
  citationCount: number;
  degreeCentrality: number;
}

export interface CitationPathResult {
  nodes: Array<{
    paperId: string;
    title: string;
    year?: number;
    venue?: string | null;
  }>;
  edges: Array<{
    citingPaperId: string;
    citedPaperId: string;
    citingTitle: string;
    citedTitle: string;
    context?: string | null;
  }>;
  length: number;
}

export interface CitationSubgraph {
  nodes: Array<{
    paperId: string;
    title: string;
    year?: number;
    venue?: string | null;
  }>;
  edges: Array<{
    citingPaperId: string;
    citedPaperId: string;
    citingTitle: string;
    citedTitle: string;
    context?: string | null;
  }>;
}

export interface InterestAgentState {
  id: string;
  name: string;
  role: string;
  status: "running" | "done" | "failed";
  summary?: string;
  error?: string;
}

export interface InterestPlanRunSnapshot {
  status?: string;
  learningPath?: LearningPath;
  agents: InterestAgentState[];
  error?: string;
  updatedAt: number;
}

export type InterestPlanRunSnapshots = Record<string, InterestPlanRunSnapshot>;

export interface KnowledgeGraphSummary {
  interestCount: number;
  paperCount: number;
  noteCount: number;
  experimentCount: number;
  claimCount: number;
  evidenceCount: number;
  citationCount: number;
}

export interface KnowledgeGraphSnapshot {
  interests: KnowledgeGraphInterest[];
  papers: KnowledgeGraphPaper[];
  notes: KnowledgeGraphNote[];
  experiments: KnowledgeGraphExperiment[];
  claims: KnowledgeGraphClaim[];
  evidenceLinks: KnowledgeGraphEvidenceLink[];
  citations: KnowledgeGraphCitation[];
  summary: KnowledgeGraphSummary;
}

export const CLAIM_STATUS_META: Record<KnowledgeClaimStatus, { label: string; tone: string }> = {
  hypothesis: { label: "待验证", tone: "rgba(180, 140, 20, 0.18)" },
  supported: { label: "已支持", tone: "rgba(46, 125, 50, 0.16)" },
  contested: { label: "有争议", tone: "rgba(191, 54, 12, 0.16)" },
  open: { label: "开放问题", tone: "rgba(2, 119, 189, 0.16)" },
};

export const RELATION_META: Record<KnowledgeEvidenceRelationKind, { label: string; tone: string }> = {
  supports: { label: "支持", tone: "rgba(46, 125, 50, 0.14)" },
  contradicts: { label: "冲突", tone: "rgba(191, 54, 12, 0.14)" },
  background: { label: "背景", tone: "rgba(90, 90, 105, 0.12)" },
};

export function interestDisplayName(interest?: Pick<KnowledgeGraphInterest, "topic" | "folderName"> | null) {
  return interest?.folderName?.trim() || interest?.topic || "未归类";
}

export function buildInterestSelectOptions(
  interests: Array<Pick<KnowledgeGraphInterest, "id" | "topic" | "folderName">> = [],
) {
  return [
    { value: "", label: "全部研究主题" },
    ...interests.map((item) => ({
      value: item.id,
      label: interestDisplayName(item),
    })),
  ];
}

export function truncateText(text: string, max = 140) {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length <= max ? normalized : `${normalized.slice(0, max - 1)}…`;
}

export function sourceKindLabel(kind: KnowledgeGraphSourceKind) {
  if (kind === "paper") return "论文";
  if (kind === "experiment") return "实验";
  return "笔记";
}

export function buildNoteClaimCountMap(evidenceLinks: KnowledgeGraphEvidenceLink[]) {
  return evidenceLinks.reduce<Record<string, number>>((acc, item) => {
    if (item.sourceKind !== "note") return acc;
    acc[item.sourceId] = (acc[item.sourceId] ?? 0) + 1;
    return acc;
  }, {});
}

export type SurveyAgentStatus = "running" | "done" | "failed";

export interface SurveyAgentState {
  id: string;
  name: string;
  role: string;
  status: SurveyAgentStatus;
  summary?: string;
  error?: string;
}

export interface SurveyPaperResult {
  id: string;
  title: string;
  authors?: string;
  abstract?: string;
  year?: number;
  venue?: string;
  doi?: string;
  ccf_rating?: string;
  ccf_area?: string;
  ccf_type?: string;
  ccf_label?: string;
  ccf_publisher?: string;
  paper_url?: string;
  venue_url?: string;
}

export interface StructuredSurveyResult {
  query: string;
  report: {
    background?: string;
    development_timeline?: Array<{
      period?: string;
      milestone?: string;
      key_works?: string[];
      significance?: string;
    }>;
    major_methods?: Array<{
      name?: string;
      description?: string;
      representative_papers?: string[];
      pros?: string;
      cons?: string;
    }>;
    schools_of_thought?: Array<{
      name?: string;
      description?: string;
      representatives?: string[];
    }>;
    methodology_summary?: {
      mainstream?: string;
      emerging?: string;
      comparison?: string;
    };
    research_trends?: Array<{ trend?: string; signal?: string }>;
    controversies?: Array<{ topic?: string; positions?: string[] }>;
    challenges?: string[];
    research_gaps?: string[];
    future_directions?: string[];
    recommended_topics?: Array<{ topic?: string; why?: string; first_step?: string }>;
    overall_summary?: string;
    current_frontier?: string;
    earliest_period?: string;
  };
  papers: SurveyPaperResult[];
  formatted_citations?: string[];
  citation_format?: string;
  meta?: {
    time_range?: string;
    lit_types?: string;
    databases?: string;
    language?: string;
  };
}

export type SurveyRunStatus = "idle" | "running" | "done" | "failed";

export interface SurveyRunSnapshot {
  requestId: string;
  status: SurveyRunStatus;
  query: string;
  maxPapers: number;
  timeFrom?: number;
  timeTo?: number;
  litTypes: string[];
  databases: string[];
  citationFormat: string;
  language: string;
  paperIds?: string[];
  selectedInterestId?: string;
  content: string;
  agents: SurveyAgentState[];
  structured: StructuredSurveyResult | null;
  error?: string;
  updatedAt: number;
}

export const SURVEY_DEFAULT_MAX_PAPERS = 20;
export const SURVEY_MIN_PAPERS = 5;
export const SURVEY_MAX_PAPERS = 50;
export const SURVEY_MIN_YEAR = 1900;
export const SURVEY_MAX_YEAR = new Date().getFullYear() + 1;
export const SURVEY_PAPER_LIMIT_PRESETS = [10, 20, 30, 40];

export const LIT_TYPE_OPTIONS = [
  { value: "期刊论文", label: "期刊论文" },
  { value: "会议论文", label: "会议论文" },
  { value: "学位论文", label: "学位论文" },
  { value: "预印本", label: "预印本" },
  { value: "专著", label: "专著" },
];

export const DATABASE_OPTIONS = [
  "CNKI",
  "万方",
  "PubMed",
  "Web of Science",
  "Scopus",
  "IEEE Xplore",
  "arXiv",
  "ACM DL",
];

export const CITATION_FORMATS = [
  { value: "gbt7714", label: "GB/T 7714（国标）" },
  { value: "apa", label: "APA" },
  { value: "mla", label: "MLA" },
  { value: "ieee", label: "IEEE" },
];

export const LANGUAGE_OPTIONS = [
  { value: "both", label: "中英文均可" },
  { value: "zh", label: "仅中文" },
  { value: "en", label: "仅英文" },
];

export function researchInterestDisplayName(interest: Pick<ResearchInterest, "topic" | "folder_name">) {
  return interest.folder_name?.trim() || interest.topic;
}

export function citationFormatLabel(value?: string) {
  return CITATION_FORMATS.find((format) => format.value === value)?.label ?? CITATION_FORMATS[0].label;
}

export function normalizeSurveyYearInput(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) return { value: undefined as number | undefined };
  if (!/^\d{4}$/.test(trimmed)) {
    return { value: undefined, error: `${label}请输入 4 位年份。` };
  }
  const year = Number(trimmed);
  if (year < SURVEY_MIN_YEAR || year > SURVEY_MAX_YEAR) {
    return { value: undefined, error: `${label}需在 ${SURVEY_MIN_YEAR}-${SURVEY_MAX_YEAR} 之间。` };
  }
  return { value: year };
}

export function normalizeSurveyPaperLimit(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return { value: undefined as number | undefined, error: "请填写候选文献数量。" };
  }
  const count = Number(trimmed);
  if (!Number.isInteger(count)) {
    return { value: undefined, error: "候选文献数量需为整数。" };
  }
  if (count < SURVEY_MIN_PAPERS || count > SURVEY_MAX_PAPERS) {
    return { value: undefined, error: `候选文献数量需在 ${SURVEY_MIN_PAPERS}-${SURVEY_MAX_PAPERS} 篇之间。` };
  }
  return { value: count };
}

export interface SurveyGenerationInput {
  query: string;
  timeFrom: string;
  timeTo: string;
  maxPapers: string;
}

export interface SurveyGenerationValidation {
  error?: string;
  query: string;
  timeFrom?: number;
  timeTo?: number;
  maxPapers: number;
}

export interface SurveyGenerationController {
  interests: ResearchInterest[];
  selectedInterestId: string;
  selectInterest: (id: string) => void;
  interestPapers: Paper[];
  loadingPapers: boolean;
  selectedPaperIds: string[];
  allPapersSelected: boolean;
  somePapersSelected: boolean;
  selectedPaperLimitMessage: string;
  togglePaper: (id: string) => void;
  toggleAllPapers: () => void;
  query: string;
  setQuery: (value: string) => void;
  advancedOpen: boolean;
  setAdvancedOpen: (value: boolean | ((previous: boolean) => boolean)) => void;
  maxPapers: string;
  setMaxPapers: (value: string) => void;
  effectiveMaxPapers: number;
  timeFrom: string;
  setTimeFrom: (value: string) => void;
  timeTo: string;
  setTimeTo: (value: string) => void;
  litTypes: string[];
  toggleLitType: (value: string) => void;
  databases: string[];
  toggleDatabase: (value: string) => void;
  citationFormat: string;
  setCitationFormat: (value: string) => void;
  language: string;
  setLanguage: (value: string) => void;
  citationFormatLabel: string;
  hasAdvancedSettings: boolean;
  generating: boolean;
  content: string;
  agents: SurveyAgentState[];
  structured: StructuredSurveyResult | null;
  error: string;
  actionMessage: string;
  actionError: string;
  savingNote: boolean;
  copying: boolean;
  hasResults: boolean;
  canSaveResult: boolean;
  canResumeFailedRun: boolean;
  handleGenerate: () => Promise<void>;
  handleResumeFailedRun: () => Promise<void>;
  copySurveyMarkdown: () => Promise<void>;
  saveSurveyAsNote: () => Promise<void>;
}

export function validateSurveyGenerationInput(input: SurveyGenerationInput): SurveyGenerationValidation {
  const query = input.query.trim();
  if (!query) {
    return { error: "请先输入研究问题。", query, maxPapers: SURVEY_DEFAULT_MAX_PAPERS };
  }

  const from = normalizeSurveyYearInput(input.timeFrom, "起始年份");
  if (from.error) return { error: from.error, query, maxPapers: SURVEY_DEFAULT_MAX_PAPERS };
  const to = normalizeSurveyYearInput(input.timeTo, "截止年份");
  if (to.error) return { error: to.error, query, maxPapers: SURVEY_DEFAULT_MAX_PAPERS };
  if (from.value && to.value && from.value > to.value) {
    return { error: "起始年份不能晚于截止年份。", query, maxPapers: SURVEY_DEFAULT_MAX_PAPERS };
  }

  const limit = normalizeSurveyPaperLimit(input.maxPapers);
  if (limit.error || !limit.value) {
    return { error: limit.error, query, maxPapers: SURVEY_DEFAULT_MAX_PAPERS };
  }

  return {
    query,
    timeFrom: from.value,
    timeTo: to.value,
    maxPapers: limit.value,
  };
}
