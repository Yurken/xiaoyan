import { ArrowRight, BookOpen, Library, MessageSquare, Sparkles } from "lucide-react";
import { Badge, Button, Card, CardHeader, CardTitle, CardSection } from "@research-copilot/ui";
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
  type WorkbenchSectionLayout,
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
    <div className="flex items-end justify-between gap-4 pb-2">
      <div>
        <h2 className="text-base font-semibold text-ink-primary">{title}</h2>
        <p className="mt-1 text-xs leading-5 text-ink-tertiary">{description}</p>
      </div>
      {action && (
        <Link to={action.to} className="flex-shrink-0 text-xs font-medium text-apple-blue transition-colors hover:text-apple-blue/80">
          {action.label}
        </Link>
      )}
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
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ background: style.background, color: style.color }}
    >
      {label}
    </span>
  );
}

function SummaryItem({ title, description }: { title: string; description: string }) {
  return (
    <Card variant="inset" padding="sm" className="flex flex-col justify-center">
      <p className="text-sm font-semibold text-ink-primary">{title}</p>
      <p className="mt-1.5 text-xs leading-6 text-ink-secondary">{description}</p>
    </Card>
  );
}

function AgendaItem({ item }: { item: WorkbenchAgendaItem }) {
  return (
    <Card variant="inset" padding="sm" className="group block hover:border-apple-blue/30 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2 flex-1">
          <ToneTag label={item.label} tone={item.tone} />
          <div>
            <p className="text-sm font-semibold text-ink-primary">{item.title}</p>
            <p className="mt-1.5 text-xs leading-6 text-ink-secondary">{item.description}</p>
          </div>
        </div>
        <Link
          to={item.action.to}
          className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-apple-blue text-white opacity-0 shadow-sm transition-all group-hover:opacity-100 hover:scale-105"
        >
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </Card>
  );
}

