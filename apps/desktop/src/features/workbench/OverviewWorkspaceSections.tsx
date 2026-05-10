import type { ReactNode } from "react";
import { ArrowRight, BookOpen, Library, MessageSquare, Sparkles } from "lucide-react";
import { Badge, Card } from "@research-copilot/ui";
import { Link } from "react-router-dom";
import { clsx } from "clsx";
import {
  toneStyle,
  toneToBadgeVariant,
  type WorkbenchAgendaItem,
  type WorkbenchAssetItem,
  type WorkbenchHandoffItem,
  type WorkbenchInterestItem,
  type WorkbenchMetric,
  type WorkbenchOverviewModel,
  type WorkbenchRiskItem,
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
      className={clsx("rounded-[18px] px-3.5 py-3", className)}
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

function TextActionLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1 text-xs font-medium text-apple-blue transition-opacity hover:opacity-75"
    >
      {label}
      <ArrowRight className="h-3.5 w-3.5" />
    </Link>
  );
}

function IconActionLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      aria-label={label}
      className="mt-0.5 inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-2xl text-ink-tertiary transition-colors hover:text-apple-blue"
      style={{
        background: "var(--rc-chip-bg)",
        border: "1px solid var(--rc-card-outline)",
        boxShadow: "var(--rc-chip-shadow)",
      }}
    >
      <ArrowRight className="h-4 w-4" />
    </Link>
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

function ToneTag({ label, tone }: { label: string; tone: WorkbenchAgendaItem["tone"] }) {
  const style = toneStyle(tone);

  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ background: style.background, color: style.color }}
    >
      {label}
    </span>
  );
}

export function SummaryItem({ title, description }: { title: string; description: string }) {
  return (
    <InsetSurface className="min-h-[74px]">
      <p className="text-sm font-semibold text-ink-primary">{title}</p>
      <p className="mt-1 text-xs leading-5 text-ink-secondary">{description}</p>
    </InsetSurface>
  );
}

export function MetricItem({ metric }: { metric: WorkbenchMetric }) {
  return (
    <div className="rc-home-metric-item rounded-[18px] px-3.5 py-3">
      <p className="text-xs font-medium text-ink-tertiary">{metric.label}</p>
      <p className="mt-1.5 text-xl font-semibold tabular-nums text-ink-primary">{metric.value}</p>
      <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-ink-secondary">{metric.note}</p>
    </div>
  );
}

function AgendaItem({ item }: { item: WorkbenchAgendaItem }) {
  return (
    <Card variant="inset" padding="sm" className="group">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <ToneTag label={item.label} tone={item.tone} />
          <div>
            <p className="text-sm font-semibold text-ink-primary">{item.title}</p>
            <p className="mt-1 text-xs leading-5 text-ink-secondary">{item.description}</p>
          </div>
        </div>
        <IconActionLink to={item.action.to} label={item.action.label} />
      </div>
    </Card>
  );
}

function InterestItem({ item }: { item: WorkbenchInterestItem }) {
  return (
    <Card variant="inset" padding="sm" className="flex min-h-[178px] flex-col">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-semibold text-ink-primary">{item.title}</p>
        <Badge variant={toneToBadgeVariant(item.stageTone)}>{item.stage}</Badge>
      </div>

      <p className="mt-2 line-clamp-3 flex-1 text-xs leading-5 text-ink-secondary">{item.summary}</p>

      <div className="mt-3 space-y-3 border-t pt-3" style={{ borderColor: "var(--rc-border)" }}>
        <div className="flex flex-wrap gap-1.5">
          {item.stats.map((stat) => (
            <span
              key={stat}
              className="inline-flex items-center rounded-lg px-2 py-1 text-[11px] font-medium text-ink-tertiary"
              style={{ background: "rgb(var(--rc-bg-rgb) / 0.18)" }}
            >
              {stat}
            </span>
          ))}
        </div>
        <div className="flex items-start justify-between gap-3">
          <p className="line-clamp-2 text-xs leading-5 text-ink-tertiary">
            <span className="font-semibold text-ink-secondary">下一步 </span>
            {item.nextStep}
          </p>
          <TextActionLink to={item.action.to} label={item.action.label} />
        </div>
      </div>
    </Card>
  );
}

