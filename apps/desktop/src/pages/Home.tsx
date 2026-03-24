import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, FileText, Library, Loader2, MessageSquare, Sparkles, Wrench } from "lucide-react";
import { Badge, Button, Card } from "@research-copilot/ui";
import {
  MAIN_ASSISTANT_BADGE,
  MAIN_ASSISTANT_NAME,
  MAIN_ASSISTANT_WORKSPACE_NAME,
  PRODUCT_NAME,
} from "@research-copilot/types";
import { Link } from "react-router-dom";
import { apiClient, formatErrorMessage } from "../lib/client";
import type { ChatSession, KnowledgeNote, Paper, ResearchInterest } from "@research-copilot/types";

interface DashboardState {
  papers: Paper[];
  interests: ResearchInterest[];
  notes: KnowledgeNote[];
  sessions: ChatSession[];
}

const quickActions = [
  {
    to: "/planner",
    icon: Sparkles,
    title: "规划研究方向",
    description: "从研究主题生成学习路线、经典论文和潜在研究切口。",
    iconColor: "#AF52DE",
    iconBg: "rgba(175,82,222,0.1)",
  },
  {
    to: "/survey",
    icon: BookOpen,
    title: "生成文献综述",
    description: "从一个研究问题出发，小妍会帮你找文献、读摘要、整理成综述。",
    iconColor: "#007AFF",
    iconBg: "rgba(0,122,255,0.1)",
  },
  {
    to: "/papers",
    icon: FileText,
    title: "导入论文",
    description: "上传 PDF 做论文精读、方法拆解和复现指南生成。",
    iconColor: "#FF9500",
    iconBg: "rgba(255,149,0,0.1)",
  },
  {
    to: "/copilot",
    icon: MessageSquare,
    title: `和${MAIN_ASSISTANT_NAME}对话`,
    description: "有问题直接问，带着论文一起读也行。",
    iconColor: "#34C759",
    iconBg: "rgba(52,199,89,0.1)",
  },
  {
    to: "/tools",
    icon: Wrench,
    title: "查询 CCF",
    description: "输入期刊或会议名称，快速查看 CCF 评级与类别。",
    iconColor: "#FF3B30",
    iconBg: "rgba(255,59,48,0.1)",
  },
];

