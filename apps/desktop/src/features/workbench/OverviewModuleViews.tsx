import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  FileText,
  Layers3,
  MessageSquareText,
  Route,
} from "lucide-react";
import { Badge } from "@research-copilot/ui";
import { Link } from "react-router-dom";
import {
  toneStyle,
  toneToBadgeVariant,
  type WorkbenchAgendaItem,
  type WorkbenchAssetItem,
  type WorkbenchHandoffItem,
  type WorkbenchInterestItem,
  type WorkbenchRiskItem,
} from "./shared";

function surfaceStyle(variant: "inset" | "soft" | "outset" = "inset") {
  if (variant === "outset") {
    return {
      background: "var(--rc-bg)",
      border: "1px solid var(--rc-border)",
      boxShadow: "4px 4px 10px var(--rc-shadow-dark, rgba(0,0,0,0.04)), -4px -4px 10px var(--rc-shadow-light, rgba(255,255,255,0.7))",
    };
  }
  return {
    background: variant === "inset" ? "var(--rc-card-inset-bg)" : "rgb(var(--rc-bg-rgb) / 0.14)",
    border: "1px solid var(--rc-card-inset-outline)",
    boxShadow: variant === "inset" ? "var(--rc-card-inset-shadow)" : "var(--rc-card-flat-shadow)",
  };
}

function ActionLink({ to, label }: { to: string; label: string }) {
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

export function AgendaTimeline({ items }: { items: WorkbenchAgendaItem[] }) {
  return (
    <ol className="grid gap-2">
      {items.map((item, index) => (
        <li key={item.id} className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-start gap-3 py-1">
          <div className="relative flex justify-center">
            {index < items.length - 1 ? (
              <span className="absolute left-1/2 top-7 h-[calc(100%+0.75rem)] w-px -translate-x-1/2 bg-nm-dark/60" />
            ) : null}
            <span
              className="relative z-10 flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold text-ink-primary"
              style={surfaceStyle("soft")}
            >
              {index + 1}
            </span>
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <ToneTag label={item.label} tone={item.tone} />
              <p className="truncate text-sm font-semibold text-ink-primary">{item.title}</p>
            </div>
            <p className="mt-1 text-xs leading-5 text-ink-secondary">{item.description}</p>
          </div>

          <ActionLink to={item.action.to} label={item.action.label} />
        </li>
      ))}
    </ol>
  );
}

export function InterestBoard({ items }: { items: WorkbenchInterestItem[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((item) => (
        <article key={item.id} className="flex min-h-[176px] flex-col rounded-[22px] p-4" style={surfaceStyle("soft")}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl text-apple-blue" style={surfaceStyle("soft")}>
                <Route className="h-4 w-4" />
              </span>
              <p className="truncate text-sm font-semibold text-ink-primary">{item.title}</p>
            </div>
            <Badge variant={toneToBadgeVariant(item.stageTone)}>{item.stage}</Badge>
          </div>

          <p className="mt-3 line-clamp-3 flex-1 text-xs leading-5 text-ink-secondary">{item.summary}</p>

          <div className="mt-3 grid gap-2">
            <div className="flex flex-wrap gap-1.5">
              {item.stats.map((stat) => (
                <span key={stat} className="rounded-lg px-2 py-1 text-[11px] font-medium text-ink-tertiary" style={surfaceStyle("soft")}>
                  {stat}
                </span>
              ))}
            </div>
            <div className="flex items-start justify-between gap-3 rounded-2xl px-3 py-2" style={surfaceStyle("soft")}>
              <p className="line-clamp-2 text-xs leading-5 text-ink-secondary">{item.nextStep}</p>
              <ActionLink to={item.action.to} label={item.action.label} />
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

export function HandoffQueue({ items }: { items: WorkbenchHandoffItem[] }) {
  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <article key={item.id} className="grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-start gap-3 rounded-[20px] p-3.5 transition-transform hover:-translate-y-0.5" style={surfaceStyle("outset")}>
          <span className="flex h-9 w-9 items-center justify-center rounded-[14px] text-apple-blue" style={surfaceStyle("soft")}>
            <MessageSquareText className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <ToneTag label={item.label} tone={item.tone} />
              <p className="truncate text-sm font-semibold text-ink-primary">{item.title}</p>
            </div>
            <p className="mt-1 text-xs leading-5 text-ink-secondary">{item.description}</p>
          </div>
          <ActionLink to={item.action.to} label={item.action.label} />
        </article>
      ))}
    </div>
  );
}

export function RiskAlertList({ items }: { items: WorkbenchRiskItem[] }) {
  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <article key={item.id} className="rounded-[20px] border-l-4 border-apple-red px-4 py-3.5" style={surfaceStyle("soft")}>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl text-apple-red" style={surfaceStyle("soft")}>
              <AlertTriangle className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <ToneTag label={item.label} tone={item.tone} />
                <p className="text-sm font-semibold text-ink-primary">{item.title}</p>
              </div>
              <p className="mt-1 text-xs leading-5 text-ink-secondary">{item.description}</p>
              <div className="mt-2">
                <ActionLink to={item.action.to} label={item.action.label} />
              </div>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

export function AssetShelf({ items }: { items: WorkbenchAssetItem[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3">
      {items.map((item, index) => {
        const Icon = index % 3 === 0 ? FileText : index % 3 === 1 ? BookOpenCheck : Layers3;

        return (
          <article key={item.id} className="flex min-h-[148px] flex-col rounded-[22px] p-4" style={surfaceStyle("soft")}>
            <div className="flex items-start justify-between gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl text-apple-blue" style={surfaceStyle("soft")}>
                <Icon className="h-4 w-4" />
              </span>
              <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-ink-tertiary" style={surfaceStyle("soft")}>
                {item.label}
              </span>
            </div>
            <p className="mt-3 text-sm font-semibold text-ink-primary">{item.title}</p>
            <p className="mt-1 line-clamp-3 flex-1 text-xs leading-5 text-ink-secondary">{item.description}</p>
            <div className="mt-2.5">
              <ActionLink to={item.action.to} label={item.action.label} />
            </div>
          </article>
        );
      })}
    </div>
  );
}
