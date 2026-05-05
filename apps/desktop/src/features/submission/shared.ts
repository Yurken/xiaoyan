import type { VenueTemplate } from "../../data/venues";

export type CcfRating = "A" | "B" | "C" | "none";
export type SubmissionStatus = "writing" | "submitted" | "reviewing" | "accepted" | "rejected";
export type VenueType = "conference" | "journal";

export interface Conference {
  id: string;
  type: "conference";
  name: string;
  fullName: string;
  website?: string;
  deadline: Date;
  notificationDate?: Date;
  ccf: CcfRating;
  area: string;
  starred: boolean;
  ei?: boolean;
}

export interface Journal {
  id: string;
  type: "journal";
  name: string;
  fullName: string;
  website?: string;
  ccf: CcfRating;
  area: string;
  starred: boolean;
  sci?: boolean;
  sciQuartile?: "Q1" | "Q2" | "Q3" | "Q4";
  ei?: boolean;
  specialIssueDeadline?: Date;
  specialIssueTitle?: string;
}

export type Venue = Conference | Journal;

export interface Submission {
  id: string;
  title: string;
  venue: string;
  venueType: VenueType;
  status: SubmissionStatus;
  deadline?: Date;
  submittedAt?: Date;
}

export interface ChecklistItem {
  id: string;
  submissionId?: string;
  label: string;
  checked: boolean;
  category: string;
  sortOrder?: number;
}

export interface AddSubmissionFormState {
  title: string;
  venue: string;
  venueType: VenueType;
  deadline: string;
}

export type RecommendationTargetType = "all" | VenueType;
export type RecommendationTargetRank = "any" | "ccf-a" | "ccf-b" | "ccf-c" | "sci-q1" | "sci-q2" | "sci" | "custom";
export type RecommendationRiskPreference = "safe" | "balanced" | "stretch";
export type RecommendationTimePreference = "fast" | "normal" | "any";
export type RecommendationTier = "stretch" | "primary" | "backup";
export type RecommendationRiskLevel = "low" | "medium" | "high";
export type SubmissionTimelineStepState = "done" | "active" | "pending";

export interface VenueRecommendationInput {
  title: string;
  abstract: string;
  keywords: string;
  direction: string;
  targetType: RecommendationTargetType;
  targetRank: RecommendationTargetRank;
  customRank: string;
  riskPreference: RecommendationRiskPreference;
  timePreference: RecommendationTimePreference;
  extra: string;
}

export interface VenueRecommendation extends VenueTemplate {
  reason: string;
  matchScore: number;
  matchTags: string[];
  tier: RecommendationTier;
  riskLevel: RecommendationRiskLevel;
  riskTips: string[];
  rejectionReasons: string[];
}

export interface SubmissionTimelineStep {
  key: string;
  label: string;
  state: SubmissionTimelineStepState;
  detail: string;
}

export interface RejectionRecoveryTarget {
  id: string;
  name: string;
  fullName: string;
  type: VenueType;
  area: string;
  ccf: CcfRating;
  sci?: boolean;
  sciQuartile?: "Q1" | "Q2" | "Q3" | "Q4";
  reason: string;
}

export interface RejectionRecoveryPlan {
  submission: Submission;
  summary: string;
  actions: string[];
  targets: RejectionRecoveryTarget[];
}

export type ReviewVerdict = "accept" | "minor_revision" | "major_revision" | "reject";

export interface ReviewComment {
  id: string;
  submissionId: string;
  round: number;
  reviewer: string;
  content: string;
  response: string;
  resolved: boolean;
  tags: string[];
  createdAt: Date;
}

export interface ReviewRound {
  submissionId: string;
  round: number;
  verdict: ReviewVerdict;
  receivedAt: Date;
}

export interface PaperVersion {
  id: string;
  submissionId: string;
  tag: string;
  label: string;
  stage: SubmissionStatus;
  content: string;
  notes: string;
  createdAt: Date;
  filePath?: string;
  fileName?: string;
}

export interface SaveVersionFormState {
  tag: string;
  label: string;
  notes: string;
  content: string;
}

