import { ArrowRight, BookOpen, Library, MessageSquare, Sparkles } from "lucide-react";
import { Badge, Button, Card } from "@research-copilot/ui";
import { Link } from "react-router-dom";
import {
  toneStyle,
  toneToBadgeVariant,
  type WorkbenchAgendaItem,
  type WorkbenchAssetItem,
  type WorkbenchHandoffItem,
  type WorkbenchInterestItem,
  type WorkbenchOverviewModel,
  type WorkbenchRiskItem,
} from "./shared";

interface OverviewWorkspaceProps {
  model: WorkbenchOverviewModel;
}

function SectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: { label: string; to: string };
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-base font-semibold text-ink-primary">{title}</p>
        <p className="mt-1 text-xs leading-5 text-ink-tertiary">{description}</p>
      </div>
      {action ? (
        <Link to={action.to} className="text-xs font-medium text-apple-blue transition-opacity hover:opacity-75">
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}

function ToneTag({
  label,
  tone,
}: {
  label: string;
  tone: WorkbenchAgendaItem["tone"];
}) {
  const style = toneStyle(tone);
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold"
      style={{ background: style.background, color: style.color }}
    >
      {label}
    </span>
  );
}

function SummaryItem({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div
      className="rounded-[22px] p-4"
      style={{
        background: "var(--rc-card-inset-bg)",
        boxShadow: "var(--rc-card-inset-shadow)",
        border: "1px solid var(--rc-card-inset-outline)",
      }}
    >
      <p className="text-sm font-semibold text-ink-primary">{title}</p>
      <p className="mt-1.5 text-xs leading-6 text-ink-secondary">{description}</p>
    </div>
  );
}

