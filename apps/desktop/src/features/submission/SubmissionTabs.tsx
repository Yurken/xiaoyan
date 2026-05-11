import { Calendar, CheckSquare, GitBranch, History, KanbanSquare } from "lucide-react";
import { CapsuleTabs } from "@research-copilot/ui";

export const SUBMISSION_TAB_KEYS = ["conferences", "kanban", "checklist", "versions", "reviews"] as const;
export type SubmissionTab = (typeof SUBMISSION_TAB_KEYS)[number];

const SUBMISSION_TABS = [
  { value: "conferences", icon: <Calendar className="h-4 w-4" />, label: "DDL 日历" },
  { value: "kanban", icon: <KanbanSquare className="h-4 w-4" />, label: "投稿看板" },
  { value: "checklist", icon: <CheckSquare className="h-4 w-4" />, label: "提交清单" },
  { value: "versions", icon: <GitBranch className="h-4 w-4" />, label: "版本控制" },
  { value: "reviews", icon: <History className="h-4 w-4" />, label: "审稿归档" },
] as const;

interface SubmissionTabsProps {
  activeTab: SubmissionTab;
  onTabChange: (tab: SubmissionTab) => void;
}

export default function SubmissionTabs({ activeTab, onTabChange }: SubmissionTabsProps) {
  return (
    <CapsuleTabs
      options={SUBMISSION_TABS.map((t) => ({ value: t.value, label: t.label, icon: t.icon }))}
      value={activeTab}
      onChange={(v) => onTabChange(v as SubmissionTab)}
    />
  );
}