export type MockStrictness = "lenient" | "balanced" | "strict";

export interface MockReviewInput {
  abstract: string;
  reviewerCount: number;
  strictness: MockStrictness;
}

export interface MockReviewerResult {
  reviewer: string;
  content: string;
  tags: string[];
  verdict: ReviewVerdict;
}

export interface ReviewFormState {
  reviewer: string;
  content: string;
  tags: string[];
  verdict: ReviewVerdict;
}

export type DiffLine = { type: "same" | "add" | "remove"; text: string };

export function computeLineDiff(oldText: string, newText: string): DiffLine[] {
  const beforeLines = oldText.split("\n").filter((line) => line.trim() !== "");
  const afterLines = newText.split("\n").filter((line) => line.trim() !== "");
  const beforeCount = beforeLines.length;
  const afterCount = afterLines.length;
  const dp: number[][] = Array.from({ length: beforeCount + 1 }, () => new Array(afterCount + 1).fill(0));

  for (let beforeIndex = 1; beforeIndex <= beforeCount; beforeIndex += 1) {
    for (let afterIndex = 1; afterIndex <= afterCount; afterIndex += 1) {
      dp[beforeIndex][afterIndex] =
        beforeLines[beforeIndex - 1] === afterLines[afterIndex - 1]
          ? dp[beforeIndex - 1][afterIndex - 1] + 1
          : Math.max(dp[beforeIndex - 1][afterIndex], dp[beforeIndex][afterIndex - 1]);
    }
  }

  const result: DiffLine[] = [];
  let beforeIndex = beforeCount;
  let afterIndex = afterCount;

  while (beforeIndex > 0 || afterIndex > 0) {
    if (
      beforeIndex > 0 &&
      afterIndex > 0 &&
      beforeLines[beforeIndex - 1] === afterLines[afterIndex - 1]
    ) {
      result.unshift({ type: "same", text: beforeLines[beforeIndex - 1] });
      beforeIndex -= 1;
      afterIndex -= 1;
      continue;
    }

    if (
      afterIndex > 0 &&
      (beforeIndex === 0 || dp[beforeIndex][afterIndex - 1] >= dp[beforeIndex - 1][afterIndex])
    ) {
      result.unshift({ type: "add", text: afterLines[afterIndex - 1] });
      afterIndex -= 1;
      continue;
    }

    result.unshift({ type: "remove", text: beforeLines[beforeIndex - 1] });
    beforeIndex -= 1;
  }

  return result;
}

export function normalizeVerdict(value: unknown): ReviewVerdict {
  if (value === "accept" || value === "minor_revision" || value === "major_revision" || value === "reject") {
    return value;
  }
  return "major_revision";
}

export function countVerdicts(items: Array<{ verdict: ReviewVerdict }>): Record<ReviewVerdict, number> {
  return items.reduce<Record<ReviewVerdict, number>>(
    (accumulator, item) => {
      accumulator[item.verdict] = (accumulator[item.verdict] ?? 0) + 1;
      return accumulator;
    },
    { accept: 0, minor_revision: 0, major_revision: 0, reject: 0 }
  );
}

export function getDominantVerdict(counts: Record<ReviewVerdict, number>): ReviewVerdict {
  return (Object.entries(counts) as [ReviewVerdict, number][])
    .sort((left, right) => right[1] - left[1])[0][0];
}

export const VERDICT_CFG: Record<ReviewVerdict, { label: string; color: string; bg: string }> = {
  accept: { label: "接收", color: "#34C759", bg: "rgba(52,199,89,0.12)" },
  minor_revision: { label: "小修", color: "#007AFF", bg: "rgba(0,122,255,0.12)" },
  major_revision: { label: "大修", color: "#FF9500", bg: "rgba(255,149,0,0.12)" },
  reject: { label: "拒稿", color: "#FF3B30", bg: "rgba(255,59,48,0.12)" },
};

export const REVIEW_TAGS = ["实验", "写作", "方法", "贡献", "相关工作", "理论", "复杂度", "消融实验"];

