import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { Button, Card } from "@research-copilot/ui";
import { Link } from "react-router-dom";
import MorphingText from "../../components/MorphingText";
import {
  MetricItem,
  OverviewSection,
  QuickActionStrip,
  SummaryItem,
} from "./OverviewWorkspaceSections";
import type { WorkbenchOverviewModel } from "./shared";

interface OverviewWorkspaceProps {
  model: WorkbenchOverviewModel;
  beforeQuickActions?: ReactNode;
}

export default function OverviewWorkspace({ model, beforeQuickActions }: OverviewWorkspaceProps) {
  const promotedSections = model.layout.filter((section) => section.prominence === "promoted");
  const normalSections = model.layout.filter((section) => section.prominence === "normal");

  return (
    <div className="pb-10">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-5">
        <Card padding="md" className="relative overflow-hidden">
          <div
            className="absolute inset-x-5 top-0 h-px"
            style={{ background: "linear-gradient(90deg, transparent, rgb(var(--rc-border-rgb) / 0.78), transparent)" }}
          />
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="flex min-w-0 flex-col gap-4">
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="rc-kicker">小妍工作台</p>
                </div>
                <MorphingText
                  tag="h1"
                  text={model.heroTitle}
                  className="max-w-3xl text-[clamp(1.55rem,2.25vw,2.35rem)] font-semibold leading-tight tracking-normal text-ink-primary"
                />
                <MorphingText
                  tag="p"
                  text={model.heroDescription}
                  className="max-w-3xl text-sm leading-6 text-ink-secondary"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <Link to={model.primaryAction.to}>
                  <Button size="sm">
                    <Sparkles className="h-3.5 w-3.5" />
                    {model.primaryAction.label}
                  </Button>
                </Link>
                <Link to={model.secondaryAction.to}>
                  <Button size="sm" variant="secondary">
                    {model.secondaryAction.label}
                  </Button>
                </Link>
              </div>

              <div className="grid max-w-2xl gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {model.metrics.map((metric) => (
                  <MetricItem key={metric.label} metric={metric} />
                ))}
              </div>
            </div>

            <div className="grid content-start gap-2">
              {model.summaryItems.map((item) => (
                <SummaryItem key={item.title} title={item.title} description={item.description} />
              ))}
            </div>
          </div>
        </Card>

        {promotedSections.length > 0 ? (
          <div className="grid gap-4">
            {promotedSections.map((section) => (
              <OverviewSection key={section.type} section={section} model={model} />
            ))}
          </div>
        ) : null}

        {normalSections.length > 0 ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.04fr)_minmax(320px,0.96fr)]">
            {normalSections.map((section) => (
              <OverviewSection key={section.type} section={section} model={model} />
            ))}
          </div>
        ) : null}

        {beforeQuickActions}

        <QuickActionStrip />
      </div>
    </div>
  );
}
