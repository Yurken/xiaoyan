import { CheckCircle2, FileText, FlaskConical, ListTodo, Send } from "lucide-react";
import type { ResearchActivityEvent } from "./shared";

const EVENT_LABELS: Record<string, string> = {
  paper_read: "导入论文",
  note_added: "新增笔记",
  experiment_logged: "实验记录",
  submission_updated: "投稿推进",
};

interface ResearchTimelinePanelProps {
  events: ResearchActivityEvent[];
}

export default function ResearchTimelinePanel({ events }: ResearchTimelinePanelProps) {
  if (events.length === 0) {
    return (
      <div className="text-sm text-ink-tertiary">
        暂无活动记录。
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-[11px] font-semibold text-ink-tertiary uppercase tracking-wide">
        研究时间线
      </div>
      <div className="relative border-l border-black/[0.08] ml-2 space-y-4">
        {events.map((event) => {
          let Icon = CheckCircle2;
          let iconColor = "text-apple-blue";
          if (event.eventType === "paper_read") {
            Icon = FileText;
            iconColor = "text-apple-purple";
          } else if (event.eventType === "note_added") {
            Icon = ListTodo;
            iconColor = "text-apple-green";
          } else if (event.eventType === "experiment_logged") {
            Icon = FlaskConical;
            iconColor = "text-apple-orange";
          } else if (event.eventType === "submission_updated") {
            Icon = Send;
            iconColor = "text-apple-blue";
          }
          const label = EVENT_LABELS[event.eventType];

          return (
            <div key={`${event.eventType}-${event.id}`} className="relative pl-6">
              <div className="absolute left-[-11px] top-0.5 flex h-[21px] w-[21px] items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/[0.08]">
                <Icon className={`h-3 w-3 ${iconColor}`} />
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-ink-tertiary mb-0.5">
                  {label ? `${label} · ` : ""}
                  {new Date(event.timestamp).toLocaleString()}
                </span>
                <span className="text-sm text-ink-primary font-medium">
                  {event.title}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
