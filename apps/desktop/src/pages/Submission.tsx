import { useState, useEffect, useRef } from "react";
import { submissionApi } from "../lib/client";
import { listen } from "@tauri-apps/api/event";
import {
  Bell,
  Bot,
  BookOpen,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  CheckSquare,
  Circle,
  Clock,
  Download,
  FilePlus,
  GitBranch,
  History,
  KanbanSquare,
  Loader2,
  Plus,
  Save,
  Search,
  Sparkles,
  Star,
  StarOff,
  Trophy,
  Upload,
  Users,
  X,
} from "lucide-react";
import { Button, Card } from "@research-copilot/ui";
import { open } from "@tauri-apps/plugin-dialog";
import {
  POPULAR_VENUES,
  getAllAreas,
  type VenueTemplate,
} from "../data/venues";
import ExternalLink from "../components/ExternalLink";

// ─── Types ────────────────────────────────────────────────────────────────────

type CcfRating = "A" | "B" | "C" | "none";
type SubmissionStatus = "writing" | "submitted" | "reviewing" | "accepted" | "rejected";
type VenueType = "conference" | "journal";

interface Conference {
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

interface Journal {
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
  // 期刊特刊截止日期
  specialIssueDeadline?: Date;
  specialIssueTitle?: string;
}

type Venue = Conference | Journal;

interface Submission {
  id: string;
  title: string;
  venue: string;
  venueType: VenueType;
  status: SubmissionStatus;
  deadline?: Date;
  submittedAt?: Date;
}

interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
  category: string;
}

interface VenueRecommendation extends VenueTemplate {
  reason: string;
  matchScore: number;
  matchTags: string[];
}

type ReviewVerdict = "accept" | "minor_revision" | "major_revision" | "reject";

interface ReviewComment {
  id: string;
  submissionId: string;
  round: number;
  reviewer: string;     // "Reviewer 1", "AC" 等
  content: string;      // 审稿意见原文
  response: string;     // 作者回复（可空）
  resolved: boolean;    // 是否已处理
  tags: string[];       // "实验" | "写作" | "方法" | "贡献" 等
  createdAt: Date;
}

interface ReviewRound {
  submissionId: string;
  round: number;
  verdict: ReviewVerdict;
  receivedAt: Date;
}

interface PaperVersion {
  id: string;
  submissionId: string;
  tag: string;           // e.g. "v1.0"
  label: string;         // e.g. "初稿", "按审稿意见修改"
  stage: SubmissionStatus;
  content: string;       // 摘要或核心内容快照
  notes: string;         // 本次修改说明
  createdAt: Date;
  filePath?: string;     // 论文文件路径
  fileName?: string;     // 论文文件名
}

// ─── AI Review Types ──────────────────────────────────────────────────────────

type MockStrictness = "lenient" | "balanced" | "strict";

interface MockReviewerResult {
  reviewer: string;
  content: string;
  tags: string[];
  verdict: ReviewVerdict;
}

// ─── Diff ─────────────────────────────────────────────────────────────────────

type DiffLine = { type: "same" | "add" | "remove"; text: string };

function computeLineDiff(oldText: string, newText: string): DiffLine[] {
  const a = oldText.split("\n").filter(l => l.trim() !== "");
  const b = newText.split("\n").filter(l => l.trim() !== "");
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  const result: DiffLine[] = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      result.unshift({ type: "same",   text: a[i - 1] }); i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: "add",    text: b[j - 1] }); j--;
    } else {
      result.unshift({ type: "remove", text: a[i - 1] }); i--;
    }
  }
  return result;
}

