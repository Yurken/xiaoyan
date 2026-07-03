import type { ReactNode } from "react";
import { BookOpenCheck, FileText, FlaskConical, MessageSquare, Route, StickyNote } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge, Button } from "@research-copilot/ui";
import type { ChatSession, KnowledgeNote, Paper, ResearchInterest } from "@research-copilot/types";
import {
  type ResearchOverviewCheckpoint,
  useResearchInterestOverview,
} from "./useResearchInterestOverview";

interface ResearchOverviewPanelProps {
  interest: ResearchInterest;
  papers: Paper[];
  notes: KnowledgeNote[];
  sessions: ChatSession[];
}

interface NextAction {
  title: string;
  description: string;
  label: string;
  to: string;
  tone: "blue" | "green" | "amber" | "rust";
}

function surfaceStyle(variant: "plain" | "soft" = "plain") {
  return {
    background: variant === "plain" ? "rgb(var(--rc-bg-rgb) / 0.2)" : "var(--rc-card-inset-bg)",
    border: "1px solid var(--rc-card-inset-outline)",
    boxShadow: variant === "plain" ? "var(--rc-card-flat-shadow)" : "var(--rc-card-inset-shadow)",
  };
}

function formatDate(value?: string | null): string {
  if (!value) return "时间待定";
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "时间待定";
  return new Date(timestamp).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function shortText(value: string, max = 110): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max)}…`;
}

function interestTitle(interest: ResearchInterest): string {
  return interest.folder_name?.trim() || interest.topic;
}

function statusBadge(interest: ResearchInterest) {
  if (interest.status === "planned") return <Badge variant="success">路线已成形</Badge>;
  if (interest.status === "planning") return <Badge variant="info">路线生成中</Badge>;
  return <Badge variant="default">待规划</Badge>;
}

function buildNextAction(
  interest: ResearchInterest,
  papers: Paper[],
  notes: KnowledgeNote[],
  checkpoints: ResearchOverviewCheckpoint[],
): NextAction {
  const latestCheckpoint = checkpoints[0];
  const checkpointText =
    latestCheckpoint?.nextSteps[0] ||
    latestCheckpoint?.openQuestions[0] ||
    latestCheckpoint?.summary;
  if (checkpointText) {
    return {
      title: "接上小妍留下的续接点",
      description: shortText(checkpointText),
      label: "继续对话",
      to: `/workbench/${interest.id}/chat`,
      tone: latestCheckpoint.status === "failed" ? "rust" : "blue",
    };
  }

  if (interest.status !== "planned") {
    return {
      title: "先补齐研究路线",
      description: "当前主题还没有稳定路线，先让小妍把目标、阶段和代表论文整理出来。",
      label: "去规划",
      to: "/planner",
      tone: "amber",
    };
  }

  if (papers.length === 0) {
    return {
      title: "导入第一篇核心论文",
      description: "主题已经成形，但还没有论文作为证据起点。",
      label: "去论文",
      to: `/workbench/${interest.id}/papers`,
      tone: "amber",
    };
  }

  if (!papers.some((paper) => Boolean(paper.analysis))) {
    return {
      title: "先完成首篇论文解读",
      description: "已有论文入库，下一步把方法、结论和局限解读出来。",
      label: "去解读",
      to: `/workbench/${interest.id}/papers`,
      tone: "blue",
    };
  }

  if (notes.length === 0) {
    return {
      title: "沉淀第一条知识卡片",
      description: "已有论文解读，先把关键结论和证据从对话里固定下来。",
      label: "去笔记",
      to: `/workbench/${interest.id}/knowledge`,
      tone: "green",
    };
  }

  return {
    title: "继续收敛问题与证据",
    description: "论文、笔记和对话已经接起来，可以继续推进实验、写作或投稿准备。",
    label: "继续对话",
    to: `/workbench/${interest.id}/chat`,
    tone: "blue",
  };
}

function StatTile({
  icon,
  label,
  value,
  note,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-2xl p-3" style={surfaceStyle("soft")}>
      <div className="flex items-center gap-2 text-ink-tertiary">
        {icon}
        <p className="text-[11px] font-medium">{label}</p>
      </div>
      <p className="mt-2 text-xl font-semibold leading-7 text-ink-primary">{value}</p>
      <p className="mt-1 line-clamp-2 text-xs leading-5 text-ink-secondary">{note}</p>
    </div>
  );
}

function MiniList({
  title,
  items,
  empty,
}: {
  title: string;
  items: Array<{ id: string; title: string; meta: string }>;
  empty: string;
}) {
  return (
    <section className="rounded-2xl p-3" style={surfaceStyle()}>
      <h3 className="text-sm font-semibold text-ink-primary">{title}</h3>
      <div className="mt-3 grid gap-2">
        {items.length > 0 ? items.slice(0, 3).map((item) => (
          <div key={item.id} className="rounded-xl px-3 py-2" style={surfaceStyle("soft")}>
            <p className="truncate text-xs font-semibold text-ink-primary">{item.title}</p>
            <p className="mt-1 text-[11px] text-ink-tertiary">{item.meta}</p>
          </div>
        )) : (
          <p className="rounded-xl px-3 py-4 text-center text-xs text-ink-tertiary" style={surfaceStyle("soft")}>
            {empty}
          </p>
        )}
      </div>
    </section>
  );
}

export default function ResearchOverviewPanel({
  interest,
  papers,
  notes,
  sessions,
}: ResearchOverviewPanelProps) {
  const overview = useResearchInterestOverview(interest.id);
  const analyzedCount = papers.filter((paper) => Boolean(paper.analysis)).length;
  const stages = interest.learning_path?.learning_stages ?? [];
  const nextAction = buildNextAction(interest, papers, notes, overview.checkpoints);
  const linkedSubmissionCount = overview.submissions.length;

  return (
    <div className="flex-1 overflow-y-auto p-5">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
        <section className="rounded-3xl p-4" style={surfaceStyle()}>
          <div className="flex flex-wrap items-center gap-2">
            <Route className="h-4 w-4 text-apple-blue" />
            <p className="text-sm font-semibold text-ink-primary">{interestTitle(interest)}</p>
            {statusBadge(interest)}
          </div>
          <p className="mt-3 text-sm leading-6 text-ink-secondary">
            {interest.learning_path?.overview || interest.profile?.goal || interest.topic}
          </p>
          {interest.keywords?.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {interest.keywords.slice(0, 8).map((keyword) => (
                <span key={keyword} className="rc-accent-chip rounded-full px-2 py-0.5 text-[11px]">
                  {keyword}
                </span>
              ))}
            </div>
          ) : null}
        </section>

        <section className="rounded-3xl p-4" style={surfaceStyle()}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-ink-tertiary">下一步</p>
              <h3 className="mt-2 text-base font-semibold text-ink-primary">{nextAction.title}</h3>
            </div>
            <Badge variant={nextAction.tone === "rust" ? "danger" : nextAction.tone === "amber" ? "warning" : "info"}>
              {nextAction.tone === "rust" ? "需处理" : "可继续"}
            </Badge>
          </div>
          <p className="mt-3 text-sm leading-6 text-ink-secondary">{nextAction.description}</p>
          <Link to={nextAction.to} className="mt-4 inline-flex">
            <Button size="sm">
              {nextAction.label}
            </Button>
          </Link>
        </section>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={<FileText className="h-4 w-4" />}
          label="论文"
          value={String(papers.length)}
          note={`${analyzedCount} 篇已有解读`}
        />
        <StatTile
          icon={<StickyNote className="h-4 w-4" />}
          label="笔记"
          value={String(notes.length)}
          note="主题知识沉淀"
        />
        <StatTile
          icon={<MessageSquare className="h-4 w-4" />}
          label="会话"
          value={String(sessions.length)}
          note={`${overview.checkpoints.length} 个 checkpoint`}
        />
        <StatTile
          icon={<FlaskConical className="h-4 w-4" />}
          label="证据链"
          value={String(overview.claims.length + overview.experiments.length)}
          note={`${linkedSubmissionCount} 个关联投稿`}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl p-3" style={surfaceStyle()}>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-ink-primary">路线阶段</h3>
            <Link to={`/workbench/${interest.id}/planner`} className="text-xs font-medium text-apple-blue">
              看规划
            </Link>
          </div>
          <div className="mt-3 grid gap-2">
            {stages.length > 0 ? stages.slice(0, 4).map((stage) => (
              <div key={`${stage.stage}-${stage.title}`} className="rounded-xl px-3 py-2" style={surfaceStyle("soft")}>
                <p className="text-xs font-semibold text-ink-primary">
                  {stage.stage}. {stage.title}
                </p>
                <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-ink-secondary">
                  {stage.goals?.join("；") || stage.duration}
                </p>
              </div>
            )) : (
              <p className="rounded-xl px-3 py-4 text-center text-xs text-ink-tertiary" style={surfaceStyle("soft")}>
                暂无路线阶段。
              </p>
            )}
          </div>
        </section>

        <section className="rounded-2xl p-3" style={surfaceStyle()}>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-ink-primary">最近续接</h3>
            <Link to={`/workbench/${interest.id}/chat`} className="text-xs font-medium text-apple-blue">
              打开对话
            </Link>
          </div>
          <div className="mt-3 grid gap-2">
            {overview.loading ? (
              <p className="rounded-xl px-3 py-4 text-center text-xs text-ink-tertiary" style={surfaceStyle("soft")}>
                正在加载…
              </p>
            ) : overview.error ? (
              <p className="rounded-xl px-3 py-4 text-center text-xs text-apple-red" style={surfaceStyle("soft")}>
                {overview.error}
              </p>
            ) : overview.checkpoints.length > 0 ? overview.checkpoints.slice(0, 3).map((checkpoint) => (
              <div key={checkpoint.id} className="rounded-xl px-3 py-2" style={surfaceStyle("soft")}>
                <p className="truncate text-xs font-semibold text-ink-primary">{checkpoint.goal || "未命名续接点"}</p>
                <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-ink-secondary">
                  {checkpoint.nextSteps[0] || checkpoint.openQuestions[0] || checkpoint.summary}
                </p>
                <p className="mt-1 text-[11px] text-ink-tertiary">{formatDate(checkpoint.updatedAt)}</p>
              </div>
            )) : (
              <p className="rounded-xl px-3 py-4 text-center text-xs text-ink-tertiary" style={surfaceStyle("soft")}>
                暂无续接点。
              </p>
            )}
          </div>
        </section>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <MiniList
          title="最近论文"
          empty="暂无论文。"
          items={papers.map((paper) => ({
            id: paper.id,
            title: paper.title,
            meta: paper.venue || paper.status,
          }))}
        />
        <MiniList
          title="最近笔记"
          empty="暂无笔记。"
          items={notes.map((note) => ({
            id: note.id,
            title: note.title,
            meta: formatDate(note.updated_at || note.created_at),
          }))}
        />
        <MiniList
          title="实验与投稿"
          empty="暂无显式证据链。"
          items={[
            ...overview.experiments.map((experiment) => ({
              id: `experiment-${experiment.id}`,
              title: experiment.title,
              meta: experiment.result || "实验记录",
            })),
            ...overview.submissions.map((submission) => ({
              id: `submission-${submission.id}`,
              title: submission.title,
              meta: submission.venueName || submission.status,
            })),
          ]}
        />
      </div>

      {overview.claims.length > 0 ? (
        <section className="mt-4 rounded-2xl p-3" style={surfaceStyle()}>
          <div className="flex items-center gap-2">
            <BookOpenCheck className="h-4 w-4 text-apple-blue" />
            <h3 className="text-sm font-semibold text-ink-primary">关键主张</h3>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {overview.claims.slice(0, 4).map((claim) => (
              <div key={claim.id} className="rounded-xl px-3 py-2" style={surfaceStyle("soft")}>
                <p className="text-xs font-semibold text-ink-primary">{claim.title}</p>
                <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-ink-secondary">{claim.statement}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
