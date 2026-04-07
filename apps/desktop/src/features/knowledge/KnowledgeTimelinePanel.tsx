import { Card, CardHeader, CardTitle } from "@research-copilot/ui";
import { Beaker, BookOpen, Flag, Sparkles } from "lucide-react";
import { type KnowledgeGraphTimelineEntry } from "./graphView";

const TIMELINE_ICONS = {
  interest: Flag,
  paper: BookOpen,
  claim: Sparkles,
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
          <CardTitle>研究方向演进时间线</CardTitle>
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
        <CardTitle>研究方向演进时间线</CardTitle>
      </CardHeader>

      <div className="space-y-5">
        {Object.entries(groups).map(([year, items]) => (
          <div key={year} className="grid gap-3 md:grid-cols-[92px,1fr]">
            <div className="text-2xl font-semibold text-ink-primary">{year}</div>
            <div className="space-y-3">
              {items.map((item) => {
                const Icon = TIMELINE_ICONS[item.kind];
                return (
                  <div
                    key={item.id}
                    className="rounded-2xl border px-4 py-3"
                    style={{ borderColor: "var(--rc-border)", background: "var(--rc-panel-bg-soft, rgba(255,255,255,0.48))" }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div
                          className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl"
                          style={{ background: "rgba(0, 122, 255, 0.1)", color: "#0F5FD7" }}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-ink-primary">{item.title}</p>
                            <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-tertiary">
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
