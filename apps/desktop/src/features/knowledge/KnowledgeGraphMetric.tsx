import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import "./knowledge-graph.css";

export type KnowledgeGraphMetricTone = "interests" | "claims" | "evidence" | "citations";

export interface KnowledgeGraphMetricProps {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  tone: KnowledgeGraphMetricTone;
}

export default function KnowledgeGraphMetric({ label, value, icon: Icon, tone }: KnowledgeGraphMetricProps) {
  return (
    <div className={`knowledge-graph-metric knowledge-graph-metric--${tone}`}>
      <span className="knowledge-graph-metric__icon">
        <Icon className="h-3 w-3" />
      </span>
      <span className="knowledge-graph-metric__value text-lg font-bold tabular-nums">{value}</span>
      <span className="text-[11px] text-ink-tertiary">{label}</span>
    </div>
  );
}