export const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { id: "c1", label: "标题符合会议主题方向", checked: false, category: "内容" },
  { id: "c2", label: "摘要不超过字数限制", checked: false, category: "内容" },
  { id: "c3", label: "关键词已选择（3–5 个）", checked: false, category: "内容" },
  { id: "c4", label: "页面数量符合要求", checked: false, category: "格式" },
  { id: "c5", label: "字体与字号符合模板", checked: false, category: "格式" },
  { id: "c6", label: "页边距符合规定", checked: false, category: "格式" },
  { id: "c7", label: "图表清晰可读（≥ 300 DPI）", checked: false, category: "格式" },
  { id: "c8", label: "参考文献格式统一", checked: false, category: "格式" },
  { id: "c9", label: "作者顺序已确认", checked: false, category: "提交" },
  { id: "c10", label: "作者单位信息正确", checked: false, category: "提交" },
  { id: "c11", label: "利益冲突声明已填写（如需）", checked: false, category: "提交" },
  { id: "c12", label: "补充材料准备完毕（如需）", checked: false, category: "提交" },
  { id: "c13", label: "匿名化处理完成（双盲投稿）", checked: false, category: "合规" },
  { id: "c14", label: "自查重复率 < 15%", checked: false, category: "合规" },
  { id: "c15", label: "AI 使用声明（如需）", checked: false, category: "合规" },
];

export function getDaysUntil(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export function getDdlStyle(days: number): { label: string; color: string; bg: string } {
  if (days < 0) return { label: "已截止", color: "#8E8E93", bg: "rgba(142,142,147,0.12)" };
  if (days <= 7) return { label: `${days} 天`, color: "#FF3B30", bg: "rgba(255,59,48,0.12)" };
  if (days <= 30) return { label: `${days} 天`, color: "#FF9500", bg: "rgba(255,149,0,0.12)" };
  return { label: `${days} 天`, color: "#34C759", bg: "rgba(52,199,89,0.12)" };
}

export const CCF_STYLE: Record<CcfRating, { color: string; bg: string }> = {
  A: { color: "#FF3B30", bg: "rgba(255,59,48,0.10)" },
  B: { color: "#FF9500", bg: "rgba(255,149,0,0.10)" },
  C: { color: "#007AFF", bg: "rgba(0,122,255,0.10)" },
  none: { color: "#8E8E93", bg: "rgba(142,142,147,0.10)" },
};

export const STATUS_CFG: Record<SubmissionStatus, { label: string; color: string; bg: string }> = {
  writing: { label: "撰写中", color: "#AF52DE", bg: "rgba(175,82,222,0.10)" },
  submitted: { label: "已投稿", color: "#007AFF", bg: "rgba(0,122,255,0.10)" },
  reviewing: { label: "审稿中", color: "#FF9500", bg: "rgba(255,149,0,0.10)" },
  accepted: { label: "已接收", color: "#34C759", bg: "rgba(52,199,89,0.10)" },
  rejected: { label: "已拒绝", color: "#8E8E93", bg: "rgba(142,142,147,0.10)" },
};

export const KANBAN_COLS: { key: SubmissionStatus; label: string }[] = [
  { key: "writing", label: "撰写中" },
  { key: "submitted", label: "已投稿" },
  { key: "reviewing", label: "审稿中" },
  { key: "accepted", label: "已接收" },
  { key: "rejected", label: "已拒绝" },
];

const TIMELINE_STEP_KEYS: SubmissionStatus[] = ["writing", "submitted", "reviewing", "accepted"];

function formatDate(date?: Date): string {
  return date ? date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" }) : "";
}

function daysSince(date?: Date): number | null {
  if (!date) return null;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24)));
}

