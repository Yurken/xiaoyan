import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  FileText,
  Library,
  Loader2,
  MessageSquare,
  Microscope,
  Plus,
  Send,
  Settings as SettingsIcon,
  Sparkles,
  Wrench,
  X,
} from "lucide-react";
import { Badge, Button } from "@research-copilot/ui";
import { apiClient, formatErrorMessage } from "../lib/client";
import type { ResearchInterest } from "@research-copilot/types";
import { listen } from "@tauri-apps/api/event";
import PlannerComposer from "../features/knowledge/PlannerComposer";
import ResearchWorkbench, { type InterestTab } from "../features/knowledge/ResearchWorkbench";
import {
  applyInterestPlanSnapshots,
  useInterestPlanSnapshots,
} from "../features/knowledge/useInterestPlanRuns";
import MacWindowDragStrip from "../components/MacWindowDragStrip";
import {
  IS_MACOS_DESKTOP,
  MACOS_WINDOW_DRAG_HEIGHT,
} from "../lib/windowChrome";
import Survey from "./Survey";
import Planner from "./Planner";
import Papers from "./Papers";
import Knowledge from "./Knowledge";
import Copilot from "./Copilot";
import Tools from "./Tools";
import Settings from "./Settings";
import Experiment from "./Experiment";
import Submission from "./Submission";
import Writing from "./Writing";

// ─── Focus Home ──────────────────────────────────────────────────────────────

