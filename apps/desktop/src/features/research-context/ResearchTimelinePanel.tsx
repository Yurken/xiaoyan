import { CheckCircle2, FileText, ListTodo } from "lucide-react";
import type { ResearchActivityEvent } from "./shared";

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
          }

          return (
            <div key={event.id} className="relative pl-6">
              <div className="absolute left-[-11px] top-0.5 flex h-[21px] w-[21px] items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/[0.08]">
                <Icon className={`h-3 w-3 ${iconColor}`} />
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-ink-tertiary mb-0.5">
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