function HandoffItem({ item }: { item: WorkbenchHandoffItem }) {
  return (
    <InsetSurface className="group">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <ToneTag label={item.label} tone={item.tone} />
          <p className="mt-2 text-sm font-semibold text-ink-primary">{item.title}</p>
          <p className="mt-1 text-xs leading-5 text-ink-secondary">{item.description}</p>
        </div>
        <IconActionLink to={item.action.to} label={item.action.label} />
      </div>
    </InsetSurface>
  );
}

function RiskItem({ item }: { item: WorkbenchRiskItem }) {
  return (
    <InsetSurface>
      <ToneTag label={item.label} tone={item.tone} />
      <p className="mt-2 text-sm font-semibold text-ink-primary">{item.title}</p>
      <p className="mt-1 text-xs leading-5 text-ink-secondary">{item.description}</p>
      <div className="mt-2.5">
        <TextActionLink to={item.action.to} label={item.action.label} />
      </div>
    </InsetSurface>
  );
}

function AssetItem({ item }: { item: WorkbenchAssetItem }) {
  return (
    <Card variant="inset" padding="sm" className="flex min-h-[144px] flex-col">
      <p className="text-[11px] font-semibold text-ink-tertiary">{item.label}</p>
      <p className="mt-1.5 text-sm font-semibold text-ink-primary">{item.title}</p>
      <p className="mt-1 line-clamp-3 flex-1 text-xs leading-5 text-ink-secondary">{item.description}</p>
      <div className="mt-2.5">
        <TextActionLink to={item.action.to} label={item.action.label} />
      </div>
    </Card>
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
        <section className="space-y-3">
          <SectionHeading
            title="今日推进"
            description="把今天最值得继续的事摆出来，让研究直接接上。"
          />
          {model.agenda.length === 0 ? (
            <EmptyState>今日待办已清空。做点随手记或者开启新的规划吧。</EmptyState>
          ) : (
            <div className="grid gap-2.5">
              {model.agenda.map((item) => (
                <AgendaItem key={item.id} item={item} />
              ))}
            </div>
          )}
        </section>
      );

    case "interests":
      return (
        <section className="space-y-3">
          <SectionHeading
            title="在研主题"
            description="按优先级排序，先处理最值得推进的主题。"
            action={{ label: "去规划", to: "/planner" }}
          />
          {model.interests.length === 0 ? (
            <EmptyState>还没有明确的研究主题，去规划里建立一个吧。</EmptyState>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {model.interests.map((item) => (
                <InterestItem key={item.id} item={item} />
              ))}
            </div>
          )}
        </section>
      );

    case "handoffs":
      return (
        <section className="space-y-3">
          <SectionHeading
            title="小妍交接"
            description="小妍刚整理好的结果，等你决定确认、追问或继续修改。"
            action={{ label: "打开小妍", to: "/xiaoyan" }}
          />
          {model.handoffs.length === 0 ? (
            <EmptyState>所有任务已交接。</EmptyState>
          ) : (
            <div className="grid gap-2.5">
              {model.handoffs.map((item) => (
                <HandoffItem key={item.id} item={item} />
              ))}
            </div>
          )}
        </section>
      );

    case "risks":
      if (model.risks.length === 0) return null;

      return (
        <section className="space-y-3">
          <SectionHeading
            title="阻塞与截止"
            description="容易拖慢研究推进的紧急事项。"
            action={{ label: "去投稿", to: "/submission" }}
          />
          <div className="grid gap-2.5">
            {model.risks.map((item) => (
              <RiskItem key={item.id} item={item} />
            ))}
          </div>
        </section>
      );

    case "assets":
      return (
        <section className="space-y-3">
          <SectionHeading
            title="近期沉淀"
            description="当前目标相关的论文、笔记和知识线索。"
          />
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3">
            {model.assets.map((item) => (
              <AssetItem key={item.id} item={item} />
            ))}
          </div>
        </section>
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
    <Card variant="inset" padding="sm" className="flex flex-col gap-3 md:flex-row md:items-center">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-apple-blue" style={{ background: "rgba(0,122,255,0.09)" }}>
        <Sparkles className="h-5 w-5" />
      </div>
      <div className="grid flex-1 gap-4 sm:grid-cols-3">
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
          to="/xiaoyan"
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