// ─── Helpers for DB → typed objects ──────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToVenue(r: any): Venue {
  if (r.type === "journal") {
    return {
      id: r.id, type: "journal",
      name: r.name, fullName: r.fullName ?? "",
      website: r.website || undefined,
      ccf: (r.ccf || "none") as CcfRating,
      area: r.area ?? "",
      starred: Boolean(r.starred),
      sci: Boolean(r.sci), sciQuartile: r.sciQuartile || undefined,
      ei: Boolean(r.ei),
      specialIssueDeadline: r.specialIssueDeadline ? new Date(r.specialIssueDeadline) : undefined,
      specialIssueTitle: r.specialIssueTitle || undefined,
    } satisfies Journal;
  }
  return {
    id: r.id, type: "conference",
    name: r.name, fullName: r.fullName ?? "",
    website: r.website || undefined,
    deadline: r.deadline ? new Date(r.deadline) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    notificationDate: r.notificationDate ? new Date(r.notificationDate) : undefined,
    ccf: (r.ccf || "none") as CcfRating,
    area: r.area ?? "",
    starred: Boolean(r.starred),
    ei: Boolean(r.ei),
  } satisfies Conference;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToSubmission(r: any): Submission {
  return {
    id: r.id, title: r.title,
    venue: r.venueName ?? "",
    venueType: (r.venueType ?? "conference") as VenueType,
    status: (r.status ?? "writing") as SubmissionStatus,
    deadline: r.deadline ? new Date(r.deadline) : undefined,
    submittedAt: r.submittedAt ? new Date(r.submittedAt) : undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToVersion(r: any): PaperVersion {
  return {
    id: r.id, submissionId: r.submissionId,
    tag: r.tag ?? "", label: r.label ?? "",
    stage: (r.stage ?? "writing") as SubmissionStatus,
    content: r.content ?? "", notes: r.notes ?? "",
    createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
    filePath: r.filePath ?? undefined,
    fileName: r.fileName ?? undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToRound(r: any): ReviewRound {
  return {
    submissionId: r.submissionId, round: r.round,
    verdict: normalizeVerdict(r.verdict),
    receivedAt: r.receivedAt ? new Date(r.receivedAt) : new Date(),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToComment(r: any): ReviewComment {
  return {
    id: r.id, submissionId: r.submissionId, round: r.round,
    reviewer: r.reviewer ?? "", content: r.content ?? "",
    response: r.response ?? "", resolved: Boolean(r.resolved),
    tags: Array.isArray(r.tags) ? r.tags : [],
    createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
  };
}

function normalizeVerdict(value: unknown): ReviewVerdict {
  if (value === "accept" || value === "minor_revision" || value === "major_revision" || value === "reject") {
    return value;
  }
  return "major_revision";
}

const VERDICT_CFG: Record<ReviewVerdict, { label: string; color: string; bg: string }> = {
  accept:           { label: "接收",     color: "#34C759", bg: "rgba(52,199,89,0.12)"   },
  minor_revision:   { label: "小修",     color: "#007AFF", bg: "rgba(0,122,255,0.12)"   },
  major_revision:   { label: "大修",     color: "#FF9500", bg: "rgba(255,149,0,0.12)"   },
  reject:           { label: "拒稿",     color: "#FF3B30", bg: "rgba(255,59,48,0.12)"   },
};

const REVIEW_TAGS = ["实验", "写作", "方法", "贡献", "相关工作", "理论", "复杂度", "消融实验"];

const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { id: "c1",  label: "标题符合会议主题方向",           checked: false, category: "内容" },
  { id: "c2",  label: "摘要不超过字数限制",             checked: false, category: "内容" },
  { id: "c3",  label: "关键词已选择（3–5 个）",         checked: false, category: "内容" },
  { id: "c4",  label: "页面数量符合要求",               checked: false, category: "格式" },
  { id: "c5",  label: "字体与字号符合模板",             checked: false, category: "格式" },
  { id: "c6",  label: "页边距符合规定",                 checked: false, category: "格式" },
  { id: "c7",  label: "图表清晰可读（≥ 300 DPI）",      checked: false, category: "格式" },
  { id: "c8",  label: "参考文献格式统一",               checked: false, category: "格式" },
  { id: "c9",  label: "作者顺序已确认",                 checked: false, category: "提交" },
  { id: "c10", label: "作者单位信息正确",               checked: false, category: "提交" },
  { id: "c11", label: "利益冲突声明已填写（如需）",     checked: false, category: "提交" },
  { id: "c12", label: "补充材料准备完毕（如需）",       checked: false, category: "提交" },
  { id: "c13", label: "匿名化处理完成（双盲投稿）",     checked: false, category: "合规" },
  { id: "c14", label: "自查重复率 < 15%",               checked: false, category: "合规" },
  { id: "c15", label: "AI 使用声明（如需）",            checked: false, category: "合规" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDaysUntil(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function getDdlStyle(days: number): { label: string; color: string; bg: string } {
  if (days < 0)   return { label: "已截止",      color: "#8E8E93", bg: "rgba(142,142,147,0.12)" };
  if (days <= 7)  return { label: `${days} 天`,  color: "#FF3B30", bg: "rgba(255,59,48,0.12)" };
  if (days <= 30) return { label: `${days} 天`,  color: "#FF9500", bg: "rgba(255,149,0,0.12)" };
  return              { label: `${days} 天`,  color: "#34C759", bg: "rgba(52,199,89,0.12)" };
}

const CCF_STYLE: Record<CcfRating, { color: string; bg: string }> = {
  A:    { color: "#FF3B30", bg: "rgba(255,59,48,0.10)" },
  B:    { color: "#FF9500", bg: "rgba(255,149,0,0.10)" },
  C:    { color: "#007AFF", bg: "rgba(0,122,255,0.10)" },
  none: { color: "#8E8E93", bg: "rgba(142,142,147,0.10)" },
};

const STATUS_CFG: Record<SubmissionStatus, { label: string; color: string; bg: string }> = {
  writing:   { label: "撰写中", color: "#AF52DE", bg: "rgba(175,82,222,0.10)" },
  submitted: { label: "已投稿", color: "#007AFF", bg: "rgba(0,122,255,0.10)" },
  reviewing: { label: "审稿中", color: "#FF9500", bg: "rgba(255,149,0,0.10)" },
  accepted:  { label: "已接收", color: "#34C759", bg: "rgba(52,199,89,0.10)" },
  rejected:  { label: "已拒绝", color: "#8E8E93", bg: "rgba(142,142,147,0.10)" },
};

const KANBAN_COLS: { key: SubmissionStatus; label: string }[] = [
  { key: "writing",   label: "撰写中" },
  { key: "submitted", label: "已投稿" },
  { key: "reviewing", label: "审稿中" },
  { key: "accepted",  label: "已接收" },
  { key: "rejected",  label: "已拒绝" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function Submission() {
  const [tab, setTab] = useState<"conferences" | "kanban" | "checklist" | "versions" | "reviews">("conferences");

  // Venue state (会议 + 期刊)
  const [conferences, setConferences] = useState<Conference[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [venueFilter, setVenueFilter] = useState<"all" | "conference" | "journal" | "starred">("all");

  // Add venue modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalSearch, setAddModalSearch] = useState("");
  const [addModalAreaFilter, setAddModalAreaFilter] = useState<string>("all");
  const [addModalTypeFilter, setAddModalTypeFilter] = useState<"all" | "conference" | "journal">("all");

  // Kanban state
  const [submissions, setSubmissions] = useState<Submission[]>([]);

  // Checklist state
  const [checklist, setChecklist] = useState<ChecklistItem[]>(DEFAULT_CHECKLIST);
  const [checklistCat, setChecklistCat] = useState<string>("all");

  // Add submission modal state
  const [showAddSubModal, setShowAddSubModal] = useState(false);
  const [addSubForm, setAddSubForm] = useState<{
    title: string; venue: string; venueType: VenueType; deadline: string;
  }>({ title: "", venue: "", venueType: "conference", deadline: "" });

  // Version control state
  const [versions, setVersions] = useState<PaperVersion[]>([]);
  const [versionSubId, setVersionSubId] = useState<string>("");
  const [compareIds, setCompareIds] = useState<[string, string] | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveForm, setSaveForm] = useState({ tag: "", label: "", notes: "", content: "" });

  // Review archive state
  const [reviewComments, setReviewComments] = useState<ReviewComment[]>([]);
  const [reviewRounds, setReviewRounds] = useState<ReviewRound[]>([]);
  const [reviewSubId, setReviewSubId] = useState<string>("");
  const [reviewRound, setReviewRound] = useState<number>(1);
  const [showAddReviewModal, setShowAddReviewModal] = useState(false);
  const [reviewForm, setReviewForm] = useState({
    reviewer: "", content: "", tags: [] as string[], verdict: "major_revision" as ReviewVerdict,
  });

  // AI review state
  const [showMockReviewModal, setShowMockReviewModal] = useState(false);
  const [mockReviewInput, setMockReviewInput] = useState<{
    abstract: string; reviewerCount: number; strictness: MockStrictness;
  }>({ abstract: "", reviewerCount: 3, strictness: "balanced" });
  const [mockReviewLoading, setMockReviewLoading] = useState(false);
  const [mockReviewResult, setMockReviewResult] = useState<MockReviewerResult[] | null>(null);
  const [mockFileExtracting, setMockFileExtracting] = useState(false);
  const [mockFileName, setMockFileName] = useState<string | null>(null);

  // Cover letter / polish state
  const [showCoverLetterModal, setShowCoverLetterModal] = useState(false);
  const [coverLetterText, setCoverLetterText] = useState("");
  const [coverLetterLoading, setCoverLetterLoading] = useState(false);
  const [showPolishPanel, setShowPolishPanel] = useState(false);
  const [polishText, setPolishText] = useState("");
  const [polishLoading, setPolishLoading] = useState(false);
  const [polishSourceId, setPolishSourceId] = useState<string>("");
  const mockReviewBufferRef = useRef<MockReviewerResult[]>([]);
  const activeMockReviewSubmissionRef = useRef<string>("");

  // ── DB data loading ──
  useEffect(() => {
    submissionApi.listVenues().then(res => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const venues = (res.venues as any[]).map(rowToVenue);
      setConferences(venues.filter(v => v.type === "conference") as Conference[]);
      setJournals(venues.filter(v => v.type === "journal") as Journal[]);
    }).catch(console.error);

    submissionApi.list().then(res => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subs = (res.submissions as any[]).map(rowToSubmission);
      setSubmissions(subs);
      if (subs.length > 0 && !versionSubId) setVersionSubId(subs[0].id);
      if (subs.length > 0 && !reviewSubId) setReviewSubId(subs[0].id);
    }).catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload versions when selected submission changes
  useEffect(() => {
    if (!versionSubId) return;
    submissionApi.listVersions(versionSubId).then(res => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setVersions((res.versions as any[]).map(rowToVersion));
    }).catch(console.error);
  }, [versionSubId]);

  // Reload rounds + comments when selected review submission changes
  useEffect(() => {
    if (!reviewSubId) return;
    Promise.all([
      submissionApi.listRounds(reviewSubId),
      submissionApi.listComments(reviewSubId),
    ]).then(([roundsRes, commentsRes]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setReviewRounds((roundsRes.rounds as any[]).map(rowToRound));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setReviewComments((commentsRes.comments as any[]).map(rowToComment));
    }).catch(console.error);
  }, [reviewSubId]);

  // AI review event listeners
  useEffect(() => {
    let unlistenReviewer: (() => void) | undefined;
    let unlistenDone: (() => void) | undefined;
    let unlistenError: (() => void) | undefined;

    listen<{ submissionId: string; index: number; reviewer: string; raw: string }>(
      "submission:ai_review:reviewer",
      ({ payload }) => {
        if (payload.submissionId !== activeMockReviewSubmissionRef.current) {
          return;
        }
        try {
          const parsed = JSON.parse(payload.raw);
          const result: MockReviewerResult = {
            reviewer: payload.reviewer,
            content: [
              parsed.summary ? `**Summary:** ${parsed.summary}` : "",
              parsed.strengths?.length ? `**Strengths:**\n${(parsed.strengths as string[]).map((s: string) => `- ${s}`).join("\n")}` : "",
              parsed.weaknesses?.length ? `**Weaknesses:**\n${(parsed.weaknesses as string[]).map((s: string) => `- ${s}`).join("\n")}` : "",
              parsed.questions?.length ? `**Questions:**\n${(parsed.questions as string[]).map((s: string) => `- ${s}`).join("\n")}` : "",
            ].filter(Boolean).join("\n\n"),
            tags: ["方法", "实验"],
            verdict: (parsed.verdict === "accept" ? "accept"
              : parsed.verdict === "weak_accept" ? "minor_revision"
              : parsed.verdict === "weak_reject" ? "major_revision"
              : "reject") as ReviewVerdict,
          };
          mockReviewBufferRef.current = [...mockReviewBufferRef.current, result];
          setMockReviewResult([...mockReviewBufferRef.current]);
        } catch {
          mockReviewBufferRef.current = [
            ...mockReviewBufferRef.current,
            { reviewer: payload.reviewer, content: payload.raw, tags: [], verdict: "major_revision" },
          ];
          setMockReviewResult([...mockReviewBufferRef.current]);
        }
      }
    ).then(u => { unlistenReviewer = u; });

    listen<{ submissionId: string }>("submission:ai_review:done", ({ payload }) => {
      if (payload.submissionId !== activeMockReviewSubmissionRef.current) {
        return;
      }
      setMockReviewLoading(false);
    }).then(u => { unlistenDone = u; });

    listen<{ submissionId: string; error: string }>("submission:ai_review:error", ({ payload }) => {
      if (payload.submissionId !== activeMockReviewSubmissionRef.current) {
        return;
      }
      setMockReviewLoading(false);
      console.error("AI review error:", payload.error);
    }).then(u => { unlistenError = u; });

    return () => {
      unlistenReviewer?.();
      unlistenDone?.();
      unlistenError?.();
    };
  }, []);

  // Cover letter event listeners
  useEffect(() => {
    let unlistenDelta: (() => void) | undefined;
    let unlistenDone: (() => void) | undefined;

    listen<{ submissionId: string; delta: string }>("submission:cover_letter:delta", ({ payload }) => {
      setCoverLetterText(prev => prev + payload.delta);
    }).then(u => { unlistenDelta = u; });

    listen<{ submissionId: string; fullText: string }>("submission:cover_letter:done", ({ payload }) => {
      setCoverLetterText(payload.fullText);
      setCoverLetterLoading(false);
    }).then(u => { unlistenDone = u; });

    return () => { unlistenDelta?.(); unlistenDone?.(); };
  }, []);

  // Polish event listeners
  useEffect(() => {
    let unlistenDelta: (() => void) | undefined;
    let unlistenDone: (() => void) | undefined;

    listen<{ submissionId: string; delta: string }>("submission:polish:delta", ({ payload }) => {
      if (payload.submissionId === reviewSubId || payload.submissionId === versionSubId) {
        setPolishText(prev => prev + payload.delta);
      }
    }).then(u => { unlistenDelta = u; });

    listen<{ submissionId: string; fullText: string }>("submission:polish:done", ({ payload }) => {
      setPolishText(payload.fullText);
      setPolishLoading(false);
    }).then(u => { unlistenDone = u; });

    return () => { unlistenDelta?.(); unlistenDone?.(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewSubId, versionSubId]);

  const handleUploadVersionFile = async (versionId: string) => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (typeof selected === "string" && selected) {
        const fileName = selected.split("/").pop() || "paper.pdf";
        setVersions(prev =>
          prev.map(v =>
            v.id === versionId
              ? { ...v, filePath: selected, fileName }
              : v
          )
        );
      }
    } catch (error) {
      console.error("Upload file failed:", error);
    }
  };

  const handleDownloadVersionFile = async (filePath?: string) => {
    if (!filePath) return;
    try {
      const { openLink } = await import("../lib/links");
      await openLink(filePath);
    } catch (error) {
      console.error("Download file failed:", error);
    }
  };

  // ── Venue helpers ──
  const allVenues: Venue[] = [...conferences, ...journals];

  const visibleVenues = allVenues
    .filter(v => {
      if (venueFilter === "starred") return v.starred;
      if (venueFilter === "conference") return v.type === "conference";
      if (venueFilter === "journal") return v.type === "journal";
      return true;
    })
    .sort((a, b) => {
      // 会议按截止日期排序，期刊按特刊截止日期或名称排序
      const dA = a.type === "conference"
        ? getDaysUntil(a.deadline)
        : a.specialIssueDeadline ? getDaysUntil(a.specialIssueDeadline) : 999;
      const dB = b.type === "conference"
        ? getDaysUntil(b.deadline)
        : b.specialIssueDeadline ? getDaysUntil(b.specialIssueDeadline) : 999;
      if (dA < 0 && dB >= 0) return 1;
      if (dB < 0 && dA >= 0) return -1;
      return dA - dB;
    });

  const toggleVenueStar = (id: string, type: VenueType) => {
    if (type === "conference") {
      setConferences(prev => prev.map(c => c.id === id ? { ...c, starred: !c.starred } : c));
    } else {
      setJournals(prev => prev.map(j => j.id === id ? { ...j, starred: !j.starred } : j));
    }
    submissionApi.toggleVenueStar(id).catch(console.error);
  };

  // ── Add venue helpers ──
  const handleAddVenue = async (template: VenueTemplate) => {
    const defaultConferenceDeadline =
      template.type === "conference"
        ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
        : null;

    try {
      const res = await submissionApi.createVenue({
        name: template.name, fullName: template.fullName,
        venueType: template.type, website: template.website,
        ccf: template.ccf, area: template.area,
        ei: template.ei, sci: (template as Journal).sci,
        sciQuartile: (template as Journal).sciQuartile,
        deadline: defaultConferenceDeadline?.toISOString().slice(0, 10),
      });
      const newId = res.id;
      if (template.type === "conference") {
        setConferences(prev => [...prev, {
          id: newId, type: "conference",
          name: template.name, fullName: template.fullName,
          website: template.website,
          deadline: defaultConferenceDeadline ?? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          ccf: template.ccf, area: template.area, starred: false, ei: template.ei,
        }]);
      } else {
        setJournals(prev => [...prev, {
          id: newId, type: "journal",
          name: template.name, fullName: template.fullName,
          website: template.website,
          ccf: template.ccf, area: template.area, starred: false,
          sci: (template as Journal).sci,
          sciQuartile: (template as Journal).sciQuartile,
          ei: template.ei,
        }]);
      }
    } catch (e) { console.error(e); }
    setShowAddModal(false);
  };

  const isVenueAdded = (template: VenueTemplate) => {
    if (template.type === "conference") {
      return conferences.some(c => c.name === template.name);
    }
    return journals.some(j => j.name === template.name);
  };

  const filteredVenueTemplates = POPULAR_VENUES.filter(v => {
    const matchesSearch = v.name.toLowerCase().includes(addModalSearch.toLowerCase()) ||
      v.fullName.toLowerCase().includes(addModalSearch.toLowerCase());
    const matchesArea = addModalAreaFilter === "all" || v.area === addModalAreaFilter;
    const matchesType = addModalTypeFilter === "all" || v.type === addModalTypeFilter;
    return matchesSearch && matchesArea && matchesType;
  });

  const areas = getAllAreas();

  // ── Kanban helpers ──
  const moveSubmission = (id: string, direction: "prev" | "next") => {
    setSubmissions(prev => prev.map(s => {
      if (s.id !== id) return s;
      const idx = KANBAN_COLS.findIndex(c => c.key === s.status);
      const nextIdx = direction === "next" ? idx + 1 : idx - 1;
      if (nextIdx < 0 || nextIdx >= KANBAN_COLS.length) return s;
      const newStatus = KANBAN_COLS[nextIdx].key;
      const newSubmittedAt = direction === "next" && s.status === "writing" ? new Date() : s.submittedAt;
      submissionApi.update(id, {
        status: newStatus,
        submittedAt: newSubmittedAt?.toISOString().slice(0, 10),
      }).catch(console.error);
      return { ...s, status: newStatus, submittedAt: newSubmittedAt };
    }));
  };

  // ── Add submission helper ──
  const handleAddSubmission = async () => {
    if (!addSubForm.title.trim() || !addSubForm.venue.trim()) return;
    try {
      const res = await submissionApi.create({
        title: addSubForm.title.trim(),
        venueName: addSubForm.venue.trim(),
        venueType: addSubForm.venueType,
        status: "writing",
        deadline: addSubForm.deadline || undefined,
      });
      const newSub: Submission = {
        id: res.id,
        title: addSubForm.title.trim(),
        venue: addSubForm.venue.trim(),
        venueType: addSubForm.venueType,
        status: "writing",
        deadline: addSubForm.deadline ? new Date(addSubForm.deadline) : undefined,
      };
      setSubmissions(prev => [...prev, newSub]);
      if (!versionSubId) setVersionSubId(res.id);
      if (!reviewSubId) setReviewSubId(res.id);
    } catch (e) { console.error(e); }
    setShowAddSubModal(false);
    setAddSubForm({ title: "", venue: "", venueType: "conference", deadline: "" });
  };

  // ── Checklist helpers ──
  const toggleCheck = (id: string) =>
    setChecklist(prev => prev.map(i => i.id === id ? { ...i, checked: !i.checked } : i));

  const checkedCount = checklist.filter(i => i.checked).length;
  const progress = Math.round((checkedCount / checklist.length) * 100);
  const categories = ["all", ...Array.from(new Set(checklist.map(i => i.category)))];
  const filteredChecklist = checklistCat === "all" ? checklist : checklist.filter(i => i.category === checklistCat);
  const visibleCategories = checklistCat === "all"
    ? Array.from(new Set(checklist.map(i => i.category)))
    : [checklistCat];

  // ── Version helpers ──
  const versionNextTag = (() => {
    const vList = versions.filter(v => v.submissionId === versionSubId);
    if (vList.length === 0) return "v1.0";
    const last = vList[vList.length - 1].tag;
    const [major, minor] = last.replace("v", "").split(".").map(Number);
    return `v${major}.${(minor ?? 0) + 1}`;
  })();

  const handleSaveVersion = async () => {
    if (!saveForm.label.trim() || !saveForm.content.trim()) return;
    const currentSub = submissions.find(s => s.id === versionSubId);
    const tag = saveForm.tag.trim() || versionNextTag;
    try {
      const res = await submissionApi.createVersion({
        submissionId: versionSubId,
        tag, label: saveForm.label.trim(),
        stage: currentSub?.status ?? "writing",
        content: saveForm.content.trim(),
        notes: saveForm.notes.trim(),
      });
      setVersions(prev => [...prev, {
        id: res.id, submissionId: versionSubId, tag,
        label: saveForm.label.trim(),
        stage: currentSub?.status ?? "writing",
        content: saveForm.content.trim(),
        notes: saveForm.notes.trim(),
        createdAt: new Date(),
      }]);
    } catch (e) { console.error(e); }
    setShowSaveModal(false);
    setSaveForm({ tag: "", label: "", notes: "", content: "" });
  };

  // ── Recommendation state + logic ──
  const [showRecPanel, setShowRecPanel] = useState(false);
  const [recInput, setRecInput] = useState({
    direction: submissions.map(s => s.venue).join("、"),
    keywords: "natural language processing, machine learning, graph neural network",
    extra: "",
  });
  const [recommendations, setRecommendations] = useState<VenueRecommendation[]>([]);
  const [recLoading, setRecLoading] = useState(false);

  const generateRecommendations = () => {
    setRecLoading(true);
    setTimeout(() => {
      const terms = [recInput.direction, recInput.keywords, recInput.extra]
        .join(" ").toLowerCase()
        .split(/[\s,，、;；]+/)
        .map(t => t.trim())
        .filter(t => t.length > 2);

      const trackedNames = new Set([
        ...conferences.map(c => c.name.split(" ")[0].toLowerCase()),
        ...journals.map(j => j.name.toLowerCase()),
      ]);

      const REASON_TEMPLATES: Record<string, string> = {
        "人工智能": "该顶级 AI 会议与您的研究方向高度匹配，是您研究领域的核心发表平台。",
        "数据库": "与您在数据检索与挖掘方向的研究契合，引用影响力强。",
        "计算机网络": "网络与系统领域旗舰会议，适合您在分布式相关方向的工作。",
        "网络与信息安全": "安全顶会，适合涉及对抗鲁棒性或隐私相关研究。",
        "软件工程": "程序分析与软件系统领域权威发表场所。",
      };

      const results: VenueRecommendation[] = POPULAR_VENUES
        .filter(v => !trackedNames.has(v.name.split(" ")[0].toLowerCase()))
        .map(v => {
          const haystack = `${v.name} ${v.fullName} ${v.area}`.toLowerCase();
          const hits = terms.filter(t => haystack.includes(t));
          const ccfBonus = v.ccf === "A" ? 35 : v.ccf === "B" ? 20 : v.ccf === "C" ? 8 : 0;
          const sciBonus = v.sci ? 15 : 0;
          const score = Math.min(98, hits.length * 18 + ccfBonus + sciBonus + Math.floor(Math.random() * 6));
          const reason = REASON_TEMPLATES[v.area]
            ?? (v.ccf === "A"
              ? `CCF A 类${v.type === "conference" ? "会议" : "期刊"}，与您在 ${v.area} 领域的研究方向吻合，录用率较高且学术影响力强。`
              : `该${v.type === "conference" ? "会议" : "期刊"}聚焦 ${v.area}，与您的关键词「${hits.slice(0, 2).join("、") || v.area}」高度相关，投稿竞争相对适中。`);
          return { ...v, reason, matchScore: score, matchTags: hits.slice(0, 4) };
        })
        .filter(v => v.matchScore >= 30)
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, 10);

      setRecommendations(results);
      setRecLoading(false);
    }, 900);
  };

  // ── Stats ──
  const activeCount = submissions.filter(s => ["writing", "submitted", "reviewing"].includes(s.status)).length;
  const acceptedCount = submissions.filter(s => s.status === "accepted").length;

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* ── Header ── */}
      <div
        className="flex-shrink-0 px-6 pt-5 pb-0"
        style={{ borderBottom: "1px solid var(--rc-border)" }}
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold text-ink-primary">投稿管理</h1>
            <p className="mt-0.5 text-sm text-ink-tertiary">追踪会议期刊DDL，管理论文投稿全流程。</p>
          </div>
          <div className="flex gap-3">
            {[
              { label: "追踪会议",   value: conferences.length, color: "#007AFF" },
              { label: "追踪期刊",   value: journals.length,   color: "#AF52DE" },
              { label: "进行中",     value: activeCount,       color: "#FF9500" },
              { label: "已接收",     value: acceptedCount,     color: "#34C759" },
            ].map(stat => (
              <div
                key={stat.label}
                className="text-center px-4 py-2 rounded-2xl"
                style={{ background: "var(--rc-card-inset-bg)", boxShadow: "inset 2px 2px 5px rgba(0,0,0,0.10), inset -1px -1px 4px rgba(255,255,255,0.55)" }}
              >
                <p className="text-[11px] text-ink-tertiary">{stat.label}</p>
                <p className="text-xl font-bold tabular-nums mt-0.5" style={{ color: stat.color }}>{stat.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 -mb-px">
          {[
            { key: "conferences" as const, icon: Calendar,     label: "DDL 日历" },
            { key: "kanban"      as const, icon: KanbanSquare, label: "投稿看板" },
            { key: "checklist"   as const, icon: CheckSquare,  label: "提交清单" },
            { key: "versions"    as const, icon: GitBranch,    label: "版本控制" },
            { key: "reviews"     as const, icon: History,      label: "审稿归档" },
          ].map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-xl transition-all duration-150 border-b-2"
              style={tab === key ? {
                color: "#007AFF",
                borderBottomColor: "#007AFF",
                background: "var(--rc-card-bg)",
              } : {
                color: "var(--rc-text-tertiary)" as string,
                borderBottomColor: "transparent",
              }}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto p-6">

        {/* ════════ DDL 日历 ════════ */}
        {tab === "conferences" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                {(["all", "conference", "journal", "starred"] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setVenueFilter(f)}
                    className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150"
                    style={venueFilter === f
                      ? { background: "#007AFF", color: "#fff" }
                      : { background: "var(--rc-card-bg)", color: "var(--rc-text-secondary)" as string, boxShadow: "2px 2px 6px rgba(0,0,0,0.08), -1px -1px 4px rgba(255,255,255,0.6)" }
                    }
                  >
                    {f === "all" ? "全部" : f === "conference" ? "会议" : f === "journal" ? "期刊" : "⭐ 已关注"}
                  </button>
                ))}
              </div>
              <Button variant="secondary" size="sm" onClick={() => setShowAddModal(true)}>
                <Plus className="w-3.5 h-3.5" />
                添加会议/期刊
              </Button>
            </div>

            {/* ── 智能推荐面板 ── */}
            <div
              className="rounded-2xl overflow-hidden"
              style={{ border: "1px solid var(--rc-border)", background: "var(--rc-card-bg)" }}
            >
              {/* 折叠 header */}
              <button
                className="w-full flex items-center justify-between px-4 py-3 transition-colors hover:bg-black/[0.02]"
                onClick={() => setShowRecPanel(p => !p)}
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" style={{ color: "#AF52DE" }} />
                  <span className="text-sm font-semibold text-ink-primary">智能推荐刊会</span>
                  {recommendations.length > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: "rgba(175,82,222,0.12)", color: "#AF52DE" }}>
                      {recommendations.length} 个推荐
                    </span>
                  )}
                  <span className="text-xs text-ink-tertiary">根据研究方向与投稿历史自动匹配</span>
                </div>
                {showRecPanel
                  ? <ChevronUp className="w-4 h-4 text-ink-tertiary flex-shrink-0" />
                  : <ChevronDown className="w-4 h-4 text-ink-tertiary flex-shrink-0" />
                }
              </button>

              {showRecPanel && (
                <>
                  {/* 输入区 */}
                  <div className="px-4 pb-4 pt-1 space-y-3 border-t" style={{ borderColor: "var(--rc-border)", background: "var(--rc-card-inset-bg)" }}>
                    <div className="grid grid-cols-2 gap-3 pt-3">
                      <div>
                        <p className="text-xs font-medium text-ink-secondary mb-1">研究方向 / 论文主题</p>
                        <textarea
                          rows={3}
                          placeholder="告诉小妍你的研究方向或论文主题…"
                          value={recInput.direction}
                          onChange={e => setRecInput(p => ({ ...p, direction: e.target.value }))}
                          className="w-full px-3 py-2 rounded-xl text-xs resize-none leading-relaxed"
                          style={{ background: "var(--rc-card-bg)", boxShadow: "inset 2px 2px 4px rgba(0,0,0,0.07)" }}
                        />
                      </div>
                      <div className="space-y-2">
                        <div>
                          <p className="text-xs font-medium text-ink-secondary mb-1">关键词</p>
                          <input
                            type="text"
                            placeholder="如：LLM, diffusion, reinforcement learning…"
                            value={recInput.keywords}
                            onChange={e => setRecInput(p => ({ ...p, keywords: e.target.value }))}
                            className="w-full px-3 py-2 rounded-xl text-xs"
                            style={{ background: "var(--rc-card-bg)", boxShadow: "inset 2px 2px 4px rgba(0,0,0,0.07)" }}
                          />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-ink-secondary mb-1">补充说明（可选）</p>
                          <input
                            type="text"
                            placeholder="如：偏理论 / 工程落地 / 希望 CCF A 类…"
                            value={recInput.extra}
                            onChange={e => setRecInput(p => ({ ...p, extra: e.target.value }))}
                            className="w-full px-3 py-2 rounded-xl text-xs"
                            style={{ background: "var(--rc-card-bg)", boxShadow: "inset 2px 2px 4px rgba(0,0,0,0.07)" }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] text-ink-tertiary">基于投稿历史 · 关键词匹配 · CCF/SCI 评级综合评分</p>
                      <button
                        onClick={generateRecommendations}
                        disabled={recLoading}
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 disabled:opacity-60"
                        style={{ background: "linear-gradient(135deg, #AF52DE, #007AFF)", color: "#fff", boxShadow: "2px 4px 10px rgba(0,122,255,0.25)" }}
                      >
                        {recLoading
                          ? <><span className="animate-spin inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full" />分析中…</>
                          : <><Sparkles className="w-3 h-3" />生成推荐</>
                        }
                      </button>
                    </div>
                  </div>

                  {/* 推荐结果 */}
                  {recommendations.length > 0 && (
                    <div className="p-3 space-y-2 border-t" style={{ borderColor: "var(--rc-border)" }}>
                      <p className="text-[11px] font-semibold text-ink-tertiary uppercase tracking-wider px-1">推荐结果</p>
                      {recommendations.map(rec => {
                        const ccfS = CCF_STYLE[rec.ccf];
                        const already = isVenueAdded(rec);
                        return (
                          <div
                            key={rec.id}
                            className="flex items-start gap-3 p-3 rounded-xl"
                            style={{ background: "var(--rc-card-inset-bg)" }}
                          >
                            {/* Score ring */}
                            <div className="flex-shrink-0 flex flex-col items-center gap-0.5 w-10">
                              <span className="text-base font-bold tabular-nums" style={{
                                color: rec.matchScore >= 80 ? "#34C759" : rec.matchScore >= 55 ? "#007AFF" : "#FF9500"
                              }}>
                                {rec.matchScore}
                              </span>
                              <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: "var(--rc-border)" }}>
                                <div className="h-full rounded-full" style={{
                                  width: `${rec.matchScore}%`,
                                  background: rec.matchScore >= 80 ? "#34C759" : rec.matchScore >= 55 ? "#007AFF" : "#FF9500"
                                }} />
                              </div>
                              <span className="text-[9px] text-ink-tertiary">匹配度</span>
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-sm font-semibold text-ink-primary">{rec.name}</span>
                                {rec.ccf !== "none" && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                                    style={{ background: ccfS.bg, color: ccfS.color }}>CCF {rec.ccf}</span>
                                )}
                                {rec.sci && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                                    style={{ background: "rgba(52,199,89,0.12)", color: "#1A7F37" }}>SCI</span>
                                )}
                                {rec.sciQuartile && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                                    style={{ background: "rgba(88,86,214,0.12)", color: "#5856D6" }}>{rec.sciQuartile}</span>
                                )}
                                {rec.ei && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                                    style={{ background: "rgba(0,122,255,0.10)", color: "#007AFF" }}>EI</span>
                                )}
                                <span className="text-[10px] px-1.5 py-0.5 rounded-md"
                                  style={{ background: "rgba(142,142,147,0.10)", color: "#8E8E93" }}>
                                  {rec.type === "conference" ? "会议" : "期刊"}
                                </span>
                              </div>
                              <p className="text-[11px] text-ink-tertiary mt-0.5 truncate">{rec.fullName}</p>
                              <p className="text-xs text-ink-secondary mt-1 leading-relaxed">{rec.reason}</p>
                              {rec.matchTags.length > 0 && (
                                <div className="flex gap-1 mt-1.5 flex-wrap">
                                  {rec.matchTags.map(t => (
                                    <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-md"
                                      style={{ background: "rgba(175,82,222,0.10)", color: "#AF52DE" }}>
                                      {t}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Action */}
                            <button
                              onClick={() => !already && handleAddVenue(rec)}
                              disabled={already}
                              className="flex-shrink-0 text-xs font-medium px-2.5 py-1.5 rounded-xl transition-all duration-150 disabled:opacity-40"
                              style={already
                                ? { background: "rgba(52,199,89,0.12)", color: "#34C759" }
                                : { background: "#007AFF", color: "#fff", boxShadow: "1px 2px 6px rgba(0,122,255,0.25)" }
                              }
                            >
                              {already ? "已追踪 ✓" : "+ 追踪"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="grid gap-2.5">
              {visibleVenues.map(venue => {
                const isConf = venue.type === "conference";
                const days = isConf
                  ? getDaysUntil(venue.deadline)
                  : venue.specialIssueDeadline ? getDaysUntil(venue.specialIssueDeadline) : null;
                const ddl = days !== null ? getDdlStyle(days) : null;
                const ccf = CCF_STYLE[venue.ccf];
                return (
                  <Card key={venue.id} padding="sm" className="group">
                    <div className="flex items-center gap-4">
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {venue.website ? (
                            <ExternalLink
                              href={venue.website}
                              className="font-semibold text-base text-ink-primary truncate hover:text-blue-600 hover:underline"
                            >
                              {venue.name}
                            </ExternalLink>
                          ) : (
                            <p className="font-semibold text-base text-ink-primary truncate">{venue.name}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {/* CCF tag */}
                          {venue.ccf !== "none" && (
                            <span
                              className="text-[10px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0"
                              style={{ background: ccf.bg, color: ccf.color }}
                            >
                              CCF {venue.ccf}
                            </span>
                          )}
                          {/* SCI */}
                          {!isConf && (venue as Journal).sci && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0"
                              style={{ background: "rgba(52,199,89,0.12)", color: "#1A7F37" }}>
                              SCI
                            </span>
                          )}
                          {/* JCR quartile */}
                          {!isConf && (venue as Journal).sciQuartile && (() => {
                            const q = (venue as Journal).sciQuartile!;
                            const qColor = q === "Q1" ? { bg: "rgba(88,86,214,0.12)", color: "#5856D6" }
                              : q === "Q2" ? { bg: "rgba(0,122,255,0.12)", color: "#007AFF" }
                              : q === "Q3" ? { bg: "rgba(255,149,0,0.12)", color: "#E65100" }
                              : { bg: "rgba(142,142,147,0.12)", color: "#6B6B6B" };
                            return (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0"
                                style={{ background: qColor.bg, color: qColor.color }}>
                                {q}
                              </span>
                            );
                          })()}
                          {/* EI */}
                          {venue.ei && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0"
                              style={{ background: "rgba(0,122,255,0.10)", color: "#007AFF" }}>
                              EI
                            </span>
                          )}
                          {/* Type badge */}
                          <span
                            className="text-[10px] font-medium px-1.5 py-0.5 rounded-md flex-shrink-0"
                            style={{
                              background: isConf ? "rgba(0,122,255,0.10)" : "rgba(175,82,222,0.10)",
                              color: isConf ? "#007AFF" : "#AF52DE",
                            }}
                          >
                            {isConf ? "会议" : "期刊"}
                          </span>
                          <span
                            className="text-[10px] font-medium px-1.5 py-0.5 rounded-md flex-shrink-0"
                            style={{ background: "rgba(142,142,147,0.10)", color: "#8E8E93" }}
                          >
                            {venue.area}
                          </span>
                        </div>
                        <p className="text-xs text-ink-tertiary mt-0.5 truncate">{venue.fullName}</p>
                        <div className="flex items-center gap-3 mt-1">
                          {isConf ? (
                            <>
                              <span className="flex items-center gap-1 text-[11px] text-ink-tertiary">
                                <Clock className="w-3 h-3" />
                                截止 {venue.deadline.toLocaleDateString("zh-CN")}
                              </span>
                              {venue.notificationDate && (
                                <span className="flex items-center gap-1 text-[11px] text-ink-tertiary">
                                  <Bell className="w-3 h-3" />
                                  通知 {venue.notificationDate.toLocaleDateString("zh-CN")}
                                </span>
                              )}
                            </>
                          ) : (
                            <>
                              <span className="flex items-center gap-1 text-[11px] text-ink-tertiary">
                                <BookOpen className="w-3 h-3" />
                                随时投稿
                              </span>
                              {venue.specialIssueDeadline && venue.specialIssueTitle && (
                                <span className="flex items-center gap-1 text-[11px]" style={{ color: "#FF9500" }}>
                                  <Bell className="w-3 h-3" />
                                  特刊「{venue.specialIssueTitle}」截止 {venue.specialIssueDeadline.toLocaleDateString("zh-CN")}
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {/* DDL countdown (会议和特刊) */}
                      {ddl && (
                        <div
                          className="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold"
                          style={{ background: ddl.bg, color: ddl.color }}
                        >
                          {days! < 0 ? "已截止" : `还剩 ${ddl.label}`}
                        </div>
                      )}

                      {/* Star */}
                      <button
                        onClick={() => toggleVenueStar(venue.id, venue.type)}
                        className="flex-shrink-0 p-1.5 rounded-lg transition-all duration-150 hover:bg-black/5 opacity-0 group-hover:opacity-100"
                      >
                        {venue.starred
                          ? <Star className="w-4 h-4 fill-current" style={{ color: "#FF9500" }} />
                          : <StarOff className="w-4 h-4 text-ink-tertiary" />
                        }
                      </button>
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Collaboration placeholder */}
            <div
              className="rounded-3xl p-4 flex items-center gap-3 border-2 border-dashed opacity-50"
              style={{ borderColor: "var(--rc-border)" }}
            >
              <Users className="w-5 h-5 text-ink-tertiary flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-ink-secondary">课题组共享日历（即将上线）</p>
                <p className="text-xs text-ink-tertiary mt-0.5">邀请课题组成员，共同追踪会议与期刊，统一管理投稿节奏。</p>
              </div>
            </div>
          </div>
        )}

        {/* ════════ 投稿看板 ════════ */}
        {tab === "kanban" && (
          <div className="space-y-4 h-full">
            <div className="flex items-center justify-between">
              <p className="text-sm text-ink-tertiary">点击「推进 →」更新论文投稿进度</p>
              <Button variant="secondary" size="sm" onClick={() => setShowAddSubModal(true)}>
                <FilePlus className="w-3.5 h-3.5" />
                新增投稿
              </Button>
            </div>

            <div className="flex gap-4 overflow-x-auto pb-4">
              {KANBAN_COLS.map(({ key, label }, colIdx) => {
                const cfg = STATUS_CFG[key];
                const items = submissions.filter(s => s.status === key);
                return (
                  <div key={key} className="flex-shrink-0 w-52">
                    {/* Column header */}
                    <div className="flex items-center justify-between mb-3 px-1">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: cfg.color }} />
                        <span className="text-sm font-semibold text-ink-primary">{label}</span>
                      </div>
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{ background: cfg.bg, color: cfg.color }}
                      >
                        {items.length}
                      </span>
                    </div>

                    {/* Cards */}
                    <div className="space-y-2.5 min-h-[120px]">
                      {items.map(sub => (
                        <div
                          key={sub.id}
                          className="rounded-2xl p-3.5 transition-all duration-150 hover:-translate-y-px cursor-default"
                          style={{ background: "var(--rc-card-bg)", boxShadow: "2px 2px 8px rgba(0,0,0,0.08), -1px -1px 4px rgba(255,255,255,0.7)" }}
                        >
                          <p className="text-sm font-medium text-ink-primary leading-snug line-clamp-3">{sub.title}</p>
                          <div className="mt-1.5 flex items-center gap-1.5">
                            <span
                              className="text-[10px] font-medium px-1.5 py-0.5 rounded-md"
                              style={{
                                background: sub.venueType === "conference" ? "rgba(0,122,255,0.10)" : "rgba(175,82,222,0.10)",
                                color: sub.venueType === "conference" ? "#007AFF" : "#AF52DE",
                              }}
                            >
                              {sub.venueType === "conference" ? "会议" : "期刊"}
                            </span>
                            <p className="text-[11px] text-ink-tertiary truncate">{sub.venue}</p>
                          </div>
                          {sub.deadline && key === "writing" && sub.venueType === "conference" && (
                            <p className="mt-1 text-[11px]" style={{ color: getDdlStyle(getDaysUntil(sub.deadline)).color }}>
                              DDL 还剩 {getDaysUntil(sub.deadline)} 天
                            </p>
                          )}
                          {sub.submittedAt && (
                            <p className="mt-1 text-[11px] text-ink-tertiary">
                              投稿于 {sub.submittedAt.toLocaleDateString("zh-CN")}
                            </p>
                          )}
                          {key === "accepted" && (
                            <div className="mt-1.5 flex items-center gap-2">
                              <div className="flex items-center gap-1">
                                <Trophy className="w-3 h-3" style={{ color: "#34C759" }} />
                                <span className="text-[11px] font-medium" style={{ color: "#34C759" }}>已录用</span>
                              </div>
                              <button
                                className="text-[10px] font-medium px-1.5 py-0.5 rounded-md transition-colors"
                                style={{ background: "rgba(52,199,89,0.12)", color: "#34C759" }}
                                onClick={() => {
                                  const year = new Date().getFullYear();
                                  const vType = sub.venueType === "journal" ? "@article" : "@inproceedings";
                                  const vKey = sub.venueType === "journal" ? "journal" : "booktitle";
                                  const key_ = `Author${year}${sub.venue.split(" ")[0]}`;
                                  const bib = `${vType}{${key_},\n  title={${sub.title}},\n  author={},\n  ${vKey}={${sub.venue}},\n  year={${year}}\n}`;
                                  navigator.clipboard.writeText(bib);
                                }}
                                title="复制 BibTeX"
                              >
                                BibTeX
                              </button>
                            </div>
                          )}
                          {/* Move buttons */}
                          <div className="mt-2.5 flex gap-1">
                            {colIdx > 0 && (
                              <button
                                className="text-[10px] text-ink-tertiary hover:text-ink-secondary px-1.5 py-0.5 rounded-md hover:bg-black/5 transition-colors"
                                onClick={() => moveSubmission(sub.id, "prev")}
                              >
                                ← 回退
                              </button>
                            )}
                            {key !== "accepted" && key !== "rejected" && (
                              <button
                                className="text-[10px] font-medium px-1.5 py-0.5 rounded-md hover:bg-black/5 transition-colors"
                                style={{ color: "#007AFF" }}
                                onClick={() => moveSubmission(sub.id, "next")}
                              >
                                推进 →
                              </button>
                            )}
                          </div>
                        </div>
                      ))}

                      {items.length === 0 && (
                        <div
                          className="rounded-2xl p-5 flex items-center justify-center border-2 border-dashed opacity-30"
                          style={{ borderColor: "var(--rc-border)" }}
                        >
                          <p className="text-xs text-ink-tertiary">暂无</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Collaboration placeholder */}
            <div
              className="rounded-3xl p-4 flex items-center gap-3 border-2 border-dashed opacity-50"
              style={{ borderColor: "var(--rc-border)" }}
            >
              <Users className="w-5 h-5 text-ink-tertiary flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-ink-secondary">多人协作（即将上线）</p>
                <p className="text-xs text-ink-tertiary mt-0.5">邀请共同作者加入投稿项目，分配章节任务、标注评论、共享看板进度。</p>
              </div>
            </div>
          </div>
        )}

        {/* ════════ 提交清单 ════════ */}
        {tab === "checklist" && (
          <div className="space-y-5">
            {/* Progress header */}
            <div className="flex items-center gap-6">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-ink-primary">提交前检查</p>
                  <span
                    className="text-sm font-bold tabular-nums"
                    style={{ color: progress === 100 ? "#34C759" : "#007AFF" }}
                  >
                    {checkedCount} / {checklist.length}
                  </span>
                </div>
                <div
                  className="h-2 rounded-full overflow-hidden"
                  style={{ background: "var(--rc-card-inset-bg)", boxShadow: "inset 1px 1px 3px rgba(0,0,0,0.12)" }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${progress}%`,
                      background: progress === 100
                        ? "#34C759"
                        : "linear-gradient(90deg, #007AFF, #5856D6)",
                    }}
                  />
                </div>
              </div>
              {progress === 100 && (
                <div
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
                  style={{ background: "rgba(52,199,89,0.10)" }}
                >
                  <CheckCircle2 className="w-4 h-4" style={{ color: "#34C759" }} />
                  <span className="text-xs font-medium" style={{ color: "#34C759" }}>可以投稿了</span>
                </div>
              )}
              <button
                className="text-xs text-ink-tertiary hover:text-ink-secondary transition-colors px-3 py-1.5 rounded-lg hover:bg-black/5"
                onClick={() => setChecklist(prev => prev.map(i => ({ ...i, checked: false })))}
              >
                重置
              </button>
            </div>

            {/* Category filter */}
            <div className="flex flex-wrap items-center gap-2">
              {categories.map(cat => {
                const catCount = checklist.filter(i => i.category === cat).length;
                const catChecked = checklist.filter(i => i.category === cat && i.checked).length;
                return (
                  <button
                    key={cat}
                    onClick={() => setChecklistCat(cat)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150"
                    style={checklistCat === cat
                      ? { background: "#007AFF", color: "#fff" }
                      : { background: "var(--rc-card-bg)", color: "var(--rc-text-secondary)" as string, boxShadow: "2px 2px 6px rgba(0,0,0,0.08), -1px -1px 4px rgba(255,255,255,0.6)" }
                    }
                  >
                    {cat === "all" ? "全部" : cat}
                    {cat !== "all" && (
                      <span className={checklistCat === cat ? "opacity-70" : "opacity-50"}>
                        {catChecked}/{catCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Items in grid layout */}
            <div className="grid grid-cols-2 gap-3">
              {visibleCategories.map(cat => (
                <div key={cat} className="space-y-2">
                  <p className="text-[11px] font-semibold text-ink-tertiary uppercase tracking-wider px-1">
                    {cat}
                  </p>
                  <Card padding="sm" className="space-y-1">
                    {filteredChecklist
                      .filter(i => i.category === cat)
                      .map(item => (
                        <button
                          key={item.id}
                          onClick={() => toggleCheck(item.id)}
                          className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl text-left transition-all duration-150 hover:bg-black/[0.03]"
                        >
                          {item.checked
                            ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: "#34C759" }} />
                            : <Circle className="w-4 h-4 flex-shrink-0 text-ink-tertiary" />
                          }
                          <span
                            className="text-[13px] leading-snug transition-all duration-150"
                            style={{
                              color: item.checked ? "#34C759" : "var(--rc-text-primary)" as string,
                              textDecoration: item.checked ? "line-through" : "none",
                              opacity: item.checked ? 0.6 : 1,
                            }}
                          >
                            {item.label}
                          </span>
                        </button>
                      ))}
                  </Card>
                </div>
              ))}
            </div>

            {/* Collaboration placeholder */}
            <div
              className="rounded-2xl p-3.5 flex items-center gap-3 border-2 border-dashed opacity-50"
              style={{ borderColor: "var(--rc-border)" }}
            >
              <Users className="w-4 h-4 text-ink-tertiary flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-ink-secondary">团队协作清单（即将上线）</p>
                <p className="text-xs text-ink-tertiary mt-0.5">为每位共同作者分配清单项，追踪各自完成进度。</p>
              </div>
            </div>
          </div>
        )}

        {/* ════════ 版本控制 ════════ */}
        {tab === "versions" && (() => {
          const subVersions = versions.filter(v => v.submissionId === versionSubId);
          const currentSub = submissions.find(s => s.id === versionSubId);

          const selectForCompare = (id: string, slot: 0 | 1) => {
            setCompareIds(prev => {
              const base = prev ?? [subVersions[0]?.id ?? id, subVersions[0]?.id ?? id];
              const next = [base[0], base[1]] as [string, string];
              next[slot] = id;
              return next;
            });
          };

          const diffResult = compareIds && compareIds[0] !== compareIds[1]
            ? (() => {
                const va = versions.find(v => v.id === compareIds[0]);
                const vb = versions.find(v => v.id === compareIds[1]);
                return va && vb ? computeLineDiff(va.content, vb.content) : null;
              })()
            : null;

          return (
            <div className="flex gap-5 h-full min-h-0">

              {/* ── 左侧：投稿列表 ── */}
              <div className="w-52 flex-shrink-0 flex flex-col gap-2">
                <p className="text-[11px] font-semibold text-ink-tertiary uppercase tracking-wider px-1">投稿论文</p>
                {submissions.map(sub => {
                  const vCount = versions.filter(v => v.submissionId === sub.id).length;
                  const cfg = STATUS_CFG[sub.status];
                  const active = sub.id === versionSubId;
                  return (
                    <button
                      key={sub.id}
                      onClick={() => { setVersionSubId(sub.id); setCompareIds(null); }}
                      className="w-full text-left rounded-2xl p-3 transition-all duration-150"
                      style={active
                        ? { background: "#007AFF", color: "#fff", boxShadow: "2px 4px 12px rgba(0,122,255,0.3)" }
                        : { background: "var(--rc-card-bg)", color: "var(--rc-text-primary)" as string, boxShadow: "2px 2px 6px rgba(0,0,0,0.08), -1px -1px 4px rgba(255,255,255,0.6)" }
                      }
                    >
                      <p className="text-sm font-medium line-clamp-2 leading-snug">{sub.title}</p>
                      <div className="mt-1.5 flex items-center justify-between gap-1">
                        <span className="text-[10px] truncate" style={{ opacity: 0.65 }}>{sub.venue}</span>
                        <span
                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md flex-shrink-0"
                          style={active
                            ? { background: "rgba(255,255,255,0.25)", color: "#fff" }
                            : { background: cfg.bg, color: cfg.color }
                          }
                        >
                          {vCount} 版本
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* ── 右侧：版本时间线 + diff ── */}
              <div className="flex-1 min-w-0 flex flex-col gap-4 overflow-y-auto">

                {/* Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-ink-primary line-clamp-1">{currentSub?.title}</p>
                    <p className="text-xs text-ink-tertiary mt-0.5">
                      共 {subVersions.length} 个版本
                      {compareIds && compareIds[0] !== compareIds[1] && "  ·  已选择两个版本对比"}
                    </p>
                  </div>
                  <button
                    onClick={() => { setSaveForm({ tag: versionNextTag, label: "", notes: "", content: subVersions[subVersions.length - 1]?.content ?? "" }); setShowSaveModal(true); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all duration-150 hover:opacity-80"
                    style={{ background: "#007AFF", color: "#fff", boxShadow: "2px 4px 10px rgba(0,122,255,0.25)" }}
                  >
                    <Save className="w-3.5 h-3.5" />
                    记录版本
                  </button>
                </div>

                {subVersions.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-3 opacity-50">
                    <History className="w-10 h-10 text-ink-tertiary" />
                    <p className="text-sm text-ink-tertiary">暂无版本记录，点击「记录版本」保存论文稿件快照</p>
                  </div>
                ) : (
                  <>
                    {/* 版本时间线 */}
                    <div className="space-y-0">
                      {[...subVersions].reverse().map((ver, idx, arr) => {
                        const isFirst = idx === 0;
                        const stageCfg = STATUS_CFG[ver.stage];
                        const inCompare = compareIds && (compareIds[0] === ver.id || compareIds[1] === ver.id);
                        return (
                          <div key={ver.id} className="flex gap-3">
                            {/* Timeline track */}
                            <div className="flex flex-col items-center w-8 flex-shrink-0">
                              <div
                                className="w-3 h-3 rounded-full border-2 mt-4 flex-shrink-0 z-10"
                                style={isFirst
                                  ? { background: "#007AFF", borderColor: "#007AFF" }
                                  : { background: "var(--rc-card-bg)", borderColor: "var(--rc-border)" }
                                }
                              />
                              {idx < arr.length - 1 && (
                                <div className="w-px flex-1 mt-1" style={{ background: "var(--rc-border)" }} />
                              )}
                            </div>

                            {/* Card */}
                            <div
                              className="flex-1 mb-3 rounded-2xl p-3.5 transition-all duration-150"
                              style={{
                                background: inCompare ? "rgba(0,122,255,0.06)" : "var(--rc-card-bg)",
                                boxShadow: inCompare
                                  ? "0 0 0 1.5px #007AFF, 2px 2px 8px rgba(0,0,0,0.06)"
                                  : "2px 2px 8px rgba(0,0,0,0.07), -1px -1px 4px rgba(255,255,255,0.65)",
                              }}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-bold text-ink-primary">{ver.tag}</span>
                                  <span className="text-sm text-ink-secondary">{ver.label}</span>
                                  <span
                                    className="text-[10px] font-medium px-1.5 py-0.5 rounded-md"
                                    style={{ background: stageCfg.bg, color: stageCfg.color }}
                                  >
                                    {stageCfg.label}
                                  </span>
                                </div>
                                <span className="text-[11px] text-ink-tertiary flex-shrink-0">
                                  {ver.createdAt.toLocaleDateString("zh-CN")}
                                </span>
                              </div>

                              {ver.notes && (
                                <p className="mt-1.5 text-xs text-ink-secondary leading-relaxed">{ver.notes}</p>
                              )}

                              <p className="mt-2 text-[11px] text-ink-tertiary line-clamp-2 leading-relaxed font-mono">
                                {ver.content.slice(0, 120)}…
                              </p>

                              {/* Compare controls */}
                              <div className="mt-2.5 flex items-center gap-2">
                                <span className="text-[10px] text-ink-tertiary">对比：</span>
                                {(["0", "1"] as const).map(slot => (
                                  <button
                                    key={slot}
                                    onClick={() => selectForCompare(ver.id, Number(slot) as 0 | 1)}
                                    className="text-[10px] font-medium px-2 py-0.5 rounded-lg transition-colors"
                                    style={compareIds?.[Number(slot)] === ver.id
                                      ? { background: "#007AFF", color: "#fff" }
                                      : { background: "var(--rc-card-inset-bg)", color: "var(--rc-text-tertiary)" as string }
                                    }
                                  >
                                    {slot === "0" ? "旧" : "新"}
                                  </button>
                                ))}
                              </div>

                              {/* File controls */}
                              <div className="mt-3 flex items-center gap-2 flex-wrap">
                                <button
                                  onClick={() => handleUploadVersionFile(ver.id)}
                                  className="flex items-center gap-1 text-[10px] font-medium px-2.5 py-1 rounded-lg transition-colors"
                                  style={{ background: "var(--rc-card-inset-bg)", color: "var(--rc-text-tertiary)" as string }}
                                  title="上传论文 PDF"
                                >
                                  <Upload className="w-3 h-3" />
                                  上传
                                </button>
                                {ver.filePath && (
                                  <button
                                    onClick={() => handleDownloadVersionFile(ver.filePath)}
                                    className="flex items-center gap-1 text-[10px] font-medium px-2.5 py-1 rounded-lg transition-colors"
                                    style={{ background: "var(--rc-card-inset-bg)", color: "#007AFF" }}
                                    title="下载论文 PDF"
                                  >
                                    <Download className="w-3 h-3" />
                                    下载
                                  </button>
                                )}

                                {/* AI 润色 */}
                                {ver.content.trim() && (
                                  <button
                                    onClick={() => {
                                      setPolishSourceId(ver.id);
                                      setPolishText("");
                                      setPolishLoading(true);
                                      setShowPolishPanel(true);
                                      submissionApi.polishAbstract(ver.submissionId, ver.content).catch(e => {
                                        console.error(e); setPolishLoading(false);
                                      });
                                    }}
                                    className="flex items-center gap-1 text-[10px] font-medium px-2.5 py-1 rounded-lg transition-all duration-150"
                                    style={{ background: "rgba(0,122,255,0.10)", color: "#007AFF" }}
                                    title="AI 润色摘要/核心内容"
                                  >
                                    <Sparkles className="w-3 h-3" />
                                    AI 润色
                                  </button>
                                )}

                                {/* AI 审稿入口 */}
                                <button
                                  onClick={async () => {
                                    // 设置审稿归档目标为当前版本所属投稿
                                    setReviewSubId(ver.submissionId);
                                    setMockReviewResult(null);
                                    setMockFileName(null);
                                    setShowMockReviewModal(true);
                                    if (ver.filePath) {
                                      // 有 PDF 文件：自动提取
                                      setMockFileExtracting(true);
                                      setMockReviewInput(p => ({ ...p, abstract: "" }));
                                      try {
                                        const { extractTextFromPdf } = await import("../lib/pdfExtract");
                                        const text = await extractTextFromPdf(ver.filePath);
                                        setMockReviewInput(p => ({ ...p, abstract: text }));
                                        setMockFileName(ver.fileName ?? "paper.pdf");
                                      } catch {
                                        setMockReviewInput(p => ({ ...p, abstract: ver.content }));
                                      } finally {
                                        setMockFileExtracting(false);
                                      }
                                    } else {
                                      // 无文件：使用版本快照文本
                                      setMockReviewInput(p => ({ ...p, abstract: ver.content }));
                                    }
                                  }}
                                  className="flex items-center gap-1 text-[10px] font-medium px-2.5 py-1 rounded-lg transition-all duration-150"
                                  style={ver.filePath
                                    ? { background: "rgba(175,82,222,0.12)", color: "#AF52DE" }
                                    : { background: "var(--rc-card-inset-bg)", color: "var(--rc-text-tertiary)" as string }
                                  }
                                  title={ver.filePath ? "从 PDF 文件生成 AI 审稿意见" : "从版本快照文本生成 AI 审稿意见"}
                                >
                                  <Bot className="w-3 h-3" />
                                  AI 审稿
                                </button>

                                {ver.filePath && (
                                  <span className="text-[10px] text-ink-tertiary truncate flex-1">
                                    {ver.fileName}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Diff 面板 */}
                    {diffResult && compareIds && (
                      <div
                        className="rounded-2xl overflow-hidden"
                        style={{ border: "1px solid var(--rc-border)" }}
                      >
                        <div
                          className="px-4 py-2.5 flex items-center gap-2"
                          style={{ background: "var(--rc-card-inset-bg)", borderBottom: "1px solid var(--rc-border)" }}
                        >
                          <History className="w-4 h-4 text-ink-tertiary" />
                          <span className="text-sm font-semibold text-ink-primary">差异对比</span>
                          <span className="text-xs text-ink-tertiary">
                            {versions.find(v => v.id === compareIds[0])?.tag}
                            {" → "}
                            {versions.find(v => v.id === compareIds[1])?.tag}
                          </span>
                          <div className="ml-auto flex items-center gap-3 text-[11px]">
                            <span style={{ color: "#34C759" }}>
                              +{diffResult.filter(l => l.type === "add").length} 行新增
                            </span>
                            <span style={{ color: "#FF3B30" }}>
                              -{diffResult.filter(l => l.type === "remove").length} 行删除
                            </span>
                          </div>
                        </div>
                        <div className="p-1 overflow-x-auto max-h-72 overflow-y-auto">
                          {diffResult.map((line, i) => (
                            <div
                              key={i}
                              className="flex items-baseline gap-2 px-3 py-0.5 rounded-lg text-xs font-mono leading-relaxed"
                              style={
                                line.type === "add"    ? { background: "rgba(52,199,89,0.10)",  color: "#1A7F37" } :
                                line.type === "remove" ? { background: "rgba(255,59,48,0.10)",  color: "#C0392B" } :
                                                         { color: "var(--rc-text-secondary)" as string }
                              }
                            >
                              <span className="select-none w-3 flex-shrink-0 text-[10px]">
                                {line.type === "add" ? "+" : line.type === "remove" ? "−" : " "}
                              </span>
                              <span>{line.text}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })()}

        {/* ════════ 审稿归档 ════════ */}
        {tab === "reviews" && (() => {
          const currentSub = submissions.find(s => s.id === reviewSubId);
          const subRounds = reviewRounds
            .filter(r => r.submissionId === reviewSubId)
            .sort((a, b) => a.round - b.round);
          const roundNums = Array.from(new Set(subRounds.map(r => r.round)));
          const activeRound = subRounds.find(r => r.round === reviewRound);
          const roundComments = reviewComments
            .filter(c => c.submissionId === reviewSubId && c.round === reviewRound)
            .sort((a, b) => a.reviewer.localeCompare(b.reviewer));
          const unresolvedCount = roundComments.filter(c => !c.resolved).length;

          const handleAddRoundAndOpen = () => {
            const nextRound = roundNums.length > 0 ? Math.max(...roundNums) + 1 : 1;
            setReviewRound(nextRound);
            setReviewForm({ reviewer: "Reviewer 1", content: "", tags: [], verdict: "major_revision" });
            setShowAddReviewModal(true);
          };

          const handleAddComment = async () => {
            if (!reviewForm.reviewer.trim() || !reviewForm.content.trim()) return;
            const isNewRound = !roundNums.includes(reviewRound);
            if (isNewRound) {
              await submissionApi.upsertRound({
                submissionId: reviewSubId, round: reviewRound,
                verdict: reviewForm.verdict,
              }).catch(console.error);
              setReviewRounds(prev => [...prev, {
                submissionId: reviewSubId, round: reviewRound,
                verdict: reviewForm.verdict, receivedAt: new Date(),
              }]);
            }
            try {
              const res = await submissionApi.createComment({
                submissionId: reviewSubId, round: reviewRound,
                reviewer: reviewForm.reviewer.trim(),
                content: reviewForm.content.trim(),
                tags: reviewForm.tags,
              });
              setReviewComments(prev => [...prev, {
                id: res.id, submissionId: reviewSubId, round: reviewRound,
                reviewer: reviewForm.reviewer.trim(),
                content: reviewForm.content.trim(),
                response: "", resolved: false, tags: reviewForm.tags, createdAt: new Date(),
              }]);
            } catch (e) { console.error(e); }
            setReviewForm(p => ({ ...p, reviewer: `Reviewer ${reviewForm.reviewer.match(/\d+/) ? parseInt(reviewForm.reviewer.match(/\d+/)![0]) + 1 : 2}`, content: "", tags: [] }));
          };

          const toggleResolved = (id: string) => {
            const comment = reviewComments.find(c => c.id === id);
            if (!comment) return;
            submissionApi.updateComment(id, { resolved: !comment.resolved }).catch(console.error);
            setReviewComments(prev => prev.map(c => c.id === id ? { ...c, resolved: !c.resolved } : c));
          };

          const updateResponse = (id: string, response: string) => {
            submissionApi.updateComment(id, { response }).catch(console.error);
            setReviewComments(prev => prev.map(c => c.id === id ? { ...c, response } : c));
          };

          return (<>
            <div className="flex gap-5 h-full min-h-0">
              {/* ── 左侧：投稿列表 ── */}
              <div className="w-52 flex-shrink-0 flex flex-col gap-2">
                <p className="text-[11px] font-semibold text-ink-tertiary uppercase tracking-wider px-1">投稿论文</p>
                {submissions.map(sub => {
                  const rCount = reviewComments.filter(c => c.submissionId === sub.id).length;
                  const active = sub.id === reviewSubId;
                  const cfg = STATUS_CFG[sub.status];
                  return (
                    <button
                      key={sub.id}
                      onClick={() => { setReviewSubId(sub.id); setReviewRound(1); }}
                      className="w-full text-left rounded-2xl p-3 transition-all duration-150"
                      style={active
                        ? { background: "#007AFF", color: "#fff", boxShadow: "2px 4px 12px rgba(0,122,255,0.3)" }
                        : { background: "var(--rc-card-bg)", color: "var(--rc-text-primary)" as string, boxShadow: "2px 2px 6px rgba(0,0,0,0.08), -1px -1px 4px rgba(255,255,255,0.6)" }
                      }
                    >
                      <p className="text-sm font-medium line-clamp-2 leading-snug">{sub.title}</p>
                      <div className="mt-1.5 flex items-center justify-between gap-1">
                        <span className="text-[10px] truncate" style={{ opacity: 0.65 }}>{sub.venue}</span>
                        {rCount > 0
                          ? <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md flex-shrink-0"
                              style={active ? { background: "rgba(255,255,255,0.25)", color: "#fff" } : { background: cfg.bg, color: cfg.color }}>
                              {rCount} 条
                            </span>
                          : <span className="text-[10px] opacity-40 flex-shrink-0">暂无</span>
                        }
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* ── 右侧 ── */}
              <div className="flex-1 min-w-0 flex flex-col gap-4 overflow-y-auto">
                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-ink-primary line-clamp-1">{currentSub?.title}</p>
                    <p className="text-xs text-ink-tertiary mt-0.5">
                      {subRounds.length} 轮审稿 · {reviewComments.filter(c => c.submissionId === reviewSubId).length} 条意见
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setCoverLetterText("");
                        setCoverLetterLoading(true);
                        setShowCoverLetterModal(true);
                        submissionApi.generateCoverLetter(reviewSubId).catch(e => {
                          console.error(e); setCoverLetterLoading(false);
                        });
                      }}
                      className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium"
                      style={{ background: "rgba(52,199,89,0.12)", color: "#34C759" }}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Cover Letter
                    </button>
                    <button
                      onClick={handleAddRoundAndOpen}
                      className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium"
                      style={{ background: "#007AFF", color: "#fff", boxShadow: "2px 4px 10px rgba(0,122,255,0.25)" }}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      录入审稿意见
                    </button>
                  </div>
                </div>

                {/* Round tabs */}
                {roundNums.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {subRounds.map(r => {
                      const vcfg = VERDICT_CFG[r.verdict];
                      return (
                        <button
                          key={r.round}
                          onClick={() => setReviewRound(r.round)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150"
                          style={reviewRound === r.round
                            ? { background: vcfg.bg, color: vcfg.color, boxShadow: `0 0 0 1.5px ${vcfg.color}40` }
                            : { background: "var(--rc-card-bg)", color: "var(--rc-text-secondary)" as string, boxShadow: "2px 2px 6px rgba(0,0,0,0.08), -1px -1px 4px rgba(255,255,255,0.6)" }
                          }
                        >
                          第 {r.round} 轮
                          <span className="font-semibold">{vcfg.label}</span>
                          <span className="opacity-60">· {r.receivedAt.toLocaleDateString("zh-CN", { month: "short", day: "numeric" })}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {roundNums.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-3 opacity-50">
                    <BookOpen className="w-10 h-10 text-ink-tertiary" />
                    <p className="text-sm text-ink-tertiary">暂无审稿记录，点击「录入审稿意见」开始归档</p>
                  </div>
                ) : roundComments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2 opacity-40">
                    <p className="text-sm text-ink-tertiary">本轮暂无意见</p>
                  </div>
                ) : (
                  <>
                    {/* Round summary */}
                    {activeRound && (
                      <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl"
                        style={{ background: VERDICT_CFG[activeRound.verdict].bg }}>
                        <span className="text-sm font-bold" style={{ color: VERDICT_CFG[activeRound.verdict].color }}>
                          {VERDICT_CFG[activeRound.verdict].label}
                        </span>
                        <span className="text-xs text-ink-secondary">
                          {roundComments.length} 位审稿人 · {unresolvedCount > 0 ? `${unresolvedCount} 条待处理` : "全部已处理 ✓"}
                        </span>
                      </div>
                    )}

                    {/* Comment cards */}
                    <div className="space-y-3">
                      {roundComments.map(comment => (
                        <div
                          key={comment.id}
                          className="rounded-2xl overflow-hidden transition-all duration-150"
                          style={{
                            border: `1px solid ${comment.resolved ? "var(--rc-border)" : "rgba(255,149,0,0.3)"}`,
                            background: "var(--rc-card-bg)",
                            boxShadow: "2px 2px 8px rgba(0,0,0,0.06)",
                          }}
                        >
                          {/* Card header */}
                          <div className="flex items-center justify-between px-4 py-2.5"
                            style={{ background: comment.resolved ? "var(--rc-card-inset-bg)" : "rgba(255,149,0,0.06)", borderBottom: "1px solid var(--rc-border)" }}>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-ink-primary">{comment.reviewer}</span>
                              {comment.tags.map(tag => (
                                <span key={tag} className="text-[10px] font-medium px-1.5 py-0.5 rounded-md"
                                  style={{ background: "rgba(0,122,255,0.10)", color: "#007AFF" }}>
                                  {tag}
                                </span>
                              ))}
                            </div>
                            <button
                              onClick={() => toggleResolved(comment.id)}
                              className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-lg transition-colors"
                              style={comment.resolved
                                ? { background: "rgba(52,199,89,0.12)", color: "#34C759" }
                                : { background: "rgba(255,149,0,0.12)", color: "#FF9500" }
                              }
                            >
                              {comment.resolved
                                ? <><CheckCircle2 className="w-3 h-3" /> 已处理</>
                                : <><Circle className="w-3 h-3" /> 待处理</>
                              }
                            </button>
                          </div>

                          {/* Comment content */}
                          <div className="px-4 py-3">
                            <p className="text-sm text-ink-secondary leading-relaxed">{comment.content}</p>
                          </div>

                          {/* Response area */}
                          <div className="px-4 pb-3">
                            <p className="text-[10px] font-semibold text-ink-tertiary uppercase tracking-wider mb-1.5">作者回复</p>
                            <textarea
                              rows={2}
                              placeholder="记录对该条意见的回复或处理方案..."
                              value={comment.response}
                              onChange={e => updateResponse(comment.id, e.target.value)}
                              className="w-full px-3 py-2 rounded-xl text-xs resize-none leading-relaxed"
                              style={{ background: "var(--rc-card-inset-bg)", boxShadow: "inset 1px 1px 3px rgba(0,0,0,0.08)", color: "var(--rc-text-primary)" as string }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* ── AI 模拟审稿弹窗 ── */}
            {showMockReviewModal && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center"
                style={{ background: "rgba(0,0,0,0.45)" }}
                onClick={e => { if (e.target === e.currentTarget) setShowMockReviewModal(false); }}
              >
                <div
                  className="w-full max-w-2xl mx-4 rounded-3xl overflow-hidden flex flex-col"
                  style={{ background: "var(--rc-card-bg)", boxShadow: "8px 8px 32px rgba(0,0,0,0.25)", maxHeight: "88vh" }}
                >
                  {/* Header */}
                  <div className="px-6 py-5 flex items-center justify-between flex-shrink-0" style={{ borderBottom: "1px solid var(--rc-border)" }}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(175,82,222,0.12)" }}>
                        <Bot className="w-4 h-4" style={{ color: "#AF52DE" }} />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-ink-primary">AI 模拟审稿</h2>
                        <p className="text-xs text-ink-tertiary mt-0.5">基于论文内容生成模拟审稿意见，辅助投稿前自查</p>
                      </div>
                    </div>
                    <button onClick={() => setShowMockReviewModal(false)} className="p-2 rounded-xl hover:bg-black/5 transition-colors">
                      <X className="w-5 h-5 text-ink-tertiary" />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto">
                    {/* Input section */}
                    {!mockReviewResult && (
                      <div className="p-6 space-y-4">

                        {/* PDF 提取中 loading 状态 */}
                        {mockFileExtracting ? (
                          <div className="flex flex-col items-center justify-center py-12 gap-3">
                            <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#AF52DE" }} />
                            <p className="text-sm font-medium text-ink-secondary">正在读取 PDF 文件内容…</p>
                            <p className="text-xs text-ink-tertiary">完成后可在下方编辑并调整审稿参数</p>
                          </div>
                        ) : (
                          <>
                            {/* 文件来源：已读取提示 + 重新选择 */}
                            <div className="flex items-center gap-2 flex-wrap">
                              {mockFileName ? (
                                <div className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg"
                                  style={{ background: "rgba(52,199,89,0.10)", color: "#34C759" }}>
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  已读取：{mockFileName}
                                </div>
                              ) : (
                                <span className="text-[11px] text-ink-tertiary">未选择文件，可手动输入内容或：</span>
                              )}
                              {/* 重新/额外选择 PDF */}
                              <button
                                onClick={async () => {
                                  const { open } = await import("@tauri-apps/plugin-dialog");
                                  const selected = await open({
                                    multiple: false,
                                    filters: [{ name: "PDF", extensions: ["pdf"] }],
                                  });
                                  if (typeof selected === "string" && selected) {
                                    setMockFileExtracting(true);
                                    try {
                                      const { extractTextFromPdf } = await import("../lib/pdfExtract");
                                      const text = await extractTextFromPdf(selected);
                                      setMockReviewInput(p => ({ ...p, abstract: text }));
                                      setMockFileName(selected.split("/").pop() ?? "paper.pdf");
                                    } catch {
                                      /* keep existing text */
                                    } finally {
                                      setMockFileExtracting(false);
                                    }
                                  }
                                }}
                                className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-lg transition-colors"
                                style={{ background: "var(--rc-card-inset-bg)", color: "var(--rc-text-secondary)" as string, border: "1px solid var(--rc-border)" }}
                              >
                                <Upload className="w-3 h-3" />
                                {mockFileName ? "换一个 PDF" : "选择 PDF 文件"}
                              </button>
                            </div>

                            <div>
                              <p className="text-xs font-medium text-ink-secondary mb-1.5">
                                论文内容
                                <span className="ml-1 text-ink-tertiary font-normal">（PDF 提取全文 · 可编辑）</span>
                              </p>
                              <textarea
                                rows={8}
                                placeholder="PDF 提取全文或手动粘贴摘要/核心方法描述…"
                                value={mockReviewInput.abstract}
                                onChange={e => setMockReviewInput(p => ({ ...p, abstract: e.target.value }))}
                                className="w-full px-3 py-2.5 rounded-xl text-sm resize-none leading-relaxed"
                                style={{ background: "var(--rc-card-inset-bg)", boxShadow: "inset 2px 2px 5px rgba(0,0,0,0.08)", color: "var(--rc-text-primary)" as string }}
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-xs font-medium text-ink-secondary mb-1.5">审稿人数量</p>
                                <div className="flex gap-2">
                                  {([2, 3, 4] as const).map(n => (
                                    <button
                                      key={n}
                                      onClick={() => setMockReviewInput(p => ({ ...p, reviewerCount: n }))}
                                      className="flex-1 py-1.5 rounded-xl text-sm font-medium transition-all duration-150"
                                      style={mockReviewInput.reviewerCount === n
                                        ? { background: "#AF52DE", color: "#fff" }
                                        : { background: "var(--rc-card-inset-bg)", color: "var(--rc-text-secondary)" as string }
                                      }
                                    >
                                      {n === 4 ? "3+AC" : `${n} 人`}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div>
                                <p className="text-xs font-medium text-ink-secondary mb-1.5">审稿严格程度</p>
                                <div className="flex gap-2">
                                  {([
                                    { key: "lenient",  label: "宽松" },
                                    { key: "balanced", label: "平衡" },
                                    { key: "strict",   label: "严格" },
                                  ] as const).map(({ key, label }) => (
                                    <button
                                      key={key}
                                      onClick={() => setMockReviewInput(p => ({ ...p, strictness: key }))}
                                      className="flex-1 py-1.5 rounded-xl text-sm font-medium transition-all duration-150"
                                      style={mockReviewInput.strictness === key
                                        ? {
                                            background: key === "lenient" ? "#34C759" : key === "strict" ? "#FF3B30" : "#007AFF",
                                            color: "#fff",
                                          }
                                        : { background: "var(--rc-card-inset-bg)", color: "var(--rc-text-secondary)" as string }
                                      }
                                    >
                                      {label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {/* Result section */}
                    {mockReviewResult && (
                      <div className="p-6 space-y-3">
                        {/* Overall verdict banner */}
                        {(() => {
                          const verdictCounts = mockReviewResult.reduce<Record<ReviewVerdict, number>>(
                            (acc, r) => { acc[r.verdict] = (acc[r.verdict] ?? 0) + 1; return acc; },
                            { accept: 0, minor_revision: 0, major_revision: 0, reject: 0 }
                          );
                          const dominant = (Object.entries(verdictCounts) as [ReviewVerdict, number][])
                            .sort((a, b) => b[1] - a[1])[0][0];
                          const vcfg = VERDICT_CFG[dominant];
                          return (
                            <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl mb-1" style={{ background: vcfg.bg }}>
                              <span className="text-sm font-bold" style={{ color: vcfg.color }}>综合倾向：{vcfg.label}</span>
                              <span className="text-xs text-ink-secondary">
                                {mockReviewResult.length} 位审稿人 ·
                                共 {Object.entries(verdictCounts).filter(([, v]) => v > 0).map(([k, v]) => `${VERDICT_CFG[k as ReviewVerdict].label} ×${v}`).join("、")}
                              </span>
                            </div>
                          );
                        })()}

                        {mockReviewResult.map((r, idx) => {
                          const vcfg = VERDICT_CFG[r.verdict];
                          return (
                            <div
                              key={idx}
                              className="rounded-2xl overflow-hidden"
                              style={{ border: "1px solid var(--rc-border)", background: "var(--rc-card-bg)", boxShadow: "2px 2px 8px rgba(0,0,0,0.06)" }}
                            >
                              <div className="flex items-center justify-between px-4 py-2.5"
                                style={{ background: "var(--rc-card-inset-bg)", borderBottom: "1px solid var(--rc-border)" }}>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-ink-primary">{r.reviewer}</span>
                                  {r.tags.map(tag => (
                                    <span key={tag} className="text-[10px] font-medium px-1.5 py-0.5 rounded-md"
                                      style={{ background: "rgba(0,122,255,0.10)", color: "#007AFF" }}>
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                                <span className="text-xs font-bold px-2 py-0.5 rounded-lg" style={{ background: vcfg.bg, color: vcfg.color }}>
                                  {vcfg.label}
                                </span>
                              </div>
                              <div className="px-4 py-3">
                                <p className="text-sm text-ink-secondary leading-relaxed whitespace-pre-wrap">{r.content}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="px-6 py-4 flex-shrink-0 flex items-center justify-between" style={{ borderTop: "1px solid var(--rc-border)" }}>
                    {mockReviewResult ? (
                      <>
                        <button
                          onClick={() => {
                            mockReviewBufferRef.current = [];
                            setMockReviewResult(null);
                          }}
                          className="text-sm font-medium px-4 py-2 rounded-xl hover:bg-black/5 transition-colors"
                          style={{ color: "var(--rc-text-secondary)" as string }}
                        >
                          重新生成
                        </button>
                        <button
                          onClick={async () => {
                            const nextRound = reviewRounds.filter(r => r.submissionId === reviewSubId).length + 1;
                            const dominantVerdict = mockReviewResult.reduce<Record<ReviewVerdict, number>>(
                              (acc, r) => { acc[r.verdict] = (acc[r.verdict] ?? 0) + 1; return acc; },
                              { accept: 0, minor_revision: 0, major_revision: 0, reject: 0 }
                            );
                            const verdict = (Object.entries(dominantVerdict) as [ReviewVerdict, number][]).sort((a, b) => b[1] - a[1])[0][0];
                            await submissionApi.upsertRound({ submissionId: reviewSubId, round: nextRound, verdict }).catch(console.error);
                            setReviewRounds(prev => [...prev, {
                              submissionId: reviewSubId, round: nextRound, verdict, receivedAt: new Date(),
                            }]);
                            for (const r of mockReviewResult) {
                              const res = await submissionApi.createComment({
                                submissionId: reviewSubId, round: nextRound,
                                reviewer: r.reviewer, content: r.content, tags: r.tags,
                              }).catch(() => ({ id: `mock-${Date.now()}` }));
                              setReviewComments(prev => [...prev, {
                                id: (res as { id: string }).id,
                                submissionId: reviewSubId, round: nextRound,
                                reviewer: r.reviewer, content: r.content,
                                response: "", resolved: false, tags: r.tags, createdAt: new Date(),
                              }]);
                            }
                            setReviewRound(nextRound);
                            setShowMockReviewModal(false);
                          }}
                          className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-medium"
                          style={{ background: "#AF52DE", color: "#fff", boxShadow: "2px 4px 10px rgba(175,82,222,0.3)" }}
                        >
                          <Check className="w-4 h-4" />
                          导入审稿归档
                        </button>
                      </>
                    ) : (
                      <>
                        <p className="text-xs text-ink-tertiary">生成结果仅供参考，不代表真实审稿意见</p>
                        <button
                          disabled={!mockReviewInput.abstract.trim() || mockReviewLoading}
                          onClick={() => {
                            activeMockReviewSubmissionRef.current = reviewSubId;
                            mockReviewBufferRef.current = [];
                            setMockReviewLoading(true);
                            setMockReviewResult([]);
                            submissionApi.aiReview({
                              submissionId: reviewSubId,
                              content: mockReviewInput.abstract,
                              reviewerCount: mockReviewInput.reviewerCount,
                              strictness: mockReviewInput.strictness,
                            }).catch(e => { console.error(e); setMockReviewLoading(false); });
                          }}
                          className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-medium transition-all duration-150 disabled:opacity-40"
                          style={{ background: "#AF52DE", color: "#fff", boxShadow: "2px 4px 10px rgba(175,82,222,0.3)" }}
                        >
                          {mockReviewLoading
                            ? <><Loader2 className="w-4 h-4 animate-spin" />生成中...</>
                            : <><Sparkles className="w-4 h-4" />生成模拟审稿</>
                          }
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 录入审稿意见弹窗（IIFE 内，可访问 handleAddComment） */}
            {showAddReviewModal && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center"
                style={{ background: "rgba(0,0,0,0.45)" }}
                onClick={e => { if (e.target === e.currentTarget) setShowAddReviewModal(false); }}
              >
                <div
                  className="w-full max-w-lg mx-4 rounded-3xl overflow-hidden flex flex-col"
                  style={{ background: "var(--rc-card-bg)", boxShadow: "8px 8px 24px rgba(0,0,0,0.2)" }}
                >
                  <div className="px-6 py-5 flex items-center justify-between" style={{ borderBottom: "1px solid var(--rc-border)" }}>
                    <div>
                      <h2 className="text-lg font-bold text-ink-primary">录入审稿意见</h2>
                      <p className="text-xs text-ink-tertiary mt-0.5">第 {reviewRound} 轮 · {currentSub?.venue}</p>
                    </div>
                    <button onClick={() => setShowAddReviewModal(false)} className="p-2 rounded-xl hover:bg-black/5 transition-colors">
                      <X className="w-5 h-5 text-ink-tertiary" />
                    </button>
                  </div>

                  <div className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
                    {/* 本轮结论（仅新轮次显示） */}
                    {!reviewRounds.some(r => r.submissionId === reviewSubId && r.round === reviewRound) && (
                      <div>
                        <p className="text-xs font-medium text-ink-secondary mb-1.5">本轮结论</p>
                        <div className="flex gap-2 flex-wrap">
                          {(Object.entries(VERDICT_CFG) as [ReviewVerdict, typeof VERDICT_CFG[ReviewVerdict]][]).map(([k, v]) => (
                            <button
                              key={k}
                              onClick={() => setReviewForm(p => ({ ...p, verdict: k }))}
                              className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150"
                              style={reviewForm.verdict === k
                                ? { background: v.color, color: "#fff" }
                                : { background: v.bg, color: v.color }
                              }
                            >
                              {v.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <p className="text-xs font-medium text-ink-secondary mb-1">审稿人</p>
                      <input
                        type="text"
                        placeholder="如：Reviewer 1、AC、Meta-Reviewer"
                        value={reviewForm.reviewer}
                        onChange={e => setReviewForm(p => ({ ...p, reviewer: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl text-sm"
                        style={{ background: "var(--rc-card-inset-bg)", boxShadow: "inset 2px 2px 5px rgba(0,0,0,0.08)" }}
                        autoFocus
                      />
                    </div>

                    <div>
                      <p className="text-xs font-medium text-ink-secondary mb-1">审稿意见 <span style={{ color: "#FF3B30" }}>*</span></p>
                      <textarea
                        rows={6}
                        placeholder="粘贴审稿人的原始意见…"
                        value={reviewForm.content}
                        onChange={e => setReviewForm(p => ({ ...p, content: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl text-sm resize-none leading-relaxed"
                        style={{ background: "var(--rc-card-inset-bg)", boxShadow: "inset 2px 2px 5px rgba(0,0,0,0.08)" }}
                      />
                    </div>

                    <div>
                      <p className="text-xs font-medium text-ink-secondary mb-1.5">意见分类</p>
                      <div className="flex flex-wrap gap-1.5">
                        {REVIEW_TAGS.map(tag => {
                          const active = reviewForm.tags.includes(tag);
                          return (
                            <button
                              key={tag}
                              onClick={() => setReviewForm(p => ({
                                ...p,
                                tags: active ? p.tags.filter(t => t !== tag) : [...p.tags, tag],
                              }))}
                              className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-150"
                              style={active
                                ? { background: "#007AFF", color: "#fff" }
                                : { background: "var(--rc-card-inset-bg)", color: "var(--rc-text-secondary)" as string }
                              }
                            >
                              {tag}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="px-6 pb-5 flex items-center justify-between">
                    <p className="text-xs text-ink-tertiary">保存后可继续录入同轮其他审稿人意见</p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowAddReviewModal(false)}
                        className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-black/5 transition-colors"
                        style={{ color: "var(--rc-text-secondary)" as string }}
                      >
                        完成
                      </button>
                      <button
                        onClick={handleAddComment}
                        disabled={!reviewForm.reviewer.trim() || !reviewForm.content.trim()}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150 disabled:opacity-40"
                        style={{ background: "#007AFF", color: "#fff" }}
                      >
                        <Check className="w-4 h-4" />
                        保存并继续
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>);
        })()}
      </div>

      {/* ════════ 新增投稿弹窗 ════════ */}
      {showAddSubModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.45)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddSubModal(false); }}
        >
          <div
            className="w-full max-w-md mx-4 rounded-3xl overflow-hidden flex flex-col"
            style={{ background: "var(--rc-card-bg)", boxShadow: "8px 8px 24px rgba(0,0,0,0.2)" }}
          >
            <div className="px-6 py-5 flex items-center justify-between" style={{ borderBottom: "1px solid var(--rc-border)" }}>
              <h2 className="text-lg font-bold text-ink-primary">新增投稿</h2>
              <button onClick={() => setShowAddSubModal(false)} className="p-2 rounded-xl hover:bg-black/5 transition-colors">
                <X className="w-5 h-5 text-ink-tertiary" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <p className="text-xs font-medium text-ink-secondary mb-1">论文标题 <span style={{ color: "#FF3B30" }}>*</span></p>
                <input
                  type="text"
                  placeholder="输入论文标题…"
                  value={addSubForm.title}
                  onChange={e => setAddSubForm(p => ({ ...p, title: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl text-sm"
                  style={{ background: "var(--rc-card-inset-bg)", boxShadow: "inset 2px 2px 5px rgba(0,0,0,0.08)" }}
                  autoFocus
                />
              </div>

              <div>
                <p className="text-xs font-medium text-ink-secondary mb-1.5">投稿类型</p>
                <div className="flex gap-2">
                  {(["conference", "journal"] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setAddSubForm(p => ({ ...p, venueType: t }))}
                      className="flex-1 py-1.5 rounded-xl text-xs font-medium transition-all duration-150"
                      style={addSubForm.venueType === t
                        ? { background: t === "conference" ? "#007AFF" : "#AF52DE", color: "#fff" }
                        : { background: "var(--rc-card-inset-bg)", color: "var(--rc-text-secondary)" as string }
                      }
                    >
                      {t === "conference" ? "会议" : "期刊"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-ink-secondary mb-1">
                  {addSubForm.venueType === "conference" ? "会议名称" : "期刊名称"}
                  <span style={{ color: "#FF3B30" }}> *</span>
                </p>
                <input
                  type="text"
                  placeholder={addSubForm.venueType === "conference" ? "如：NeurIPS 2026" : "如：JMLR"}
                  value={addSubForm.venue}
                  onChange={e => setAddSubForm(p => ({ ...p, venue: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl text-sm"
                  style={{ background: "var(--rc-card-inset-bg)", boxShadow: "inset 2px 2px 5px rgba(0,0,0,0.08)" }}
                />
              </div>

              {addSubForm.venueType === "conference" && (
                <div>
                  <p className="text-xs font-medium text-ink-secondary mb-1">投稿截止日期</p>
                  <input
                    type="date"
                    value={addSubForm.deadline}
                    onChange={e => setAddSubForm(p => ({ ...p, deadline: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl text-sm"
                    style={{ background: "var(--rc-card-inset-bg)", boxShadow: "inset 2px 2px 5px rgba(0,0,0,0.08)" }}
                  />
                </div>
              )}
            </div>

            <div className="px-6 pb-5 flex justify-end gap-3">
              <button
                onClick={() => setShowAddSubModal(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-black/5 transition-colors"
                style={{ color: "var(--rc-text-secondary)" as string }}
              >
                取消
              </button>
              <button
                onClick={handleAddSubmission}
                disabled={!addSubForm.title.trim() || !addSubForm.venue.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150 disabled:opacity-40"
                style={{ background: "#007AFF", color: "#fff" }}
              >
                <Check className="w-4 h-4" />
                添加
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════ 记录版本弹窗 ════════ */}
      {showSaveModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.45)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowSaveModal(false); }}
        >
          <div
            className="w-full max-w-xl mx-4 rounded-3xl overflow-hidden flex flex-col"
            style={{ background: "var(--rc-card-bg)", boxShadow: "8px 8px 24px rgba(0,0,0,0.2)" }}
          >
            <div className="px-6 py-5 flex items-center justify-between" style={{ borderBottom: "1px solid var(--rc-border)" }}>
              <div>
                <h2 className="text-lg font-bold text-ink-primary">记录版本快照</h2>
                <p className="text-xs text-ink-tertiary mt-0.5">保存当前稿件内容，防止修改丢失</p>
              </div>
              <button onClick={() => setShowSaveModal(false)} className="p-2 rounded-xl hover:bg-black/5 transition-colors">
                <X className="w-5 h-5 text-ink-tertiary" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
              <div className="flex gap-3">
                <div>
                  <p className="text-xs font-medium text-ink-secondary mb-1">版本号</p>
                  <input
                    type="text"
                    placeholder={versionNextTag}
                    value={saveForm.tag}
                    onChange={e => setSaveForm(p => ({ ...p, tag: e.target.value }))}
                    className="w-24 px-3 py-2 rounded-xl text-sm font-bold"
                    style={{ background: "var(--rc-card-inset-bg)", color: "#007AFF", boxShadow: "inset 2px 2px 5px rgba(0,0,0,0.08)" }}
                  />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-ink-secondary mb-1">版本标签 <span style={{ color: "#FF3B30" }}>*</span></p>
                  <input
                    type="text"
                    placeholder="如：初稿、按审稿意见修改、camera-ready…"
                    value={saveForm.label}
                    onChange={e => setSaveForm(p => ({ ...p, label: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl text-sm"
                    style={{ background: "var(--rc-card-inset-bg)", boxShadow: "inset 2px 2px 5px rgba(0,0,0,0.08)" }}
                  />
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-ink-secondary mb-1">修改说明</p>
                <textarea
                  rows={2}
                  placeholder="简述本版本的主要改动…"
                  value={saveForm.notes}
                  onChange={e => setSaveForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl text-sm resize-none"
                  style={{ background: "var(--rc-card-inset-bg)", boxShadow: "inset 2px 2px 5px rgba(0,0,0,0.08)" }}
                />
              </div>

              <div>
                <p className="text-xs font-medium text-ink-secondary mb-1">摘要 / 核心内容 <span style={{ color: "#FF3B30" }}>*</span></p>
                <textarea
                  rows={7}
                  placeholder="粘贴当前版本的摘要或核心内容，用于后续 diff 对比…"
                  value={saveForm.content}
                  onChange={e => setSaveForm(p => ({ ...p, content: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl text-sm resize-none font-mono leading-relaxed"
                  style={{ background: "var(--rc-card-inset-bg)", boxShadow: "inset 2px 2px 5px rgba(0,0,0,0.08)" }}
                />
              </div>
            </div>

            <div className="px-6 pb-5 flex justify-end gap-3">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium transition-colors hover:bg-black/5"
                style={{ color: "var(--rc-text-secondary)" as string }}
              >
                取消
              </button>
              <button
                onClick={handleSaveVersion}
                disabled={!saveForm.label.trim() || !saveForm.content.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150 disabled:opacity-40"
                style={{ background: "#007AFF", color: "#fff" }}
              >
                <Check className="w-4 h-4" />
                保存版本
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════ 添加会议/期刊弹窗 ════════ */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.45)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddModal(false); }}
        >
          <div
            className="w-full max-w-3xl max-h-[85vh] mx-4 rounded-3xl overflow-hidden flex flex-col"
            style={{ background: "var(--rc-card-bg)", boxShadow: "8px 8px 24px rgba(0,0,0,0.2)" }}
          >
            {/* Header */}
            <div className="flex-shrink-0 px-6 py-5 border-b" style={{ borderColor: "var(--rc-border)" }}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-ink-primary">添加会议/期刊</h2>
                  <p className="text-xs text-ink-tertiary mt-0.5">从 CCF 推荐目录中选择要追踪的会议或期刊</p>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-2 rounded-xl hover:bg-black/5 transition-colors"
                >
                  <X className="w-5 h-5 text-ink-tertiary" />
                </button>
              </div>

              {/* Search and filters */}
              <div className="mt-4 flex gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-tertiary" />
                  <input
                    type="text"
                    placeholder="搜索会议或期刊…"
                    value={addModalSearch}
                    onChange={(e) => setAddModalSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 rounded-xl text-sm"
                    style={{
                      background: "var(--rc-card-inset-bg)",
                      boxShadow: "inset 2px 2px 5px rgba(0,0,0,0.08)",
                    }}
                  />
                </div>
                <select
                  value={addModalAreaFilter}
                  onChange={(e) => setAddModalAreaFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl text-sm font-medium cursor-pointer"
                  style={{
                    background: "var(--rc-card-bg)",
                    boxShadow: "2px 2px 6px rgba(0,0,0,0.08), -1px -1px 4px rgba(255,255,255,0.6)",
                  }}
                >
                  <option value="all">全部领域</option>
                  {areas.map(area => (
                    <option key={area} value={area}>{area}</option>
                  ))}
                </select>
                <div className="flex gap-1">
                  {(["all", "conference", "journal"] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setAddModalTypeFilter(t)}
                      className="px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150"
                      style={addModalTypeFilter === t
                        ? { background: "#007AFF", color: "#fff" }
                        : { background: "var(--rc-card-bg)", color: "var(--rc-text-secondary)" as string, boxShadow: "2px 2px 6px rgba(0,0,0,0.08), -1px -1px 4px rgba(255,255,255,0.6)" }
                      }
                    >
                      {t === "all" ? "全部" : t === "conference" ? "会议" : "期刊"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {filteredVenueTemplates.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sm text-ink-tertiary">未找到匹配的会议或期刊</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {filteredVenueTemplates.map(venue => {
                    const added = isVenueAdded(venue);
                    return (
                      <div
                        key={venue.id}
                        className="rounded-2xl p-4 transition-all duration-150"
                        style={{
                          background: added ? "rgba(52,199,89,0.07)" : "var(--rc-card-bg)",
                          boxShadow: added ? "none" : "2px 2px 8px rgba(0,0,0,0.08), -1px -1px 4px rgba(255,255,255,0.7)",
                          opacity: added ? 0.7 : 1,
                        }}
                      >
                        {/* Title row */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            {venue.website ? (
                              <ExternalLink
                                href={venue.website}
                                className="font-bold text-base text-ink-primary truncate hover:text-blue-600 hover:underline block"
                              >
                                {venue.name}
                              </ExternalLink>
                            ) : (
                              <p className="font-bold text-base text-ink-primary truncate">{venue.name}</p>
                            )}
                            <p className="text-[11px] text-ink-tertiary truncate mt-0.5">{venue.fullName}</p>
                          </div>
                          {/* Add button */}
                          <button
                            onClick={() => !added && handleAddVenue(venue)}
                            disabled={added}
                            className="flex-shrink-0 p-2 rounded-xl transition-all duration-150"
                            style={added
                              ? { background: "rgba(52,199,89,0.15)", cursor: "default" }
                              : { background: "#007AFF", boxShadow: "2px 2px 6px rgba(0,122,255,0.3)" }
                            }
                          >
                            {added
                              ? <Check className="w-4 h-4" style={{ color: "#34C759" }} />
                              : <Plus className="w-4 h-4 text-white" />
                            }
                          </button>
                        </div>

                        {/* Tags row */}
                        <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                          {/* CCF tag */}
                          <span
                            className="text-[11px] font-bold px-2 py-0.5 rounded-md"
                            style={{
                              background: venue.ccf === "A" ? "rgba(255,59,48,0.12)" :
                                venue.ccf === "B" ? "rgba(255,149,0,0.12)" :
                                venue.ccf === "C" ? "rgba(0,122,255,0.12)" :
                                "rgba(142,142,147,0.12)",
                              color: venue.ccf === "A" ? "#FF3B30" :
                                venue.ccf === "B" ? "#FF9500" :
                                venue.ccf === "C" ? "#007AFF" : "#8E8E93",
                            }}
                          >
                            CCF {venue.ccf}
                          </span>
                          {/* Type tag */}
                          <span
                            className="text-[10px] font-medium px-1.5 py-0.5 rounded-md"
                            style={{
                              background: venue.type === "conference" ? "rgba(0,122,255,0.10)" : "rgba(175,82,222,0.10)",
                              color: venue.type === "conference" ? "#007AFF" : "#AF52DE",
                            }}
                          >
                            {venue.type === "conference" ? "会议" : "期刊"}
                          </span>
                          {/* SCI tag */}
                          {venue.sci && (
                            <span
                              className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                              style={{ background: "rgba(52,199,89,0.12)", color: "#34C759" }}
                            >
                              SCI{venue.sciQuartile ? ` ${venue.sciQuartile}` : ""}
                            </span>
                          )}
                          {/* EI tag */}
                          {venue.ei && (
                            <span
                              className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                              style={{ background: "rgba(88,86,214,0.12)", color: "#5856D6" }}
                            >
                              EI
                            </span>
                          )}
                          {/* Area tag */}
                          <span className="text-[10px] text-ink-tertiary ml-auto">
                            {venue.area}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 px-6 py-4 border-t flex items-center justify-between" style={{ borderColor: "var(--rc-border)" }}>
              <p className="text-xs text-ink-tertiary">
                共 {filteredVenueTemplates.length} 个结果，已追踪 {conferences.length + journals.length} 个
              </p>
              <button
                onClick={() => setShowAddModal(false)}
                className="px-5 py-2 rounded-2xl text-sm font-medium transition-all duration-150"
                style={{ background: "#E8ECF0", color: "#3C3C43", boxShadow: "3px 3px 6px #C8CDD3, -3px -3px 6px #FFFFFF" }}
              >
                完成
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cover Letter 弹窗 ── */}
      {showCoverLetterModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.45)" }}
          onClick={e => { if (e.target === e.currentTarget) setShowCoverLetterModal(false); }}
        >
          <div
            className="w-full max-w-2xl mx-4 rounded-3xl overflow-hidden flex flex-col"
            style={{ background: "var(--rc-card-bg)", boxShadow: "8px 8px 24px rgba(0,0,0,0.2)", maxHeight: "80vh" }}
          >
            <div className="px-6 py-5 flex items-center justify-between flex-shrink-0" style={{ borderBottom: "1px solid var(--rc-border)" }}>
              <div>
                <h2 className="text-lg font-bold text-ink-primary">生成 Cover Letter</h2>
                <p className="text-xs text-ink-tertiary mt-0.5">基于投稿历史与审稿意见自动生成</p>
              </div>
              <button onClick={() => setShowCoverLetterModal(false)} className="p-2 rounded-xl hover:bg-black/5">
                <X className="w-5 h-5 text-ink-tertiary" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {coverLetterLoading && !coverLetterText ? (
                <div className="flex items-center gap-2 text-ink-tertiary text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  正在生成…
                </div>
              ) : (
                <textarea
                  className="w-full h-80 text-sm font-mono resize-none rounded-xl p-3 outline-none"
                  style={{ background: "var(--rc-card-inset-bg)", color: "var(--rc-text-primary)" as string, border: "1px solid var(--rc-border)" }}
                  value={coverLetterText}
                  onChange={e => setCoverLetterText(e.target.value)}
                />
              )}
            </div>
            <div className="px-6 py-4 flex-shrink-0 flex justify-end gap-3" style={{ borderTop: "1px solid var(--rc-border)" }}>
              <button
                onClick={() => navigator.clipboard.writeText(coverLetterText)}
                disabled={!coverLetterText}
                className="px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-40"
                style={{ background: "rgba(0,122,255,0.1)", color: "#007AFF" }}
              >
                复制
              </button>
              <button
                onClick={() => setShowCoverLetterModal(false)}
                className="px-5 py-2 rounded-xl text-sm font-medium"
                style={{ background: "#007AFF", color: "#fff" }}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── AI 润色侧边面板 ── */}
      {showPolishPanel && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.45)" }}
          onClick={e => { if (e.target === e.currentTarget) setShowPolishPanel(false); }}
        >
          <div
            className="w-full max-w-2xl mx-4 rounded-3xl overflow-hidden flex flex-col"
            style={{ background: "var(--rc-card-bg)", boxShadow: "8px 8px 24px rgba(0,0,0,0.2)", maxHeight: "80vh" }}
          >
            <div className="px-6 py-5 flex items-center justify-between flex-shrink-0" style={{ borderBottom: "1px solid var(--rc-border)" }}>
              <div>
                <h2 className="text-lg font-bold text-ink-primary">AI 润色</h2>
                <p className="text-xs text-ink-tertiary mt-0.5">对版本摘要/核心内容进行学术润色</p>
              </div>
              <button onClick={() => setShowPolishPanel(false)} className="p-2 rounded-xl hover:bg-black/5">
                <X className="w-5 h-5 text-ink-tertiary" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {polishLoading && !polishText ? (
                <div className="flex items-center gap-2 text-ink-tertiary text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  润色中…
                </div>
              ) : (
                <div>
                  <p className="text-xs font-medium text-ink-secondary mb-2">润色结果</p>
                  <textarea
                    className="w-full h-72 text-sm resize-none rounded-xl p-3 outline-none"
                    style={{ background: "var(--rc-card-inset-bg)", color: "var(--rc-text-primary)" as string, border: "1px solid var(--rc-border)" }}
                    value={polishText}
                    onChange={e => setPolishText(e.target.value)}
                    placeholder={polishLoading ? "生成中…" : "润色结果将显示在此处"}
                  />
                  {polishLoading && (
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-ink-tertiary">
                      <Loader2 className="w-3 h-3 animate-spin" /> 生成中…
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="px-6 py-4 flex-shrink-0 flex justify-end gap-3" style={{ borderTop: "1px solid var(--rc-border)" }}>
              <button
                onClick={() => navigator.clipboard.writeText(polishText)}
                disabled={!polishText}
                className="px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-40"
                style={{ background: "rgba(0,122,255,0.1)", color: "#007AFF" }}
              >
                复制
              </button>
              <button
                onClick={() => {
                  if (!polishText || !polishSourceId) return;
                  setVersions(prev => prev.map(v => v.id === polishSourceId ? { ...v, content: polishText } : v));
                  setShowPolishPanel(false);
                }}
                disabled={!polishText}
                className="px-5 py-2 rounded-xl text-sm font-medium disabled:opacity-40"
                style={{ background: "#007AFF", color: "#fff" }}
              >
                应用到版本
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
