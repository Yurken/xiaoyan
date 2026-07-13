import { Card, CardHeader, CardTitle } from "@research-copilot/ui";
import { Beaker, BookOpen, Flag, Lightbulb } from "lucide-react";
import { type KnowledgeGraphTimelineEntry } from "./graphView";

const TIMELINE_ICONS = {
  interest: Flag,
  paper: BookOpen,
  claim: Lightbulb,
  experiment: Beaker,
} as const;

function labelForKind(kind: KnowledgeGraphTimelineEntry["kind"]) {
  if (kind === "interest") return "方向";
  if (kind === "paper") return "论文";
  if (kind === "claim") return "结论";
  return "实验";
}

export default function KnowledgeTimelinePanel({
  entries,
}: {
  entries: KnowledgeGraphTimelineEntry[];
}) {
  if (entries.length === 0) {
    return (
      <Card padding="md">
        <CardHeader>
          <CardTitle>研究主题演进时间线</CardTitle>
        </CardHeader>
        <p className="text-sm text-ink-tertiary">
          目前还没有足够事件形成时间线。先导入论文，或补充结论与实验记录。
        </p>
      </Card>
    );
  }

  const groups = entries.reduce<Record<string, KnowledgeGraphTimelineEntry[]>>((acc, entry) => {
    const key = String(entry.year);
    acc[key] = acc[key] ? [...acc[key], entry] : [entry];
    return acc;
  }, {});

  return (
    <Card padding="md">
      <CardHeader>
        <CardTitle>研究主题演进时间线</CardTitle>
      </CardHeader>

      <div className="knowledge-graph-timeline space-y-5">
        {Object.entries(groups).map(([year, items]) => (
          <div key={year} className="grid gap-3 md:grid-cols-[92px,1fr]">
            <div className="text-2xl font-semibold text-ink-primary">{year}</div>
            <div className="knowledge-graph-timeline-events space-y-3">
              {items.map((item) => {
                const Icon = TIMELINE_ICONS[item.kind];
                return (
                  <div
                    key={item.id}
                    className={`knowledge-graph-timeline-event knowledge-graph-timeline-event--${item.kind} rounded-2xl px-4 py-3`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div
                          className="knowledge-graph-timeline-event__icon mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl"
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-ink-primary">{item.title}</p>
                            <span className="knowledge-graph-timeline-event__kind rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-tertiary">
                              {labelForKind(item.kind)}
                            </span>
                          </div>
                          <p className="text-xs leading-5 text-ink-secondary">{item.detail}</p>
                        </div>
                      </div>
                      <span className="text-[11px] text-ink-tertiary">{item.date.slice(0, 10)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
