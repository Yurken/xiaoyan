import type { ReactNode } from "react";
import { BookOpen, Library, MessageSquare, Sparkles } from "lucide-react";
import { Card } from "@research-copilot/ui";
import { Link } from "react-router-dom";
import { clsx } from "clsx";
import {
  AgendaTimeline,
  AssetShelf,
  HandoffQueue,
  InterestBoard,
  RiskAlertList,
} from "./OverviewModuleViews";
import {
  type WorkbenchMetric,
  type WorkbenchOverviewModel,
  type WorkbenchSectionLayout,
} from "./shared";

interface SectionHeadingProps {
  title: string;
  description: string;
  action?: { label: string; to: string };
}

interface InsetSurfaceProps {
  children: ReactNode;
  className?: string;
}

function InsetSurface({ children, className }: InsetSurfaceProps) {
  return (
    <div
      className={clsx("min-w-0 rounded-[18px] px-3.5 py-3", className)}
      style={{
        background: "var(--rc-card-inset-bg)",
        border: "1px solid var(--rc-card-inset-outline)",
        boxShadow: "var(--rc-card-inset-shadow)",
      }}
    >
      {children}
    </div>
  );
}

function SectionHeading({ title, description, action }: SectionHeadingProps) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-ink-primary">{title}</h2>
        <p className="mt-1 text-xs leading-5 text-ink-tertiary">{description}</p>
      </div>
      {action ? (
        <Link
          to={action.to}
          className="flex-shrink-0 text-xs font-medium text-apple-blue transition-opacity hover:opacity-75"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}

export function SummaryItem({ title, description }: { title: string; description: string }) {
  return (
    <InsetSurface className="min-h-[74px]">
      <p className="truncate text-sm font-semibold text-ink-primary">{title}</p>
      <p className="mt-1 line-clamp-2 text-xs leading-5 text-ink-secondary">{description}</p>
    </InsetSurface>
  );
}

export function MetricItem({ metric }: { metric: WorkbenchMetric }) {
  return (
    <div className="rc-home-metric-item rounded-2xl px-3 py-2.5">
      <p className="text-[11px] font-medium leading-4 text-ink-tertiary">{metric.label}</p>
      <p className="mt-1 text-lg font-semibold leading-6 tabular-nums text-ink-primary">{metric.value}</p>
      <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-ink-secondary">{metric.note}</p>
    </div>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <InsetSurface className="flex min-h-[96px] items-center justify-center border-dashed text-center text-sm text-ink-tertiary">
      {children}
    </InsetSurface>
  );
}

export function OverviewSection({
  section,
  model,
}: {
  section: WorkbenchSectionLayout;
  model: WorkbenchOverviewModel;
}) {
  switch (section.type) {
    case "agenda":
      return (
        <Card padding="md" className="flex flex-col gap-4">
          <SectionHeading
            title="今日推进"
            description="把今天最值得继续的事摆出来，让研究直接接上。"
          />
          {model.agenda.length === 0 ? (
            <EmptyState>今日待办已清空。做点随手记或者开启新的规划吧。</EmptyState>
          ) : (
            <AgendaTimeline items={model.agenda} />
          )}
        </Card>
      );

    case "interests":
      return (
        <Card padding="md" className="flex flex-col gap-4">
          <SectionHeading
            title="在研主题"
            description="按优先级排序，先处理最值得推进的主题。"
            action={{ label: "去规划", to: "/planner" }}
          />
          {model.interests.length === 0 ? (
            <EmptyState>还没有明确的研究主题，去规划里建立一个吧。</EmptyState>
          ) : (
            <InterestBoard items={model.interests} />
          )}
        </Card>
      );

    case "handoffs":
      return (
        <Card padding="md" className="flex flex-col gap-4">
          <SectionHeading
            title="小妍交接"
            description="小妍刚整理好的结果，等你决定确认、追问或继续修改。"
            action={{ label: "打开对话", to: "/chat" }}
          />
          {model.handoffs.length === 0 ? (
            <EmptyState>所有任务已交接。</EmptyState>
          ) : (
            <HandoffQueue items={model.handoffs} />
          )}
        </Card>
      );

    case "risks":
      if (model.risks.length === 0) return null;

      return (
        <Card padding="md" className="flex flex-col gap-4">
          <SectionHeading
            title="阻塞与截止"
            description="容易拖慢研究推进的紧急事项。"
            action={{ label: "去投稿", to: "/submission" }}
          />
          <RiskAlertList items={model.risks} />
        </Card>
      );

    case "assets":
      return (
        <Card padding="md" className="flex flex-col gap-4">
          <SectionHeading
            title="近期沉淀"
            description="当前目标相关的论文、笔记和知识线索。"
          />
          <AssetShelf items={model.assets} />
        </Card>
      );

    default:
      return null;
  }
}

function QuickAction({
  icon,
  title,
  description,
  to,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  to: string;
}) {
  return (
    <Link to={to} className="group block min-w-0">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-ink-tertiary transition-colors group-hover:text-apple-blue">{icon}</span>
        <p className="text-xs font-semibold text-ink-primary">{title}</p>
      </div>
      <p className="text-xs leading-5 text-ink-secondary transition-colors group-hover:text-ink-primary">
        {description}
      </p>
    </Link>
  );
}

export function QuickActionStrip() {
  return (
    <Card variant="inset" padding="sm" className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-apple-blue" style={{ background: "rgba(0,122,255,0.09)" }}>
        <Sparkles className="h-5 w-5" />
      </div>
      <div className="grid min-w-0 flex-1 gap-4 sm:grid-cols-3">
        <QuickAction
          icon={<BookOpen className="h-4 w-4" />}
          title="规划路线"
          description="把目标、关键词和路线重新梳理一遍。"
          to="/planner"
        />
        <QuickAction
          icon={<MessageSquare className="h-4 w-4" />}
          title="发问思考"
          description="带着论文和问题追问，保持思路连贯。"
          to="/chat"
        />
        <QuickAction
          icon={<Library className="h-4 w-4" />}
          title="沉淀知识"
          description="把推导好的结论记下来，为写作铺垫。"
          to="/knowledge"
        />
      </div>
    </Card>
  );
}