function AgendaItem({ item }: { item: WorkbenchAgendaItem }) {
  return (
    <div
      className="rounded-[24px] p-4"
      style={{
        background: "var(--rc-card-inset-bg)",
        boxShadow: "var(--rc-card-inset-shadow)",
        border: "1px solid var(--rc-card-inset-outline)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <ToneTag label={item.label} tone={item.tone} />
          <div>
            <p className="text-sm font-semibold text-ink-primary">{item.title}</p>
            <p className="mt-1.5 text-xs leading-6 text-ink-secondary">{item.description}</p>
          </div>
        </div>
        <Link
          to={item.action.to}
          className="mt-0.5 inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl transition-transform hover:-translate-y-[1px]"
          style={{
            background: "var(--rc-card-bg)",
            boxShadow: "var(--rc-card-flat-shadow)",
            color: "var(--rc-text-soft)",
            border: "1px solid var(--rc-card-outline)",
          }}
        >
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="mt-3">
        <Link to={item.action.to} className="text-xs font-medium text-apple-blue transition-opacity hover:opacity-75">
          {item.action.label}
        </Link>
      </div>
    </div>
  );
}

function InterestItem({ item }: { item: WorkbenchInterestItem }) {
  return (
    <div
      className="rounded-[24px] p-4"
      style={{
        background: "var(--rc-card-inset-bg)",
        boxShadow: "var(--rc-card-inset-shadow)",
        border: "1px solid var(--rc-card-inset-outline)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink-primary">{item.title}</p>
          <p className="mt-1.5 text-xs leading-6 text-ink-secondary">{item.summary}</p>
        </div>
        <Badge variant={toneToBadgeVariant(item.stageTone)}>{item.stage}</Badge>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {item.stats.map((stat) => (
          <span
            key={stat}
            className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium text-ink-tertiary"
            style={{ background: "rgb(var(--rc-bg-rgb) / 0.16)" }}
          >
            {stat}
          </span>
        ))}
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-tertiary">下一步</p>
          <p className="mt-1 text-xs leading-6 text-ink-secondary">{item.nextStep}</p>
        </div>
        <Link to={item.action.to} className="text-xs font-medium text-apple-blue transition-opacity hover:opacity-75">
          {item.action.label}
        </Link>
      </div>
    </div>
  );
}

function HandoffItem({ item }: { item: WorkbenchHandoffItem }) {
  return (
    <div className="rc-home-asset-item rounded-[22px] px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <ToneTag label={item.label} tone={item.tone} />
          <p className="mt-2 text-sm font-semibold text-ink-primary">{item.title}</p>
          <p className="mt-1.5 text-xs leading-6 text-ink-secondary">{item.description}</p>
        </div>
        <Link to={item.action.to} className="text-xs font-medium text-apple-blue transition-opacity hover:opacity-75">
          {item.action.label}
        </Link>
      </div>
    </div>
  );
}

function RiskItem({ item }: { item: WorkbenchRiskItem }) {
  return (
    <div className="rc-home-asset-item rounded-[22px] px-4 py-3">
      <ToneTag label={item.label} tone={item.tone} />
      <p className="mt-2 text-sm font-semibold text-ink-primary">{item.title}</p>
      <p className="mt-1.5 text-xs leading-6 text-ink-secondary">{item.description}</p>
      <div className="mt-3">
        <Link to={item.action.to} className="text-xs font-medium text-apple-blue transition-opacity hover:opacity-75">
          {item.action.label}
        </Link>
      </div>
    </div>
  );
}

function AssetItem({ item }: { item: WorkbenchAssetItem }) {
  return (
    <div
      className="rounded-[24px] p-4"
      style={{
        background: "var(--rc-card-inset-bg)",
        boxShadow: "var(--rc-card-inset-shadow)",
        border: "1px solid var(--rc-card-inset-outline)",
      }}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-tertiary">{item.label}</p>
      <p className="mt-2 text-sm font-semibold text-ink-primary">{item.title}</p>
      <p className="mt-1.5 line-clamp-3 text-xs leading-6 text-ink-secondary">{item.description}</p>
      <div className="mt-4">
        <Link to={item.action.to} className="text-xs font-medium text-apple-blue transition-opacity hover:opacity-75">
          {item.action.label}
        </Link>
      </div>
    </div>
  );
}

export default function OverviewWorkspace({ model }: OverviewWorkspaceProps) {
  return (
    <div className="rc-page-scroll space-y-5">
      <Card padding="lg" className="relative overflow-hidden">
        <div
          className="absolute inset-x-7 top-0 h-px"
          style={{ background: "linear-gradient(90deg, transparent, rgb(var(--rc-border-rgb) / 0.88), transparent)" }}
        />
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <div className="space-y-3">
              <p className="rc-kicker">小妍工作台</p>
              <div className="space-y-3">
                <h1 className="max-w-3xl text-[clamp(2rem,3vw,3.2rem)] font-semibold tracking-[-0.05em] text-ink-primary">
                  {model.heroTitle}
                </h1>
                <p className="max-w-3xl text-sm leading-7 text-ink-secondary">{model.heroDescription}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link to={model.primaryAction.to}>
                <Button>
                  {model.primaryAction.label}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to={model.secondaryAction.to}>
                <Button variant="secondary">{model.secondaryAction.label}</Button>
              </Link>
            </div>

            <div className="space-y-3">
              <div className="rc-subtle-rule" />
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {model.metrics.map((metric) => (
                  <div key={metric.label} className="rc-home-metric-item rounded-[22px] p-3.5">
                    <p className="text-xs font-medium text-ink-tertiary">{metric.label}</p>
                    <p className="mt-2 text-2xl font-semibold tabular-nums text-ink-primary">{metric.value}</p>
                    <p className="mt-1 text-xs leading-5 text-ink-secondary">{metric.note}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-3">
            {model.summaryItems.map((item) => (
              <SummaryItem key={item.title} title={item.title} description={item.description} />
            ))}
          </div>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
        <Card padding="md" className="space-y-4">
          <SectionHeading
            title="今日推进"
            description="先把今天最值得继续的事摆出来，让研究从首页就能接上。"
          />
          <div className="grid gap-3">
            {model.agenda.map((item) => (
              <AgendaItem key={item.id} item={item} />
            ))}
          </div>
        </Card>

        <Card padding="md" className="space-y-4">
          <SectionHeading
            title="小妍交接"
            description="小妍先把刚整理好的结果交回来，你再决定确认、追问还是继续修改。"
            action={{ label: "打开小妍", to: "/xiaoyan" }}
          />
          <div className="grid gap-3">
            {model.handoffs.map((item) => (
              <HandoffItem key={item.id} item={item} />
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
        <Card padding="md" className="space-y-4">
          <SectionHeading
            title="在研主题"
            description="按推进优先级排序，帮助你先处理最值得继续的主题。"
            action={{ label: "去规划", to: "/planner" }}
          />
          {model.interests.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-nm-dark/10 bg-white/25 px-4 py-10 text-center text-xs text-ink-tertiary">
              暂无研究主题。先从一个研究问题开始，小妍会帮你搭起路线。
            </div>
          ) : (
            <div className="grid gap-3">
              {model.interests.map((item) => (
                <InterestItem key={item.id} item={item} />
              ))}
            </div>
          )}
        </Card>

        <Card padding="md" className="space-y-4">
          <SectionHeading
            title="阻塞与截止"
            description="把容易拖慢研究推进的截止、阻塞和待处理事项固定放在右侧。"
            action={{ label: "去投稿", to: "/submission" }}
          />
          <div className="grid gap-3">
            {model.risks.map((item) => (
              <RiskItem key={item.id} item={item} />
            ))}
          </div>
        </Card>
      </div>

      <Card padding="md" className="space-y-4">
        <SectionHeading
          title="最近沉淀"
          description="优先显示当前目标最相关的论文、笔记和主题，不只按时间罗列。"
        />
        <div className="grid gap-3 xl:grid-cols-3">
          {model.assets.map((item) => (
            <AssetItem key={item.id} item={item} />
          ))}
        </div>
        <div
          className="flex items-start gap-3 rounded-[24px] px-4 py-4"
          style={{
            background: "var(--rc-card-inset-bg)",
            boxShadow: "var(--rc-card-inset-shadow)",
            border: "1px solid var(--rc-card-inset-outline)",
          }}
        >
          <div
            className="flex h-10 w-10 items-center justify-center rounded-2xl"
            style={{ background: "rgba(0,122,255,0.08)", color: "#007AFF" }}
          >
            <Sparkles className="h-4.5 w-4.5" />
          </div>
          <div className="grid flex-1 gap-3 md:grid-cols-3">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <BookOpen className="h-3.5 w-3.5 text-apple-blue" />
                <p className="text-xs font-semibold text-ink-primary">规划</p>
              </div>
              <Link to="/planner" className="text-xs leading-6 text-ink-secondary transition-colors hover:text-apple-blue">
                把研究目标、关键词和路线重新收一遍。
              </Link>
            </div>
            <div>
              <div className="mb-2 flex items-center gap-2">
                <MessageSquare className="h-3.5 w-3.5 text-[#14B8A6]" />
                <p className="text-xs font-semibold text-ink-primary">小妍</p>
              </div>
              <Link to="/xiaoyan" className="text-xs leading-6 text-ink-secondary transition-colors hover:text-apple-blue">
                带着论文和问题继续追问，不用从头描述背景。
              </Link>
            </div>
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Library className="h-3.5 w-3.5 text-[#F97316]" />
                <p className="text-xs font-semibold text-ink-primary">知识</p>
              </div>
              <Link to="/knowledge" className="text-xs leading-6 text-ink-secondary transition-colors hover:text-apple-blue">
                把已经想清楚的结论沉淀下来，后面写作会更稳。
              </Link>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