export function buildSubmissionTimeline(submission: Submission): SubmissionTimelineStep[] {
  const statusIndex =
    submission.status === "rejected"
      ? TIMELINE_STEP_KEYS.indexOf("reviewing")
      : TIMELINE_STEP_KEYS.indexOf(submission.status);
  const waitingDays = daysSince(submission.submittedAt);

  return TIMELINE_STEP_KEYS.map((key, index) => {
    const state: SubmissionTimelineStepState =
      index < statusIndex ? "done" : index === statusIndex ? "active" : "pending";

    if (key === "writing") {
      const deadlineDetail =
        submission.deadline && submission.venueType === "conference"
          ? `DDL ${formatDate(submission.deadline)}`
          : "材料准备";
      return { key, label: "准备", state, detail: deadlineDetail };
    }

    if (key === "submitted") {
      return {
        key,
        label: "提交",
        state,
        detail: submission.submittedAt ? `已投 ${formatDate(submission.submittedAt)}` : "待提交",
      };
    }

    if (key === "reviewing") {
      const detail =
        submission.status === "rejected"
          ? "转投评估"
          : waitingDays !== null && submission.status === "reviewing"
            ? `等待 ${waitingDays} 天`
            : "等待外审";
      return { key, label: "外审", state, detail };
    }

    return {
      key,
      label: "结果",
      state: submission.status === "accepted" ? "done" : state,
      detail: submission.status === "accepted" ? "已录用" : submission.status === "rejected" ? "已拒稿" : "待决定",
    };
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToVenue(row: any): Venue {
  if (row.type === "journal") {
    return {
      id: row.id,
      type: "journal",
      name: row.name,
      fullName: row.fullName ?? "",
      website: row.website || undefined,
      ccf: (row.ccf || "none") as CcfRating,
      area: row.area ?? "",
      starred: Boolean(row.starred),
      sci: Boolean(row.sci),
      sciQuartile: row.sciQuartile || undefined,
      ei: Boolean(row.ei),
      specialIssueDeadline: row.specialIssueDeadline ? new Date(row.specialIssueDeadline) : undefined,
      specialIssueTitle: row.specialIssueTitle || undefined,
    } satisfies Journal;
  }

  return {
    id: row.id,
    type: "conference",
    name: row.name,
    fullName: row.fullName ?? "",
    website: row.website || undefined,
    deadline: row.deadline ? new Date(row.deadline) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    notificationDate: row.notificationDate ? new Date(row.notificationDate) : undefined,
    ccf: (row.ccf || "none") as CcfRating,
    area: row.area ?? "",
    starred: Boolean(row.starred),
    ei: Boolean(row.ei),
  } satisfies Conference;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToSubmission(row: any): Submission {
  return {
    id: row.id,
    title: row.title,
    venue: row.venueName ?? "",
    venueType: (row.venueType ?? "conference") as VenueType,
    status: (row.status ?? "writing") as SubmissionStatus,
    deadline: row.deadline ? new Date(row.deadline) : undefined,
    submittedAt: row.submittedAt ? new Date(row.submittedAt) : undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToVersion(row: any): PaperVersion {
  return {
    id: row.id,
    submissionId: row.submissionId,
    tag: row.tag ?? "",
    label: row.label ?? "",
    stage: (row.stage ?? "writing") as SubmissionStatus,
    content: row.content ?? "",
    notes: row.notes ?? "",
    createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
    filePath: row.filePath ?? undefined,
    fileName: row.fileName ?? undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToChecklistItem(row: any): ChecklistItem {
  return {
    id: row.id,
    submissionId: row.submissionId,
    label: row.label ?? "",
    checked: Boolean(row.checked),
    category: row.category ?? "",
    sortOrder: row.sortOrder,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToRound(row: any): ReviewRound {
  return {
    submissionId: row.submissionId,
    round: row.round,
    verdict: normalizeVerdict(row.verdict),
    receivedAt: row.receivedAt ? new Date(row.receivedAt) : new Date(),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToComment(row: any): ReviewComment {
  return {
    id: row.id,
    submissionId: row.submissionId,
    round: row.round,
    reviewer: row.reviewer ?? "",
    content: row.content ?? "",
    response: row.response ?? "",
    resolved: Boolean(row.resolved),
    tags: Array.isArray(row.tags) ? row.tags : [],
    createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
  };
}
