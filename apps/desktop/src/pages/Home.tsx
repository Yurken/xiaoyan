import { useEffect, useState } from "react";
import { ArrowRight, Bell, BookOpen, FileText, Library, Loader2, Map, MessageSquare, Wrench } from "lucide-react";
import { Badge, Button, Card } from "@research-copilot/ui";
import {
  MAIN_ASSISTANT_NAME,
  MAIN_ASSISTANT_WORKSPACE_NAME,
  PRODUCT_NAME,
} from "@research-copilot/types";
import { Link } from "react-router-dom";
import { apiClient, submissionApi, formatErrorMessage } from "../lib/client";
import type { ChatSession, KnowledgeNote, Paper, ResearchInterest } from "@research-copilot/types";

interface DashboardState {
  papers: Paper[];
  interests: ResearchInterest[];
  notes: KnowledgeNote[];
  sessions: ChatSession[];
}

interface SubmissionStats {
  active: number;
  pendingReviews: number;
  upcomingDdls: { name: string; deadline: string }[];
}

const quickActions = [
  {
    to: "/planner",
    icon: Map,
    title: "规划研究方向",
    description: "把一个模糊想法拆成路线、论文清单和切入角度。",
    iconColor: "#007AFF",
    iconBg: "rgba(0,122,255,0.08)",
  },
  {
    to: "/survey",
    icon: BookOpen,
    title: "生成文献综述",
    description: "围绕问题快速检索、读摘要并组织成结构化综述。",
    iconColor: "#007AFF",
    iconBg: "rgba(0,122,255,0.08)",
  },
  {
    to: "/papers",
    icon: FileText,
    title: "导入论文",
    description: "上传 PDF 后直接进入精读、方法拆解和复现准备。",
    iconColor: "#8B5CF6",
    iconBg: "rgba(139,92,246,0.08)",
  },
  {
    to: "/xiaoyan",
    icon: MessageSquare,
    title: `和${MAIN_ASSISTANT_NAME}对话`,
    description: "遇到研究问题时直接发问，把论文带进对话里一起讨论。",
    iconColor: "#14B8A6",
    iconBg: "rgba(20,184,166,0.08)",
  },
  {
    to: "/tools",
    icon: Wrench,
    title: "科研工具箱",
    description: "检索、分区、翻译和友链工具都从这里进入。",
    iconColor: "#F97316",
    iconBg: "rgba(249,115,22,0.08)",
  },
];

