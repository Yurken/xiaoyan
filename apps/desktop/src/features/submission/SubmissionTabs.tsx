import type { ComponentType } from "react";
import { Calendar, CheckSquare, GitBranch, History, KanbanSquare } from "lucide-react";

export const SUBMISSION_TAB_KEYS = ["conferences", "kanban", "checklist", "versions", "reviews"] as const;
export type SubmissionTab = (typeof SUBMISSION_TAB_KEYS)[number];

const SUBMISSION_TABS: Array<{
  key: SubmissionTab;
  icon: ComponentType<{ className?: string }>;
  label: string;
}> = [
  { key: "conferences", icon: Calendar, label: "DDL 日历" },
  { key: "kanban", icon: KanbanSquare, label: "投稿看板" },
  { key: "checklist", icon: CheckSquare, label: "提交清单" },
  { key: "versions", icon: GitBranch, label: "版本控制" },
  { key: "reviews", icon: History, label: "审稿归档" },
];

interface SubmissionTabsProps {
  activeTab: SubmissionTab;
  onTabChange: (tab: SubmissionTab) => void;
}

export default function SubmissionTabs({ activeTab, onTabChange }: SubmissionTabsProps) {
  return (
    <div
      className="inline-flex rounded-2xl p-1 gap-0.5"
      style={{ background: "var(--rc-surface)", boxShadow: "var(--rc-inset-shadow)" }}
    >
      {SUBMISSION_TABS.map(({ key, icon: Icon, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => onTabChange(key)}
          className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-150"
          style={
            activeTab === key
              ? { background: "var(--rc-elevated)", boxShadow: "var(--rc-raised-shadow)", color: "var(--rc-text)" }
              : { color: "var(--rc-text-muted)" }
          }
        >
          <Icon className="h-4 w-4" />
          {label}
        </button>
      ))}
    </div>
  );
}