export default function Home() {
  const [state, setState] = useState<DashboardState>({
    papers: [],
    interests: [],
    notes: [],
    sessions: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      apiClient.papers.list(0, 100),
      apiClient.knowledge.listInterests(),
      apiClient.knowledge.listNotes(),
      apiClient.chat.listSessions(),
    ])
      .then(([papers, interests, notes, sessions]) => {
        if (!cancelled) {
          setState({
            papers,
            interests,
            notes,
            sessions,
          });
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
        <p className="text-sm text-ink-tertiary">正在加载工作台…</p>
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

  return (
    <div className="h-full overflow-y-auto p-6 space-y-5">
      <Card padding="lg" className="overflow-hidden">
        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
          <div className="space-y-4">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight text-ink-primary">{PRODUCT_NAME}</h1>
                {/* <Badge variant="info">{MAIN_ASSISTANT_BADGE}</Badge> */}
              </div>
              <p className="mt-2 text-sm leading-6 text-ink-secondary">
                选题、读文献、整理笔记——{MAIN_ASSISTANT_NAME}帮你把研究的每一步都连起来，进展自然就看得见。
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link to="/planner">
                <Button>
                  开始研究规划
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/copilot">
                <Button variant="secondary">进入{MAIN_ASSISTANT_WORKSPACE_NAME}</Button>
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: "论文库",       value: state.papers.length,    note: `${analyzedCount} 篇已分析`,  color: "#007AFF" },
              { label: "研究方向",     value: state.interests.length, note: `${plannedCount} 条已成路线`, color: "#AF52DE" },
              { label: "知识笔记",     value: state.notes.length,     note: "支持语义检索",              color: "#FF9500" },
              { label: "小妍对话", value: state.sessions.length,  note: "历史对话随时翻", color: "#34C759" },
            ].map((item) => (
              <div key={item.label} className="rounded-3xl p-4 relative overflow-hidden" style={{ background: "rgba(255,255,255,0.5)", boxShadow: "inset 2px 2px 5px #D0D6DC, inset -2px -2px 5px #FFFFFF" }}>
                <div className="absolute top-0 left-4 right-4 h-[2px] rounded-full" style={{ background: item.color, opacity: 0.55 }} />
                <p className="text-[11px] font-medium text-ink-tertiary mt-1">{item.label}</p>
                <p className="mt-1.5 text-3xl font-bold tabular-nums" style={{ color: item.color }}>{item.value}</p>
                <p className="mt-1 text-[11px] text-ink-tertiary">{item.note}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card padding="md" className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-lg font-semibold text-ink-primary">下一步建议</p>
              <p className="mt-1 text-xs text-ink-tertiary">从这里开始，选一件最近想做的事。</p>
            </div>
            {/* <Badge variant="info">高优先级</Badge> */}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {quickActions.map(({ to, icon: Icon, title, description, iconColor, iconBg }) => (
              <Link key={to} to={to} className="group">
                <div className="rounded-3xl border border-nm-dark/8 bg-white/50 p-4 transition-all duration-150 group-hover:-translate-y-px group-hover:shadow-nm-sm">
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: iconBg, color: iconColor }}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className="text-sm font-semibold text-ink-primary">{title}</p>
                  <p className="mt-1.5 text-xs leading-5 text-ink-secondary">{description}</p>
                </div>
              </Link>
            ))}
          </div>
        </Card>

        <Card padding="md" className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-lg font-semibold text-ink-primary">研究资产概览</p>
              <p className="mt-1 text-xs text-ink-tertiary">最近的研究进展。</p>
            </div>
            <Link to="/knowledge" className="text-xs font-medium text-apple-blue">
              查看知识库
            </Link>
          </div>

          <div className="grid gap-3">
            <div className="rounded-2xl bg-white/50 p-3 overflow-hidden" style={{ borderLeft: "3px solid #AF52DE", border: "1px solid rgba(175,82,222,0.15)", borderLeftWidth: "3px" }}>
              <div className="mb-2 flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5" style={{ color: "#AF52DE" }} />
                <p className="text-sm font-semibold text-ink-primary">最近研究方向</p>
              </div>
              {state.interests.length === 0 ? (
                <p className="text-xs text-ink-tertiary">还没有研究方向，去规划页新建一个吧。</p>
              ) : (
                <div className="space-y-2">
                  {state.interests.slice(0, 3).map((interest) => (
                    <div key={interest.id} className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm text-ink-secondary">{interest.topic}</span>
                      <Badge variant={interest.status === "planned" ? "success" : interest.status === "planning" ? "info" : "default"}>
                        {interest.status === "planned" ? "已规划" : interest.status === "planning" ? "处理中" : "待处理"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl bg-white/50 p-3 overflow-hidden" style={{ border: "1px solid rgba(255,149,0,0.15)", borderLeftWidth: "3px", borderLeftColor: "#FF9500" }}>
              <div className="mb-2 flex items-center gap-2">
                <Library className="h-3.5 w-3.5 text-[#FF9500]" />
                <p className="text-sm font-semibold text-ink-primary">最近知识卡片</p>
              </div>
              {state.notes.length === 0 ? (
                <p className="text-xs text-ink-tertiary">读完论文或综述后，把重要内容保存为知识卡片。</p>
              ) : (
                <div className="space-y-2">
                  {state.notes.slice(0, 3).map((note) => (
                    <div key={note.id}>
                      <p className="truncate text-sm font-medium text-ink-primary">{note.title}</p>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-ink-tertiary">{note.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl bg-white/50 p-3 overflow-hidden" style={{ border: "1px solid rgba(52,199,89,0.15)", borderLeftWidth: "3px", borderLeftColor: "#34C759" }}>
              <div className="mb-2 flex items-center gap-2">
                <MessageSquare className="h-3.5 w-3.5 text-[#34C759]" />
                <p className="text-sm font-semibold text-ink-primary">最近对话</p>
              </div>
              {state.sessions.length === 0 ? (
                <p className="text-xs text-ink-tertiary">有问题直接问小妍，带着论文一起读也行。</p>
              ) : (
                <div className="space-y-2">
                  {state.sessions.slice(0, 3).map((session) => (
                    <div key={session.id}>
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
