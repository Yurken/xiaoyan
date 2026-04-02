import { useState } from "react";
import {
  Bell,
  BookOpen,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  CheckSquare,
  Circle,
  Clock,
  FilePlus,
  GitBranch,
  History,
  KanbanSquare,
  Plus,
  Save,
  Search,
  Sparkles,
  Star,
  StarOff,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { Button, Card } from "@research-copilot/ui";
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

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_CONFERENCES: Conference[] = [
  {
    id: "1", type: "conference", name: "NeurIPS 2026", fullName: "Conference on Neural Information Processing Systems",
    website: "https://neurips.cc",
    deadline: new Date("2026-05-15"), notificationDate: new Date("2026-09-10"),
    ccf: "A", area: "AI/ML", starred: true, ei: true,
  },
  {
    id: "2", type: "conference", name: "ACL 2026", fullName: "Annual Meeting of the Association for Computational Linguistics",
    website: "https://aclweb.org",
    deadline: new Date("2026-04-20"), notificationDate: new Date("2026-06-20"),
    ccf: "A", area: "NLP", starred: true, ei: true,
  },
  {
    id: "3", type: "conference", name: "ICML 2026", fullName: "International Conference on Machine Learning",
    website: "https://icml.cc",
    deadline: new Date("2026-06-01"), notificationDate: new Date("2026-09-01"),
    ccf: "A", area: "ML", starred: false, ei: true,
  },
  {
    id: "4", type: "conference", name: "EMNLP 2026", fullName: "Empirical Methods in Natural Language Processing",
    website: "https://aclanthology.org/venues/emnlp/",
    deadline: new Date("2026-06-14"), notificationDate: new Date("2026-09-01"),
    ccf: "B", area: "NLP", starred: false, ei: true,
  },
  {
    id: "5", type: "conference", name: "ICLR 2027", fullName: "International Conference on Learning Representations",
    website: "https://iclr.cc",
    deadline: new Date("2026-10-01"), notificationDate: new Date("2027-01-20"),
    ccf: "A", area: "DL", starred: false, ei: true,
  },
  {
    id: "6", type: "conference", name: "CVPR 2026", fullName: "Conference on Computer Vision and Pattern Recognition",
    website: "https://cvpr.thecvf.com",
    deadline: new Date("2025-11-14"),
    ccf: "A", area: "CV", starred: false, ei: true,
  },
];

const MOCK_JOURNALS: Journal[] = [
  {
    id: "j1", type: "journal", name: "JMLR", fullName: "Journal of Machine Learning Research",
    website: "https://jmlr.org",
    ccf: "A", area: "ML", starred: true, sci: true, sciQuartile: "Q1",
  },
  {
    id: "j2", type: "journal", name: "TACL", fullName: "Transactions of the Association for Computational Linguistics",
    website: "https://aclanthology.org/tacl",
    ccf: "A", area: "NLP", starred: true, sci: true, sciQuartile: "Q1",
    specialIssueDeadline: new Date("2026-06-30"),
    specialIssueTitle: "Special Issue on Large Language Models",
  },
  {
    id: "j3", type: "journal", name: "TPAMI", fullName: "IEEE Transactions on Pattern Analysis and Machine Intelligence",
    website: "https://ieeexplore.ieee.org/xpl/RecentIssue.jsp?punumber=34",
    ccf: "A", area: "CV", starred: false, sci: true, sciQuartile: "Q1",
  },
  {
    id: "j4", type: "journal", name: "ACM CSUR", fullName: "ACM Computing Surveys",
    website: "https://dl.acm.org/journal/csur",
    ccf: "B", area: "General", starred: false, sci: true, sciQuartile: "Q2",
    specialIssueDeadline: new Date("2026-08-15"),
    specialIssueTitle: "Survey on AI Ethics",
  },
  {
    id: "j5", type: "journal", name: "KAIS", fullName: "Knowledge and Information Systems",
    website: "https://link.springer.com/journal/10115",
    ccf: "C", area: "AI", starred: false, sci: true, sciQuartile: "Q3", ei: true,
  },
];

const MOCK_SUBMISSIONS: Submission[] = [
  {
    id: "1",
    title: "Efficient Attention Mechanism for Long-Context Documents",
    venue: "NeurIPS 2026",
    venueType: "conference",
    status: "writing",
    deadline: new Date("2026-05-15"),
  },
  {
    id: "2",
    title: "Cross-lingual Transfer Learning in Low-Resource Settings",
    venue: "ACL 2026",
    venueType: "conference",
    status: "submitted",
    submittedAt: new Date("2026-03-28"),
  },
  {
    id: "3",
    title: "Graph Neural Networks for Knowledge Graph Completion",
    venue: "ICML 2026",
    venueType: "conference",
    status: "reviewing",
    submittedAt: new Date("2026-02-10"),
  },
  {
    id: "4",
    title: "Multimodal Contrastive Learning with Sparse Encoders",
    venue: "CVPR 2026",
    venueType: "conference",
    status: "accepted",
  },
  {
    id: "5",
    title: "Robust Text Classification under Distribution Shift",
    venue: "EMNLP 2025",
    venueType: "conference",
    status: "rejected",
  },
  {
    id: "6",
    title: "A Survey on Efficient Inference Methods for LLMs",
    venue: "JMLR",
    venueType: "journal",
    status: "writing",
  },
  {
    id: "7",
    title: "Unified Framework for Multi-task NLU",
    venue: "TACL",
    venueType: "journal",
    status: "submitted",
    submittedAt: new Date("2026-02-15"),
  },
];

const V1_CONTENT = `We propose an efficient attention mechanism for processing long-context documents. The key challenge is that standard self-attention scales quadratically with sequence length, making it impractical for documents exceeding 4K tokens.

Our method introduces sparse local windows combined with global summary tokens, reducing complexity to O(n log n) while preserving 97% of full-attention accuracy on standard benchmarks.

Experiments on LongBench, SCROLLS, and QASPER demonstrate state-of-the-art performance with 4× throughput improvement.`;

const V2_CONTENT = `We propose an efficient attention mechanism for processing long-context documents. The key challenge is that standard self-attention scales quadratically with sequence length, making it impractical for documents exceeding 8K tokens.

Our method introduces hierarchical sparse windows combined with learnable global summary tokens, reducing complexity to O(n log n) while preserving 98.3% of full-attention accuracy on standard benchmarks. Unlike prior work, our approach is fully compatible with existing pre-trained models via lightweight adapter fine-tuning.

Experiments on LongBench, SCROLLS, QASPER, and NarrativeQA demonstrate state-of-the-art performance. We achieve 4.8× throughput improvement over FlashAttention-2 on sequences of 32K tokens, with only 12% additional memory overhead.`;

const V3_CONTENT = `We propose EfficientLongAttn, an efficient attention mechanism for processing long-context documents. Standard self-attention scales quadratically (O(n²)) with sequence length, prohibiting deployment on documents exceeding 8K tokens in memory-constrained settings.

Our method introduces hierarchical sparse windows combined with learnable global summary tokens, reducing complexity to O(n log n) while preserving 98.3% of full-attention accuracy. Unlike prior sparse attention methods (Longformer, BigBird), our approach requires no architectural modifications and is plug-and-play compatible with any pre-trained transformer via lightweight LoRA-style adapters.

Extensive experiments on six long-document benchmarks (LongBench, SCROLLS, QASPER, NarrativeQA, QuALITY, MUSIIQUE) demonstrate consistent state-of-the-art performance. EfficientLongAttn achieves 4.8× throughput improvement over FlashAttention-2 on 32K-token sequences with only 12% additional memory. We further validate on real-world legal and biomedical document corpora.`;

const GNN_V1 = `We address knowledge graph completion (KGC) using graph neural networks. Existing embedding-based methods (TransE, RotatE) capture relational patterns but ignore multi-hop structural context.

We propose StructGNN, which aggregates neighborhood information through typed relational message passing. On FB15k-237 and WN18RR, StructGNN achieves competitive MRR scores.`;

const GNN_V2 = `We address knowledge graph completion (KGC) using graph neural networks. Existing embedding-based methods (TransE, RotatE) capture relational patterns but fail to leverage multi-hop structural context and entity type constraints.

We propose StructGNN, which aggregates neighborhood information through typed relational message passing with a novel relation-aware attention mechanism. We further introduce a type-constrained negative sampling strategy that reduces false negatives by 31%.

On FB15k-237, WN18RR, and YAGO3-10, StructGNN outperforms all baselines by +2.1 MRR on average. Ablation studies confirm the complementary benefit of structural and type constraints.`;

const MOCK_VERSIONS: PaperVersion[] = [
  { id: "pv1", submissionId: "1", tag: "v1.0", label: "初稿", stage: "writing", content: V1_CONTENT, notes: "完成论文初稿，核心方法已确定，实验结果待补充。", createdAt: new Date("2026-01-10") },
  { id: "pv2", submissionId: "1", tag: "v1.1", label: "补充实验", stage: "writing", content: V2_CONTENT, notes: "增加 NarrativeQA 实验，修正 abstract 中序列长度描述（4K→8K），补充与 FlashAttention-2 的对比数据。", createdAt: new Date("2026-02-18") },
  { id: "pv3", submissionId: "1", tag: "v2.0", label: "投稿版", stage: "writing", content: V3_CONTENT, notes: "全面修改 introduction，新增 6 个 benchmark，重写 related work，润色全文语言表达。", createdAt: new Date("2026-03-30") },
  { id: "pv4", submissionId: "3", tag: "v1.0", label: "初稿", stage: "writing", content: GNN_V1, notes: "论文初稿，方法部分基本成型。", createdAt: new Date("2025-12-05") },
  { id: "pv5", submissionId: "3", tag: "v2.0", label: "重构实验", stage: "submitted", content: GNN_V2, notes: "重构实验部分，加入类型约束负采样，新增 YAGO3-10 数据集，消融实验补充完整。", createdAt: new Date("2026-01-28") },
];

const VERDICT_CFG: Record<ReviewVerdict, { label: string; color: string; bg: string }> = {
  accept:           { label: "接收",     color: "#34C759", bg: "rgba(52,199,89,0.12)"   },
  minor_revision:   { label: "小修",     color: "#007AFF", bg: "rgba(0,122,255,0.12)"   },
  major_revision:   { label: "大修",     color: "#FF9500", bg: "rgba(255,149,0,0.12)"   },
  reject:           { label: "拒稿",     color: "#FF3B30", bg: "rgba(255,59,48,0.12)"   },
};

const REVIEW_TAGS = ["实验", "写作", "方法", "贡献", "相关工作", "理论", "复杂度", "消融实验"];

const MOCK_ROUNDS: ReviewRound[] = [
  { submissionId: "3", round: 1, verdict: "major_revision", receivedAt: new Date("2026-03-05") },
  { submissionId: "2", round: 1, verdict: "minor_revision",  receivedAt: new Date("2026-04-15") },
];

const MOCK_REVIEW_COMMENTS: ReviewComment[] = [
  // Submission 3 - Round 1 (major revision)
  {
    id: "rc1", submissionId: "3", round: 1, reviewer: "Reviewer 1",
    content: "The proposed StructGNN lacks comparison with recent baselines (NBFNet, NodePiece). The performance gap over TransE is marginal on WN18RR and may not be statistically significant. Please provide significance tests and include missing baselines.",
    response: "感谢审稿人的意见。我们已补充 NBFNet 和 NodePiece 的对比实验，并添加了显著性检验（paired t-test, p<0.01）。详见修改稿 Table 2 和附录 A。",
    resolved: true, tags: ["实验", "相关工作"], createdAt: new Date("2026-03-06"),
  },
  {
    id: "rc2", submissionId: "3", round: 1, reviewer: "Reviewer 2",
    content: "The type-constrained negative sampling strategy is the key contribution, but its description in Section 3.2 is unclear. Algorithm 1 is missing. The complexity analysis should be extended to cover the sampling procedure.",
    response: "",
    resolved: false, tags: ["方法", "写作", "复杂度"], createdAt: new Date("2026-03-06"),
  },
  {
    id: "rc3", submissionId: "3", round: 1, reviewer: "Reviewer 3",
    content: "Minor issues: (1) Figure 3 caption is too brief. (2) Several grammatical errors in the introduction. (3) The related work section does not discuss inductive KGC methods.",
    response: "已修正图注、润色 introduction 并在 Related Work 中补充 inductive KGC 相关综述（NBFNet, COMPILE, GraIL）。",
    resolved: true, tags: ["写作", "相关工作"], createdAt: new Date("2026-03-06"),
  },
  // Submission 2 - Round 1 (minor revision)
  {
    id: "rc4", submissionId: "2", round: 1, reviewer: "Reviewer 1",
    content: "The cross-lingual transfer results on African languages are impressive, but the paper should discuss failure cases more explicitly. Table 4 has inconsistent formatting.",
    response: "",
    resolved: false, tags: ["写作", "贡献"], createdAt: new Date("2026-04-16"),
  },
  {
    id: "rc5", submissionId: "2", round: 1, reviewer: "Reviewer 2",
    content: "Please clarify the computational cost compared to full fine-tuning. The efficiency claims in Section 4 are not backed by wall-clock time measurements.",
    response: "已在 Section 4.3 补充训练时间与 GPU 资源消耗对比表，与 full fine-tuning 和 LoRA 基线对齐。",
    resolved: true, tags: ["实验", "复杂度"], createdAt: new Date("2026-04-16"),
  },
];

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
  const [conferences, setConferences] = useState<Conference[]>(MOCK_CONFERENCES);
  const [journals, setJournals] = useState<Journal[]>(MOCK_JOURNALS);
  const [venueFilter, setVenueFilter] = useState<"all" | "conference" | "journal" | "starred">("all");

  // Add venue modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalSearch, setAddModalSearch] = useState("");
  const [addModalAreaFilter, setAddModalAreaFilter] = useState<string>("all");
  const [addModalTypeFilter, setAddModalTypeFilter] = useState<"all" | "conference" | "journal">("all");

  // Kanban state
  const [submissions, setSubmissions] = useState<Submission[]>(MOCK_SUBMISSIONS);

  // Checklist state
  const [checklist, setChecklist] = useState<ChecklistItem[]>(DEFAULT_CHECKLIST);
  const [checklistCat, setChecklistCat] = useState<string>("all");

  // Add submission modal state
  const [showAddSubModal, setShowAddSubModal] = useState(false);
  const [addSubForm, setAddSubForm] = useState<{
    title: string; venue: string; venueType: VenueType; deadline: string;
  }>({ title: "", venue: "", venueType: "conference", deadline: "" });

  // Version control state
  const [versions, setVersions] = useState<PaperVersion[]>(MOCK_VERSIONS);
  const [versionSubId, setVersionSubId] = useState<string>(MOCK_SUBMISSIONS[0].id);
  const [compareIds, setCompareIds] = useState<[string, string] | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveForm, setSaveForm] = useState({ tag: "", label: "", notes: "", content: "" });

  // Review archive state
  const [reviewComments, setReviewComments] = useState<ReviewComment[]>(MOCK_REVIEW_COMMENTS);
  const [reviewRounds, setReviewRounds] = useState<ReviewRound[]>(MOCK_ROUNDS);
  const [reviewSubId, setReviewSubId] = useState<string>(MOCK_SUBMISSIONS[2].id);
  const [reviewRound, setReviewRound] = useState<number>(1);
  const [showAddReviewModal, setShowAddReviewModal] = useState(false);
  const [reviewForm, setReviewForm] = useState({
    reviewer: "", content: "", tags: [] as string[], verdict: "major_revision" as ReviewVerdict,
  });

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
  };

  // ── Add venue helpers ──
  const handleAddVenue = (template: VenueTemplate) => {
    const newId = `${template.id}-${Date.now()}`;
    if (template.type === "conference") {
      const newConf: Conference = {
        id: newId,
        type: "conference",
        name: template.name,
        fullName: template.fullName,
        website: template.website,
        deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 默认 90 天后
        ccf: template.ccf,
        area: template.area,
        starred: false,
        ei: template.ei,
      };
      setConferences(prev => [...prev, newConf]);
    } else {
      const newJournal: Journal = {
        id: newId,
        type: "journal",
        name: template.name,
        fullName: template.fullName,
        website: template.website,
        ccf: template.ccf,
        area: template.area,
        starred: false,
        sci: template.sci,
        sciQuartile: template.sciQuartile,
        ei: template.ei,
      };
      setJournals(prev => [...prev, newJournal]);
    }
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
      return { ...s, status: KANBAN_COLS[nextIdx].key, submittedAt: direction === "next" && s.status === "writing" ? new Date() : s.submittedAt };
    }));
  };

  // ── Add submission helper ──
  const handleAddSubmission = () => {
    if (!addSubForm.title.trim() || !addSubForm.venue.trim()) return;
    const newSub: Submission = {
      id: `sub-${Date.now()}`,
      title: addSubForm.title.trim(),
      venue: addSubForm.venue.trim(),
      venueType: addSubForm.venueType,
      status: "writing",
      deadline: addSubForm.deadline ? new Date(addSubForm.deadline) : undefined,
    };
    setSubmissions(prev => [...prev, newSub]);
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

  const handleSaveVersion = () => {
    if (!saveForm.label.trim() || !saveForm.content.trim()) return;
    const currentSub = submissions.find(s => s.id === versionSubId);
    const newVer: PaperVersion = {
      id: `pv-${Date.now()}`,
      submissionId: versionSubId,
      tag: saveForm.tag.trim() || versionNextTag,
      label: saveForm.label.trim(),
      stage: currentSub?.status ?? "writing",
      content: saveForm.content.trim(),
      notes: saveForm.notes.trim(),
      createdAt: new Date(),
    };
    setVersions(prev => [...prev, newVer]);
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
            <p className="mt-0.5 text-sm text-ink-tertiary">追踪会议与期刊，管理论文投稿全流程</p>
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
                          placeholder="描述你的研究方向或当前论文主题..."
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
                            placeholder="如：LLM, graph, retrieval, NLP..."
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
                            placeholder="如：偏理论 / 工程落地 / 希望 CCF A..."
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
                            <div className="mt-1.5 flex items-center gap-1">
                              <Trophy className="w-3 h-3" style={{ color: "#34C759" }} />
                              <span className="text-[11px] font-medium" style={{ color: "#34C759" }}>已录用</span>
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
                    <p className="text-sm text-ink-tertiary">暂无版本记录，点击「记录版本」保存当前稿件快照</p>
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

          const handleAddComment = () => {
            if (!reviewForm.reviewer.trim() || !reviewForm.content.trim()) return;
            const isNewRound = !roundNums.includes(reviewRound);
            if (isNewRound) {
              setReviewRounds(prev => [...prev, {
                submissionId: reviewSubId, round: reviewRound,
                verdict: reviewForm.verdict, receivedAt: new Date(),
              }]);
            }
            setReviewComments(prev => [...prev, {
              id: `rc-${Date.now()}`,
              submissionId: reviewSubId,
              round: reviewRound,
              reviewer: reviewForm.reviewer.trim(),
              content: reviewForm.content.trim(),
              response: "",
              resolved: false,
              tags: reviewForm.tags,
              createdAt: new Date(),
            }]);
            setReviewForm(p => ({ ...p, reviewer: `Reviewer ${reviewForm.reviewer.match(/\d+/) ? parseInt(reviewForm.reviewer.match(/\d+/)![0]) + 1 : 2}`, content: "", tags: [] }));
          };

          const toggleResolved = (id: string) =>
            setReviewComments(prev => prev.map(c => c.id === id ? { ...c, resolved: !c.resolved } : c));

          const updateResponse = (id: string, response: string) =>
            setReviewComments(prev => prev.map(c => c.id === id ? { ...c, response } : c));

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
                  <button
                    onClick={handleAddRoundAndOpen}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium"
                    style={{ background: "#007AFF", color: "#fff", boxShadow: "2px 4px 10px rgba(0,122,255,0.25)" }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    录入审稿意见
                  </button>
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
                        placeholder="粘贴审稿人的原始意见..."
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
                  placeholder="输入论文标题..."
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
                    placeholder="如：初稿、按审稿意见修改、camera-ready..."
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
                  placeholder="简述本版本的主要改动..."
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
                  placeholder="粘贴当前版本的摘要或核心内容，用于后续 diff 对比..."
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
                    placeholder="搜索会议或期刊..."
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
    </div>
  );
}
