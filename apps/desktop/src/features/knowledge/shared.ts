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
    { value: "", label: "全部研究方向" },
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