export default function Home() {
  const [state, setState] = useState<DashboardState>({
    papers: [],
    interests: [],
    notes: [],
    sessions: [],
  });
  const [subStats, setSubStats] = useState<SubmissionStats>({ active: 0, pendingReviews: 0, upcomingDdls: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      apiClient.papers.list(0, 100),
      apiClient.knowledge.listInterests(),
      apiClient.knowledge.listNotes(),
      apiClient.chat.listSessions(),
      submissionApi.stats().catch(() => ({ active: 0, pendingReviews: 0, upcomingDdls: [] })),
    ])
      .then(([papers, interests, notes, sessions, stats]) => {
        if (!cancelled) {
          setState({ papers, interests, notes, sessions });
          setSubStats(stats as SubmissionStats);
          setLoading(false);
        }
      })
      .catch((nextError) => {
        if (!cancelled) {
          setError(formatErrorMessage(nextError));
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-apple-blue" />
        <p className="text-sm text-ink-tertiary">正在加载工作台...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full overflow-y-auto p-6">
        <Card className="flex flex-col gap-3 py-14 text-center">
          <p className="text-base font-semibold text-ink-primary">无法加载工作台</p>
          <p className="break-all text-sm text-apple-red">{error}</p>
        </Card>
      </div>
    );
  }

  const analyzedCount = state.papers.filter((paper) => paper.analysis).length;
  const plannedCount = state.interests.filter((interest) => interest.status === "planned").length;
  const heroMetrics = [
    { label: "论文库", value: state.papers.length, note: `${analyzedCount} 篇已分析`, color: "#007AFF" },
    { label: "研究方向", value: state.interests.length, note: `${plannedCount} 条已成路线`, color: "#8B5CF6" },
    { label: "知识笔记", value: state.notes.length, note: "支持语义检索", color: "#F97316" },
    { label: "对话沉淀", value: state.sessions.length, note: "会话会持续沉淀", color: "#14B8A6" },
  ];

  return (
    <div className="rc-page-scroll space-y-5">
      <Card padding="lg" className="relative overflow-hidden">
        <div
          className="absolute inset-x-7 top-0 h-px"
          style={{ background: "linear-gradient(90deg, transparent, rgb(var(--rc-border-rgb) / 0.88), transparent)" }}
        />
        <div className="grid gap-6 xl:grid-cols-[1.28fr_0.92fr]">
          <div className="space-y-6">
            <div className="space-y-3">
              <p className="rc-kicker">小妍研究工作台</p>
              <div className="space-y-3">
                <h1 className="max-w-2xl text-[clamp(2rem,3.2vw,3.3rem)] font-semibold tracking-[-0.05em] text-ink-primary">
                  {PRODUCT_NAME}
                </h1>
                <p className="max-w-2xl text-sm leading-7 text-ink-secondary">
                  从选题规划到文献调研，从论文精读到知识沉淀，{MAIN_ASSISTANT_NAME}把研究推进所需的动作收进同一张工作台里，让进展更连续、状态更可见。
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link to="/planner">
                <Button>
                  开始研究规划
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/xiaoyan">
                <Button variant="secondary">进入{MAIN_ASSISTANT_WORKSPACE_NAME}</Button>
              </Link>
            </div>

            <div className="space-y-3">
              <div className="rc-subtle-rule" />
              <div className="flex flex-wrap gap-2.5">
                <Badge variant="default">研究协作工作台</Badge>
                <Badge variant="info">结构化沉淀</Badge>
                {(subStats.active > 0 || subStats.pendingReviews > 0) && (
                  <Link to="/submission">
                    <Badge variant="purple">投稿流程已接入</Badge>
                  </Link>
                )}
              </div>
              {(subStats.active > 0 || subStats.pendingReviews > 0) ? (
                <div className="flex flex-wrap gap-2">
                  <Link
                    to="/submission"
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
                    style={{ background: "rgba(0,122,255,0.08)", color: "#007AFF" }}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    {subStats.active} 篇进行中
                  </Link>
                  {subStats.pendingReviews > 0 ? (
                    <Link
                      to="/submission"
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
                      style={{ background: "rgba(249,115,22,0.08)", color: "#F97316" }}
                    >
                      <Bell className="h-3.5 w-3.5" />
                      {subStats.pendingReviews} 条待回复审稿意见
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <div
            className="space-y-3 rounded-[28px] p-4"
            style={{
              background: "var(--rc-card-inset-bg)",
              border: "1px solid var(--rc-card-inset-outline)",
              boxShadow: "var(--rc-card-inset-shadow)",
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-ink-primary">研究进展</p>
                <p className="mt-0.5 text-xs text-ink-tertiary">当前工作台里沉淀下来的可追踪资产。</p>
              </div>
              <Badge variant="default">实时</Badge>
            </div>

            <div className="grid gap-3">
              {heroMetrics.map((item) => (
                <div
                  key={item.label}
                  className="rc-home-metric-item rounded-[22px] p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
                        <p className="text-xs font-medium text-ink-tertiary">{item.label}</p>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-ink-secondary">{item.note}</p>
                    </div>
                    <p className="text-2xl font-semibold tabular-nums text-ink-primary">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.06fr_0.94fr]">
        <Card padding="md" className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-base font-semibold text-ink-primary">下一步建议</p>
              <p className="mt-0.5 text-xs text-ink-tertiary">从一个入口开始，不用先想清全部流程。</p>
            </div>
          </div>
          <div className="grid gap-3">
            {quickActions.map(({ to, icon: Icon, title, description, iconColor, iconBg }) => (
              <Link key={to} to={to} className="group">
                <div
                  className="flex items-start gap-4 rounded-[24px] p-4 transition-all duration-150 group-hover:-translate-y-px"
                  style={{
                    background: "var(--rc-card-inset-bg)",
                    boxShadow: "var(--rc-card-inset-shadow)",
                    border: "1px solid var(--rc-card-inset-outline)",
                  }}
                >
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl" style={{ background: iconBg, color: iconColor }}>
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-ink-primary">{title}</p>
                        <p className="mt-1.5 text-xs leading-5 text-ink-secondary">{description}</p>
                      </div>
                      <ArrowRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-ink-tertiary transition-transform duration-150 group-hover:translate-x-0.5" />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </Card>

        <Card padding="md" className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-base font-semibold text-ink-primary">研究资产概览</p>
              <p className="mt-0.5 text-xs text-ink-tertiary">最近沉淀下来的主题、卡片和对话。</p>
            </div>
            <Link to="/knowledge" className="text-xs font-medium text-apple-blue hover:opacity-75 transition-opacity">
              查看知识库
            </Link>
          </div>

          <div className="grid gap-3">
            <div
              className="rounded-[24px] p-4"
              style={{
                background: "var(--rc-card-inset-bg)",
                boxShadow: "var(--rc-card-inset-shadow)",
                border: "1px solid var(--rc-card-inset-outline)",
              }}
            >
              <div className="mb-3 flex items-center gap-2">
                <Map className="h-3.5 w-3.5" style={{ color: "#8B5CF6" }} />
                <p className="text-sm font-semibold text-ink-primary">最近研究方向</p>
              </div>
              {state.interests.length === 0 ? (
                <p className="text-xs text-ink-tertiary">还没有研究方向，去规划页创建一个吧。</p>
              ) : (
                <div className="space-y-2">
                  {state.interests.slice(0, 3).map((interest) => (
                    <div key={interest.id} className="rc-home-asset-item flex items-center justify-between gap-3 rounded-2xl px-3 py-2">
                      <span className="truncate text-sm text-ink-secondary">{interest.topic}</span>
                      <Badge variant={interest.status === "planned" ? "success" : interest.status === "planning" ? "info" : "default"}>
                        {interest.status === "planned" ? "已规划" : interest.status === "planning" ? "处理中" : "待处理"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div
              className="rounded-[24px] p-4"
              style={{
                background: "var(--rc-card-inset-bg)",
                boxShadow: "var(--rc-card-inset-shadow)",
                border: "1px solid var(--rc-card-inset-outline)",
              }}
            >
              <div className="mb-3 flex items-center gap-2">
                <Library className="h-3.5 w-3.5 text-[#FF9500]" />
                <p className="text-sm font-semibold text-ink-primary">最近知识卡片</p>
              </div>
              {state.notes.length === 0 ? (
                <p className="text-xs text-ink-tertiary">读完论文或综述后，把重要内容保存为知识卡片，小妍会帮你做好语义检索。</p>
              ) : (
                <div className="space-y-2">
                  {state.notes.slice(0, 3).map((note) => (
                    <div key={note.id} className="rc-home-asset-item rounded-2xl px-3 py-2">
                      <p className="truncate text-sm font-medium text-ink-primary">{note.title}</p>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-ink-tertiary">{note.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div
              className="rounded-[24px] p-4"
              style={{
                background: "var(--rc-card-inset-bg)",
                boxShadow: "var(--rc-card-inset-shadow)",
                border: "1px solid var(--rc-card-inset-outline)",
              }}
            >
              <div className="mb-3 flex items-center gap-2">
                <MessageSquare className="h-3.5 w-3.5 text-[#34C759]" />
                <p className="text-sm font-semibold text-ink-primary">最近对话</p>
              </div>
              {state.sessions.length === 0 ? (
                <p className="text-xs text-ink-tertiary">有问题直接问小妍，带上论文一起讨论也可以。</p>
              ) : (
                <div className="space-y-2">
                  {state.sessions.slice(0, 3).map((session) => (
                    <div key={session.id} className="rc-home-asset-item rounded-2xl px-3 py-2">
                      <p className="truncate text-sm font-medium text-ink-primary">{session.title || "新对话"}</p>
                      <p className="mt-1 text-xs text-ink-tertiary">
                        {new Date(session.updated_at || session.created_at).toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