function InterestItem({ item }: { item: WorkbenchInterestItem }) {
  return (
    <Card variant="inset" padding="sm" className="flex flex-col relative group overflow-hidden border border-transparent hover:border-apple-blue/20 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 pr-4">
          <p className="truncate text-sm font-semibold text-ink-primary">{item.title}</p>
        </div>
        <Badge variant={toneToBadgeVariant(item.stageTone)}>{item.stage}</Badge>
      </div>
      <p className="mt-1.5 text-xs leading-6 text-ink-secondary flex-1">{item.summary}</p>

      <div className="mt-4 pt-4 border-t border-rc-surface/5 flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5">
          {item.stats.map((stat) => (
            <span
              key={stat}
              className="inline-flex items-center rounded-lg px-2 py-1 text-[11px] font-medium text-ink-tertiary bg-rc-elevated shrink-0"
            >
              {stat}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-tertiary truncate">
            <span className="text-ink-tertiary mr-1">下一步:</span> {item.nextStep}
          </p>
          <Link to={item.action.to} className="shrink-0 text-xs font-medium text-apple-blue opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pl-3">
            {item.action.label}
          </Link>
        </div>
      </div>
    </Card>
  );
}

function HandoffItem({ item }: { item: WorkbenchHandoffItem }) {
  return (
    <div className="rc-home-asset-item rounded-[20px] p-4 flex flex-col group relative transition-colors hover:bg-apple-blue/5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <ToneTag label={item.label} tone={item.tone} />
          <p className="mt-2 text-sm font-semibold text-ink-primary">{item.title}</p>
          <p className="mt-1.5 text-xs leading-6 text-ink-secondary">{item.description}</p>
        </div>
        <Link to={item.action.to} className="shrink-0 mt-1 h-8 w-8 flex items-center justify-center rounded-full bg-white/10 text-apple-blue opacity-0 group-hover:opacity-100 transition-all">
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

function RiskItem({ item }: { item: WorkbenchRiskItem }) {
  return (
    <div className="rc-home-asset-item rounded-[20px] p-4 border border-transparent hover:border-red-500/20 transition-colors">
      <div className="flex items-start justify-between gap-3">
         <div className="flex-1">
            <ToneTag label={item.label} tone={item.tone} />
            <p className="mt-2 text-sm font-semibold text-ink-primary">{item.title}</p>
            <p className="mt-1.5 text-xs leading-6 text-ink-secondary">{item.description}</p>
         </div>
      </div>
      <div className="mt-3">
        <Link to={item.action.to} className="text-xs font-medium text-apple-blue transition-opacity hover:opacity-75 transition-colors">
          {item.action.label} &rarr;
        </Link>
      </div>
    </div>
  );
}

function AssetItem({ item }: { item: WorkbenchAssetItem }) {
  return (
    <Card variant="inset" padding="sm" className="group hover:border-apple-blue/20 transition-colors flex flex-col">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-tertiary">{item.label}</p>
      <p className="mt-2 text-sm font-semibold text-ink-primary">{item.title}</p>
      <p className="mt-1.5 line-clamp-3 text-xs leading-6 text-ink-secondary flex-1">{item.description}</p>
      <div className="mt-3">
        <Link to={item.action.to} className="text-xs font-medium text-apple-blue opacity-0 group-hover:opacity-100 transition-opacity">
          {item.action.label} &rarr;
        </Link>
      </div>
    </Card>
  );
}

function renderSectionContent(
  type: WorkbenchSectionLayout["type"],
  model: WorkbenchOverviewModel,
) {
  switch (type) {
    case "agenda":
      return (
        <section className="space-y-4">
          <SectionHeading
            title="今日推进"
            description="把你今天最值得继续的事摆出来，让研究直接接上。"
          />
          {model.agenda.length === 0 ? (
            <Card padding="md" variant="flat" className="flex items-center justify-center py-12 text-ink-tertiary font-medium text-sm border-dashed">
              今日待办已清空。做点随手记或者开启新的规划吧。
            </Card>
          ) : (
            <div className="grid gap-3">
              {model.agenda.map((item) => (
                <AgendaItem key={item.id} item={item} />
              ))}
            </div>
          )}
        </section>
      );

    case "interests":
      return (
        <section className="space-y-4">
          <SectionHeading
            title="在研主题"
            description="按优先级排序，帮助你先处理最值得推进的主题。"
            action={{ label: "去规划", to: "/planner" }}
          />
          {model.interests.length === 0 ? (
            <Card padding="md" variant="flat" className="flex items-center justify-center py-12 text-ink-tertiary font-medium text-sm border-dashed">
              还没有明确的研究主题，去规划里建立一个吧。
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {model.interests.map((item) => (
                <InterestItem key={item.id} item={item} />
              ))}
            </div>
          )}
        </section>
      );

    case "handoffs":
      return (
        <Card padding="md" className="space-y-5">
          <SectionHeading
            title="小妍交接"
            description="小妍刚整理好的结果，等你决定确认追问或继续修改。"
            action={{ label: "打开小妍", to: "/xiaoyan" }}
          />
          {model.handoffs.length === 0 ? (
            <div className="text-center py-8 text-sm text-ink-tertiary font-medium">
              所有任务已交接。
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {model.handoffs.map((item) => (
                <HandoffItem key={item.id} item={item} />
              ))}
            </div>
          )}
        </Card>
      );

    case "risks":
      if (model.risks.length === 0) return null;
      return (
        <Card padding="md" className="space-y-5 bg-red-500/[0.02] border-red-500/10">
          <SectionHeading
            title="阻塞与截止"
            description="容易拖慢研究推进的紧急事项。"
            action={{ label: "去投稿", to: "/submission" }}
          />
          <div className="flex flex-col gap-2">
            {model.risks.map((item) => (
              <RiskItem key={item.id} item={item} />
            ))}
          </div>
        </Card>
      );

    case "assets":
      return (
        <section className="space-y-4">
          <SectionHeading
            title="近期沉淀"
            description="当前目标相关的论文、笔记"
          />
          {model.assets.length === 0 ? null : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-6">
              {model.assets.map((item) => (
                <AssetItem key={item.id} item={item} />
              ))}
            </div>
          )}
        </section>
      );

    default:
      return null;
  }
}

export default function OverviewWorkspace({ model }: OverviewWorkspaceProps) {
  const promotedSections = model.layout.filter((s) => s.prominence === "promoted");
  const normalSections = model.layout.filter((s) => s.prominence === "normal");

  return (
    <div className="rc-page-scroll space-y-8 pb-12">
      {/* Hero Banner Section */}
      <section className="relative pt-6">
        <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr] items-start">
          <div className="flex flex-col gap-6">
            <div className="space-y-4">
              <p className="rc-kicker">小妍工作台</p>
              <h1 className="max-w-3xl text-[clamp(2rem,3vw,3.2rem)] font-semibold tracking-[-0.05em] text-ink-primary">
                {model.heroTitle}
              </h1>
              <p className="max-w-3xl text-sm leading-7 text-ink-secondary">
                {model.heroDescription}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4 mt-2">
              <Link to={model.primaryAction.to}>
                <Button className="">
                  <Sparkles className="mr-2 h-4 w-4" />
                  {model.primaryAction.label}
                </Button>
              </Link>
              <Link to={model.secondaryAction.to}>
                <Button variant="secondary" className="">
                  {model.secondaryAction.label}
                </Button>
              </Link>
            </div>
          </div>

          <div className="grid gap-3 pt-6 lg:pt-0">
            {model.summaryItems.map((item) => (
              <SummaryItem key={item.title} title={item.title} description={item.description} />
            ))}
          </div>
        </div>

        {/* Metrics Bar */}
        <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4">
          {model.metrics.map((metric) => (
            <div key={metric.label} className="rc-home-metric-item rounded-[20px] p-5 flex flex-col justify-between transition-transform hover:-translate-y-1">
              <p className="text-xs font-medium text-ink-tertiary">{metric.label}</p>
              <div>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-ink-primary">{metric.value}</p>
                <p className="mt-1 text-xs leading-5 text-ink-secondary">{metric.note}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Promoted sections — full width, one per row */}
      {promotedSections.map((section) => (
        <div key={section.type}>
          {renderSectionContent(section.type, model)}
        </div>
      ))}

      {/* Normal sections — responsive grid */}
      {normalSections.length > 0 && (
        <div className="grid gap-6 xl:grid-cols-[6fr_4fr]">
          {normalSections.map((section) => (
            <div key={section.type}>
              {renderSectionContent(section.type, model)}
            </div>
          ))}
        </div>
      )}

      {/* Bottom CTA Card */}
      <Card variant="inset" padding="md" className="flex flex-col md:flex-row items-center gap-6 group hover:border-apple-blue/20 transition-colors">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[20px] bg-apple-blue/10 text-apple-blue">
          <Sparkles className="h-6 w-6" />
        </div>
        <div className="grid flex-1 gap-6 sm:grid-cols-3">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-apple-blue" />
              <p className="text-xs font-semibold text-ink-primary">规划路线</p>
            </div>
            <Link to="/planner" className="block text-xs leading-6 text-ink-secondary transition-colors hover:text-apple-blue">
              把研究目标、关键词和路线重新梳理一遍。
            </Link>
          </div>
          <div>
            <div className="mb-2 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-[#14B8A6]" />
              <p className="text-xs font-semibold text-ink-primary">发问思考</p>
            </div>
            <Link to="/xiaoyan" className="block text-xs leading-6 text-ink-secondary transition-colors hover:text-[#14B8A6]">
              带着论文和问题随时追问，保持思维连贯。
            </Link>
          </div>
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Library className="h-4 w-4 text-[#F97316]" />
              <p className="text-xs font-semibold text-ink-primary">沉淀知识</p>
            </div>
            <Link to="/knowledge" className="block text-xs leading-6 text-ink-secondary transition-colors hover:text-[#F97316]">
              把推导好的结论记下来，为之后的写作铺垫。
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
