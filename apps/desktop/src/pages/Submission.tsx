import { useState } from "react";
import {
  Bell,
  Calendar,
  CheckCircle2,
  CheckSquare,
  Circle,
  Clock,
  FilePlus,
  KanbanSquare,
  Plus,
  Send,
  Star,
  StarOff,
  Trophy,
  Users,
} from "lucide-react";
import { Button, Card } from "@research-copilot/ui";

// ─── Types ────────────────────────────────────────────────────────────────────

type CcfRating = "A" | "B" | "C" | "none";
type SubmissionStatus = "writing" | "submitted" | "reviewing" | "accepted" | "rejected";

interface Conference {
  id: string;
  name: string;
  fullName: string;
  deadline: Date;
  notificationDate?: Date;
  ccf: CcfRating;
  area: string;
  starred: boolean;
}

interface Submission {
  id: string;
  title: string;
  conference: string;
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

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_CONFERENCES: Conference[] = [
  {
    id: "1", name: "NeurIPS 2026", fullName: "Conference on Neural Information Processing Systems",
    deadline: new Date("2026-05-15"), notificationDate: new Date("2026-09-10"),
    ccf: "A", area: "AI/ML", starred: true,
  },
  {
    id: "2", name: "ACL 2026", fullName: "Annual Meeting of the Association for Computational Linguistics",
    deadline: new Date("2026-04-20"), notificationDate: new Date("2026-06-20"),
    ccf: "A", area: "NLP", starred: true,
  },
  {
    id: "3", name: "ICML 2026", fullName: "International Conference on Machine Learning",
    deadline: new Date("2026-06-01"), notificationDate: new Date("2026-09-01"),
    ccf: "A", area: "ML", starred: false,
  },
  {
    id: "4", name: "EMNLP 2026", fullName: "Empirical Methods in Natural Language Processing",
    deadline: new Date("2026-06-14"), notificationDate: new Date("2026-09-01"),
    ccf: "B", area: "NLP", starred: false,
  },
  {
    id: "5", name: "ICLR 2027", fullName: "International Conference on Learning Representations",
    deadline: new Date("2026-10-01"), notificationDate: new Date("2027-01-20"),
    ccf: "A", area: "DL", starred: false,
  },
  {
    id: "6", name: "CVPR 2026", fullName: "Conference on Computer Vision and Pattern Recognition",
    deadline: new Date("2025-11-14"),
    ccf: "A", area: "CV", starred: false,
  },
];

const MOCK_SUBMISSIONS: Submission[] = [
  {
    id: "1",
    title: "Efficient Attention Mechanism for Long-Context Documents",
    conference: "NeurIPS 2026",
    status: "writing",
    deadline: new Date("2026-05-15"),
  },
  {
    id: "2",
    title: "Cross-lingual Transfer Learning in Low-Resource Settings",
    conference: "ACL 2026",
    status: "submitted",
    submittedAt: new Date("2026-03-28"),
  },
  {
    id: "3",
    title: "Graph Neural Networks for Knowledge Graph Completion",
    conference: "ICML 2026",
    status: "reviewing",
    submittedAt: new Date("2026-02-10"),
  },
  {
    id: "4",
    title: "Multimodal Contrastive Learning with Sparse Encoders",
    conference: "CVPR 2026",
    status: "accepted",
  },
  {
    id: "5",
    title: "Robust Text Classification under Distribution Shift",
    conference: "EMNLP 2025",
    status: "rejected",
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
  const [tab, setTab] = useState<"conferences" | "kanban" | "checklist">("conferences");

  // Conference state
  const [conferences, setConferences] = useState<Conference[]>(MOCK_CONFERENCES);
  const [confFilter, setConfFilter] = useState<"all" | "starred">("all");

  // Kanban state
  const [submissions, setSubmissions] = useState<Submission[]>(MOCK_SUBMISSIONS);

  // Checklist state
  const [checklist, setChecklist] = useState<ChecklistItem[]>(DEFAULT_CHECKLIST);
  const [checklistCat, setChecklistCat] = useState<string>("all");

  // ── Conference helpers ──
  const visibleConferences = [...conferences]
    .filter(c => confFilter === "all" || c.starred)
    .sort((a, b) => {
      const dA = getDaysUntil(a.deadline);
      const dB = getDaysUntil(b.deadline);
      if (dA < 0 && dB >= 0) return 1;
      if (dB < 0 && dA >= 0) return -1;
      return dA - dB;
    });

  const toggleStar = (id: string) =>
    setConferences(prev => prev.map(c => c.id === id ? { ...c, starred: !c.starred } : c));

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
            <p className="mt-0.5 text-sm text-ink-tertiary">追踪会议截止日期，管理论文投稿全流程</p>
          </div>
          <div className="flex gap-3">
            {[
              { label: "追踪会议",   value: conferences.length, color: "#007AFF" },
              { label: "进行中",     value: activeCount,        color: "#AF52DE" },
              { label: "已接收",     value: acceptedCount,      color: "#34C759" },
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
                {(["all", "starred"] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setConfFilter(f)}
                    className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150"
                    style={confFilter === f
                      ? { background: "#007AFF", color: "#fff" }
                      : { background: "var(--rc-card-bg)", color: "var(--rc-text-secondary)" as string, boxShadow: "2px 2px 6px rgba(0,0,0,0.08), -1px -1px 4px rgba(255,255,255,0.6)" }
                    }
                  >
                    {f === "all" ? "全部" : "⭐ 已关注"}
                  </button>
                ))}
              </div>
              <Button variant="secondary" size="sm">
                <Plus className="w-3.5 h-3.5" />
                添加会议
              </Button>
            </div>

            <div className="grid gap-2.5">
              {visibleConferences.map(conf => {
                const days = getDaysUntil(conf.deadline);
                const ddl = getDdlStyle(days);
                const ccf = CCF_STYLE[conf.ccf];
                return (
                  <Card key={conf.id} padding="sm" className="group">
                    <div className="flex items-center gap-4">
                      {/* CCF badge */}
                      <div
                        className="w-12 h-12 rounded-2xl flex flex-col items-center justify-center flex-shrink-0 text-[10px] font-bold leading-tight"
                        style={{ background: ccf.bg, color: ccf.color }}
                      >
                        <span>CCF</span>
                        <span className="text-base">{conf.ccf === "none" ? "—" : conf.ccf}</span>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm text-ink-primary truncate">{conf.name}</p>
                          <span
                            className="text-[10px] font-medium px-1.5 py-0.5 rounded-md flex-shrink-0"
                            style={{ background: "rgba(142,142,147,0.10)", color: "#8E8E93" }}
                          >
                            {conf.area}
                          </span>
                        </div>
                        <p className="text-xs text-ink-tertiary mt-0.5 truncate">{conf.fullName}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="flex items-center gap-1 text-[11px] text-ink-tertiary">
                            <Clock className="w-3 h-3" />
                            截止 {conf.deadline.toLocaleDateString("zh-CN")}
                          </span>
                          {conf.notificationDate && (
                            <span className="flex items-center gap-1 text-[11px] text-ink-tertiary">
                              <Bell className="w-3 h-3" />
                              通知 {conf.notificationDate.toLocaleDateString("zh-CN")}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* DDL countdown */}
                      <div
                        className="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold"
                        style={{ background: ddl.bg, color: ddl.color }}
                      >
                        {days < 0 ? "已截止" : `还剩 ${ddl.label}`}
                      </div>

                      {/* Star */}
                      <button
                        onClick={() => toggleStar(conf.id)}
                        className="flex-shrink-0 p-1.5 rounded-lg transition-all duration-150 hover:bg-black/5 opacity-0 group-hover:opacity-100"
                      >
                        {conf.starred
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
                <p className="text-xs text-ink-tertiary mt-0.5">邀请课题组成员，共同追踪会议截止日期，统一管理投稿节奏。</p>
              </div>
            </div>
          </div>
        )}

        {/* ════════ 投稿看板 ════════ */}
        {tab === "kanban" && (
          <div className="space-y-4 h-full">
            <div className="flex items-center justify-between">
              <p className="text-sm text-ink-tertiary">点击「推进 →」更新论文投稿进度</p>
              <Button variant="secondary" size="sm">
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
                          <p className="mt-1.5 text-[11px] text-ink-tertiary truncate">{sub.conference}</p>
                          {sub.deadline && key === "writing" && (
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
          <div className="space-y-4 max-w-2xl">
            {/* Progress card */}
            <Card padding="md">
              <div className="flex items-center justify-between mb-3">
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
              {progress === 100 && (
                <p className="mt-2 text-xs text-center font-medium" style={{ color: "#34C759" }}>
                  全部完成——可以安心投稿了！
                </p>
              )}
            </Card>

            {/* Category filter */}
            <div className="flex flex-wrap items-center gap-2">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setChecklistCat(cat)}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150"
                  style={checklistCat === cat
                    ? { background: "#007AFF", color: "#fff" }
                    : { background: "var(--rc-card-bg)", color: "var(--rc-text-secondary)" as string, boxShadow: "2px 2px 6px rgba(0,0,0,0.08), -1px -1px 4px rgba(255,255,255,0.6)" }
                  }
                >
                  {cat === "all" ? "全部" : cat}
                </button>
              ))}
              <button
                className="ml-auto text-xs text-ink-tertiary hover:text-ink-secondary transition-colors px-2 py-1"
                onClick={() => setChecklist(prev => prev.map(i => ({ ...i, checked: false })))}
              >
                重置
              </button>
            </div>

            {/* Items grouped by category */}
            {visibleCategories.map(cat => (
              <div key={cat}>
                <p className="text-[11px] font-semibold text-ink-tertiary uppercase tracking-widest mb-2 px-1">
                  {cat}
                </p>
                <div className="space-y-2">
                  {filteredChecklist
                    .filter(i => i.category === cat)
                    .map(item => (
                      <button
                        key={item.id}
                        onClick={() => toggleCheck(item.id)}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left transition-all duration-150"
                        style={item.checked
                          ? { background: "rgba(52,199,89,0.07)", boxShadow: "none" }
                          : { background: "var(--rc-card-bg)", boxShadow: "2px 2px 6px rgba(0,0,0,0.08), -1px -1px 4px rgba(255,255,255,0.6)" }
                        }
                      >
                        {item.checked
                          ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: "#34C759" }} />
                          : <Circle className="w-4 h-4 flex-shrink-0 text-ink-tertiary" />
                        }
                        <span
                          className="text-sm transition-all duration-150"
                          style={{
                            color: item.checked ? "#34C759" : "var(--rc-text-primary)" as string,
                            textDecoration: item.checked ? "line-through" : "none",
                            opacity: item.checked ? 0.65 : 1,
                          }}
                        >
                          {item.label}
                        </span>
                      </button>
                    ))}
                </div>
              </div>
            ))}

            {/* Collaboration placeholder */}
            <div
              className="rounded-3xl p-4 flex items-center gap-3 border-2 border-dashed opacity-50"
              style={{ borderColor: "var(--rc-border)" }}
            >
              <Users className="w-5 h-5 text-ink-tertiary flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-ink-secondary">团队协作清单（即将上线）</p>
                <p className="text-xs text-ink-tertiary mt-0.5">为每位共同作者分配清单项，追踪各自完成进度。</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