function InterestCard({
  interest,
  onEnter,
}: {
  interest: ResearchInterest;
  onEnter: () => void;
}) {
  const statusLabel =
    interest.status === "planned"
      ? "已规划"
      : interest.status === "planning"
        ? "生成中"
        : "待规划";
  const statusVariant =
    interest.status === "planned"
      ? "success"
      : interest.status === "planning"
        ? "info"
        : "default";

  return (
    <div
      className="rounded-[28px] p-5 flex items-center justify-between gap-4"
      style={{
        background: "var(--rc-surface)",
        boxShadow: "var(--rc-card-shadow)",
      }}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <Microscope className="w-4 h-4 text-apple-blue flex-shrink-0" />
          <p className="text-sm font-semibold text-ink-primary truncate">
            {interest.folder_name?.trim() || interest.topic}
          </p>
        </div>
        {interest.keywords && interest.keywords.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 pl-6 mt-1.5">
            {interest.keywords.slice(0, 6).map((kw) => (
              <span
                key={kw}
                className="rc-accent-chip rounded-full px-2 py-0.5 text-[11px]"
              >
                {kw}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-ink-tertiary truncate pl-6 mt-0.5">{interest.topic}</p>
        )}
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <Badge variant={statusVariant}>{statusLabel}</Badge>
        <button
          type="button"
          onClick={onEnter}
          className="flex items-center gap-1.5 px-4 py-2 rounded-2xl text-sm font-semibold text-white transition-all duration-150 active:scale-95"
          style={{
            background: "linear-gradient(145deg, #1A8AFF, #0062CC)",
            boxShadow: "3px 3px 8px rgba(0,62,204,0.35), -2px -2px 6px rgba(58,155,255,0.2)",
          }}
        >
          工作台
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function FreeTopicCard({ onEnter }: { onEnter: () => void }) {
  return (
    <div
      className="rounded-[28px] p-5 flex items-center justify-between gap-4"
      style={{
        background: "var(--rc-surface)",
        boxShadow: "var(--rc-card-shadow)",
      }}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-ink-tertiary flex-shrink-0" />
          <p className="text-sm font-semibold text-ink-secondary">自由主题</p>
        </div>
        <p className="text-xs text-ink-tertiary pl-6">未分类的对话和论文</p>
      </div>
      <button
        type="button"
        onClick={onEnter}
        className="flex items-center gap-1.5 px-4 py-2 rounded-2xl text-sm font-medium transition-all duration-150 active:scale-95 flex-shrink-0"
        style={{
          background: "var(--rc-surface)",
          color: "var(--rc-text-soft)",
          boxShadow: "var(--rc-chip-shadow)",
        }}
      >
        工作台
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

function FocusHome() {
  const navigate = useNavigate();
  const [interests, setInterests] = useState<ResearchInterest[]>([]);
  const planSnapshots = useInterestPlanSnapshots();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [wizardTopic, setWizardTopic] = useState("");
  const visibleInterests = useMemo(
    () => applyInterestPlanSnapshots(interests, planSnapshots),
    [interests, planSnapshots]
  );

  const load = () => {
    setLoading(true);
    apiClient.knowledge.listInterests()
      .then((data) => {
        setInterests(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(formatErrorMessage(err));
        setLoading(false);
      });
  };

  useEffect(() => {
    load();

    const unlistenPlan = listen<{ id: string }>("interest:plan", () => {
      load();
    });
    return () => {
      void unlistenPlan.then((cleanup) => cleanup());
    };
  }, []);

  return (
    <div className="h-full flex flex-col bg-nm-bg">
      {/* Header */}
      <div
        className="flex-shrink-0"
        style={{
          background: "var(--rc-header-bg)",
          boxShadow: "0 2px 10px rgba(0,0,0,0.12)",
          borderBottom: "1px solid var(--rc-border)",
        }}
      >
        <MacWindowDragStrip style={{ height: `${MACOS_WINDOW_DRAG_HEIGHT}px` }} />
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="mx-auto max-w-4xl p-6 space-y-5">
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-2 text-ink-tertiary">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">加载中…</span>
          </div>
        ) : error ? (
          <div className="text-sm text-apple-red py-10 text-center">{error}</div>
        ) : (
          <>
            {/* ── 规划入口（研究主题上方） ── */}
            <div
              className="rounded-[28px] overflow-hidden"
              style={{ background: "var(--rc-surface)", boxShadow: "var(--rc-card-shadow)" }}
            >
              {/* 收起态：标题 + 操作按钮 */}
              {!creating && !discovering && (
                <div className="flex items-center justify-between gap-4 px-5 py-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink-primary">研究路线设计器</p>
                    <p className="text-xs text-ink-tertiary mt-0.5 truncate">
                      把研究主题转成阶段化学习路线、经典论文和潜在切入方向。
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => setDiscovering(true)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-medium transition-all duration-150"
                      style={{ background: "var(--rc-surface)", color: "var(--rc-text-soft)", boxShadow: "var(--rc-chip-shadow)" }}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      没想好要做什么？
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreating(true)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-semibold text-white transition-all duration-150 active:scale-95"
                      style={{
                        background: "linear-gradient(145deg, #1A8AFF, #0062CC)",
                        boxShadow: "3px 3px 8px rgba(0,62,204,0.35), -2px -2px 6px rgba(58,155,255,0.2)",
                      }}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      添加研究主题
                    </button>
                  </div>
                </div>
              )}

              {/* 展开态：PlannerComposer */}
              {creating && (
                <div className="p-5">
                  <PlannerComposer
                    initialTopic={wizardTopic || undefined}
                    onCancel={() => { setCreating(false); setWizardTopic(""); }}
                    onCreated={(interest) => {
                      setInterests((prev) => [interest, ...prev]);
                      setCreating(false);
                      setWizardTopic("");
                    }}
                  />
                </div>
              )}

              {/* 展开态：发现向导 */}
              {discovering && (
                <div className="p-5">
                  {/* inline TopicDiscoveryWizard via dynamic import would work, but we reuse the navigate pattern */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-ink-primary">帮我找研究主题</p>
                      <button
                        type="button"
                        onClick={() => setDiscovering(false)}
                        className="text-ink-tertiary hover:text-ink-primary"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-xs text-ink-tertiary leading-5">
                      回答几个问题，小妍帮你找到适合你的研究切入点。
                    </p>
                    <button
                      type="button"
                      onClick={() => { setDiscovering(false); setCreating(true); }}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm font-medium transition-all"
                      style={{
                        background: "linear-gradient(145deg, #1A8AFF, #0062CC)",
                        color: "#fff",
                        boxShadow: "3px 3px 8px rgba(0,62,204,0.35)",
                      }}
                    >
                      <Sparkles className="w-4 h-4" />
                      前往完整向导
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ── 研究主题列表 ── */}
            <div className="flex items-center justify-between px-1 pt-1">
              <p className="text-sm font-semibold text-ink-primary">研究主题</p>
              <p className="text-xs text-ink-tertiary">
                {visibleInterests.length > 0 ? `共 ${visibleInterests.length} 个` : ""}
              </p>
            </div>

            {visibleInterests.length === 0 ? (
              <div
                className="rounded-[28px] p-10 text-center"
                style={{ background: "var(--rc-surface)", boxShadow: "var(--rc-inset-shadow)" }}
              >
                <Microscope className="w-10 h-10 text-ink-tertiary mx-auto mb-3" />
                <p className="text-sm font-semibold text-ink-primary">还没有研究主题</p>
                <p className="text-xs text-ink-tertiary mt-2 leading-5">
                  点击「添加研究主题」，小妍帮你整理路线和文献。
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {visibleInterests.map((interest) => (
                  <InterestCard
                    key={interest.id}
                    interest={interest}
                    onEnter={() => navigate(`/workbench/${interest.id}`)}
                  />
                ))}
              </div>
            )}

            {/* 自由主题入口 */}
            <div className="pt-1">
              <FreeTopicCard onEnter={() => navigate("/workbench/free")} />
            </div>
          </>
        )}
        </div>
      </div>
    </div>
  );
}

// ─── Focus Workbench ─────────────────────────────────────────────────────────

type FreeTab = "survey" | "papers" | "knowledge" | "xiaoyan" | "tools" | "experiment" | "submission";

type LegacyFreeTab = FreeTab | "copilot";

const FREE_TABS: Array<{ key: FreeTab; label: string; icon: typeof Sparkles }> = [
  { key: "survey",    label: "综述",    icon: BookOpen },
  { key: "papers",    label: "论文",    icon: FileText },
  { key: "knowledge", label: "知识",    icon: Library },
  { key: "xiaoyan",   label: "小妍",    icon: MessageSquare },
  { key: "experiment", label: "实验",   icon: Microscope },
  { key: "submission", label: "投稿",   icon: Send },
  { key: "tools",     label: "工具",    icon: Wrench },
];

function isFreeTab(value?: string): value is FreeTab {
  return FREE_TABS.some((item) => item.key === value);
}

function normalizeFreeTab(value?: string): FreeTab {
  if (value === "copilot") return "xiaoyan";
  return isFreeTab(value) ? value : "survey";
}

const BASE_INTEREST_TABS: Array<{ key: InterestTab; label: string; icon: typeof Sparkles }> = [
  { key: "overview", label: "总览", icon: Microscope },
  { key: "papers",  label: "论文", icon: FileText },
  { key: "xiaoyan", label: "小妍", icon: MessageSquare },
  { key: "notes",   label: "笔记", icon: Library },
  { key: "experiment", label: "实验", icon: Microscope },
  { key: "submission", label: "投稿", icon: Send },
  { key: "tools",   label: "工具", icon: Wrench },
];

const PLANNER_TAB: { key: InterestTab; label: string; icon: typeof Sparkles } =
  { key: "planner", label: "规划", icon: Sparkles };

const INTEREST_TAB_KEYS: readonly InterestTab[] = ["overview", "planner", "papers", "xiaoyan", "notes", "tools", "experiment", "submission"];

function isInterestTab(value?: string): value is InterestTab {
  return INTEREST_TAB_KEYS.includes(value as InterestTab);
}

function normalizeInterestTab(value: string | undefined, planned: boolean): InterestTab {
  if (isInterestTab(value) && (value !== "planner" || planned)) {
    return value;
  }
  return "overview";
}

function TabButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof Sparkles;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150"
      style={
        active
          ? {
              background: "linear-gradient(145deg, #1A8AFF, #0062CC)",
              color: "#FFFFFF",
              boxShadow: "3px 3px 8px rgba(0,62,204,0.35), -2px -2px 6px rgba(58,155,255,0.2)",
            }
          : { background: "transparent", color: "#8E8E93" }
      }
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

function StatChip({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs"
      style={{ background: "var(--rc-chip-inset-bg)", boxShadow: "var(--rc-chip-inset-shadow)" }}
    >
      <span className="text-ink-tertiary">{label}</span>
      <span className="font-semibold text-ink-primary">{value}</span>
    </div>
  );
}

function FocusWorkbench() {
  const { interestId, tab } = useParams<{ interestId: string; tab?: string }>();
  const navigate = useNavigate();
  const [interest, setInterest] = useState<ResearchInterest | null>(null);
  const planSnapshots = useInterestPlanSnapshots();
  const [loadingInterest, setLoadingInterest] = useState(false);
  const [interestError, setInterestError] = useState("");
  const [interestTab, setInterestTab] = useState<InterestTab>("papers");
  const [stats, setStats] = useState({ papers: 0, sessions: 0, notes: 0 });
  const isFree = interestId === "free";
  const freeTab = normalizeFreeTab(tab);
  const visibleInterest = useMemo(
    () => interest ? applyInterestPlanSnapshots([interest], planSnapshots)[0] : null,
    [interest, planSnapshots]
  );

  const interestTabs = visibleInterest?.status === "planned"
    ? [PLANNER_TAB, ...BASE_INTEREST_TABS]
    : BASE_INTEREST_TABS;

  useEffect(() => {
    if (isFree) {
      setInterest(null);
      setLoadingInterest(false);
      setInterestError("");
      return;
    }
    if (!interestId) return;

    let cancelled = false;
    setLoadingInterest(true);
    setInterest(null);
    setInterestError("");

    apiClient.knowledge.listInterests()
      .then((list) => {
        if (cancelled) return;
        const found = list.find((item) => item.id === interestId);
        if (found) {
          setInterest(found);
          setInterestTab("overview");
          return;
        }
        setInterestError("未找到该研究主题，可能已被删除。");
      })
      .catch((error) => { if (!cancelled) setInterestError(formatErrorMessage(error)); })
      .finally(() => { if (!cancelled) setLoadingInterest(false); });

    return () => { cancelled = true; };
  }, [interestId, isFree]);

  useEffect(() => {
    if (isFree || !visibleInterest || !interestId) return;
    const nextTab = normalizeInterestTab(tab, visibleInterest.status === "planned");
    if (nextTab !== interestTab) {
      setInterestTab(nextTab);
    }
    if (tab !== nextTab) {
      navigate(`/workbench/${interestId}/${nextTab}`, { replace: true });
    }
  }, [visibleInterest, interestId, interestTab, isFree, navigate, tab]);

  const title = isFree
    ? "自由主题"
    : visibleInterest?.folder_name?.trim() || visibleInterest?.topic || "研究主题";

  const FreePage = (() => {
    switch (freeTab) {
      case "survey":    return <Survey hideFolders />;
      case "papers":    return <Papers hideFolders />;
      case "knowledge": return <Knowledge hideFolders />;
      case "xiaoyan":   return <Copilot hideFolders />;
      case "experiment": return <Experiment />;
      case "submission": return <Submission />;
      case "tools":     return <Tools />;
    }
  })();

  return (
    <div className="flex flex-col h-full bg-nm-bg">
      {/* ── 合并头部 ── */}
      <div
        className="flex-shrink-0"
        style={{
          background: "var(--rc-header-bg)",
          boxShadow: "0 2px 10px rgba(0,0,0,0.12)",
          borderBottom: "1px solid var(--rc-border)",
        }}
      >
        <MacWindowDragStrip style={{ height: `${MACOS_WINDOW_DRAG_HEIGHT}px` }} />
        <div
          className="flex items-center gap-2 px-4 min-h-12"
          style={{
            paddingBottom: IS_MACOS_DESKTOP ? "10px" : undefined,
          }}
        >
        {/* 返回 */}
        <button
          type="button"
          onClick={() => navigate("/")}
          className="w-8 h-8 flex-shrink-0 rounded-xl flex items-center justify-center"
          style={{ background: "var(--rc-chip-inset-bg)", boxShadow: "var(--rc-chip-inset-shadow)", color: "#007AFF" }}
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        {/* 标题 */}
        <p className="text-sm font-semibold text-ink-primary truncate flex-shrink min-w-0 max-w-[200px]">{title}</p>

        {/* 统计（仅具体主题） */}
        {!isFree && visibleInterest && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <StatChip label="论文" value={stats.papers} />
            <StatChip label="会话" value={stats.sessions} />
            <StatChip label="笔记" value={stats.notes} />
          </div>
        )}

        <div className="flex-1" />

        {/* 标签切换 */}
        {isFree ? (
          <div className="flex items-center gap-0.5">
            {FREE_TABS.map(({ key, label, icon }) => (
              <TabButton
                key={key}
                active={freeTab === key}
                icon={icon}
                label={label}
                onClick={() => navigate(`/workbench/free/${key}`)}
              />
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-0.5">
            {interestTabs.map(({ key, label, icon }) => (
              <TabButton
                key={key}
                active={interestTab === key}
                icon={icon}
                label={label}
                onClick={() => {
                  setInterestTab(key);
                  navigate(`/workbench/${interestId}/${key}`);
                }}
              />
            ))}
          </div>
        )}

        {/* 自由主题入口（仅具体主题工作台显示） */}
        {!isFree && (
          <button
            type="button"
            onClick={() => navigate("/workbench/free/survey")}
            className="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium ml-1"
            style={{ background: "var(--rc-surface)", color: "var(--rc-text-soft)", boxShadow: "var(--rc-chip-shadow)" }}
          >
            自由主题
          </button>
        )}
        </div>
      </div>

      {/* ── 内容区 ── */}
      <div className="flex-1 min-h-0 overflow-hidden pt-2">
        {isFree ? (
          FreePage
        ) : loadingInterest ? (
          <div className="flex h-full items-center justify-center gap-2 text-ink-tertiary">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">加载主题工作台…</span>
          </div>
        ) : interestError ? (
          <div className="flex h-full items-center justify-center p-6">
            <div
              className="w-full max-w-md rounded-[28px] p-6 text-center"
              style={{ background: "var(--rc-surface)", boxShadow: "var(--rc-card-shadow)" }}
            >
              <p className="text-sm font-semibold text-ink-primary">无法打开主题工作台</p>
              <p className="mt-2 text-xs leading-6 text-apple-red break-all">{interestError}</p>
              <Button className="mt-4" onClick={() => navigate("/")}>返回主题列表</Button>
            </div>
          </div>
        ) : visibleInterest ? (
          <ResearchWorkbench
            interest={visibleInterest}
            activeTab={interestTab}
            onStats={(p, s, n) => setStats({ papers: p, sessions: s, notes: n })}
          />
        ) : null}
      </div>
    </div>
  );
}

// ─── Focus Settings Wrapper ───────────────────────────────────────────────────

function FocusSettingsWrapper() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col h-full">
      <div
        className="flex-shrink-0"
        style={{
          background: "var(--rc-header-bg)",
          boxShadow: "0 2px 10px rgba(0,0,0,0.12)",
          borderBottom: "1px solid var(--rc-border)",
        }}
      >
        <MacWindowDragStrip style={{ height: `${MACOS_WINDOW_DRAG_HEIGHT}px` }} />
        <div
          className="flex items-center gap-3 px-4 min-h-12"
          style={{
            paddingBottom: IS_MACOS_DESKTOP ? "10px" : undefined,
          }}
        >
        <button
          type="button"
          onClick={() => navigate("/")}
          className="w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-150"
          style={{
            background: "var(--rc-surface)",
            boxShadow: "var(--rc-chip-shadow)",
            color: "#007AFF",
          }}
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        <Settings />
      </div>
    </div>
  );
}

function FocusLegacyRouteRedirect({ tab }: { tab: LegacyFreeTab }) {
  const normalized = tab === "copilot" ? "xiaoyan" : tab;
  return <Navigate to={`/workbench/free/${normalized}`} replace />;
}

// ─── Focus App (top-level) ────────────────────────────────────────────────────

export default function FocusApp() {
  return (
    <div className="flex h-full bg-nm-bg">
      <main className="flex-1 min-w-0 overflow-hidden">
        <Routes>
          <Route path="/" element={<FocusHome />} />
          <Route path="/workbench/:interestId" element={<FocusWorkbench />} />
          <Route path="/workbench/:interestId/:tab" element={<FocusWorkbench />} />
          <Route path="/planner" element={<Planner />} />
          <Route path="/survey" element={<FocusLegacyRouteRedirect tab="survey" />} />
          <Route path="/papers" element={<FocusLegacyRouteRedirect tab="papers" />} />
          <Route path="/writing" element={<Writing />} />
          <Route path="/knowledge" element={<FocusLegacyRouteRedirect tab="knowledge" />} />
          <Route path="/xiaoyan" element={<FocusLegacyRouteRedirect tab="xiaoyan" />} />
          <Route path="/copilot" element={<FocusLegacyRouteRedirect tab="copilot" />} />
          <Route path="/tools" element={<FocusLegacyRouteRedirect tab="tools" />} />
          <Route path="/experiment" element={<Experiment />} />
          <Route path="/submission" element={<Submission />} />
          <Route path="/settings" element={<FocusSettingsWrapper />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Link to="/settings" className="fixed bottom-5 left-5 z-50">
        <button
          type="button"
          className="w-9 h-9 rounded-2xl flex items-center justify-center transition-all duration-150 text-[#8E8E93] hover:text-ink-primary"
          style={{
            background: "var(--rc-surface)",
            boxShadow: "var(--rc-chip-shadow)",
          }}
        >
          <SettingsIcon className="w-4.5 h-4.5" />
        </button>
      </Link>
    </div>
  );
}
