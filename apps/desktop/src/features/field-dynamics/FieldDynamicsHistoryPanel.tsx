import type { ResearchFieldBriefing } from "@research-copilot/types";
import { FieldDynamicsBriefingCard } from "./FieldDynamicsBriefingCard";

interface FieldDynamicsHistoryPanelProps {
  briefings: ResearchFieldBriefing[];
  importingPaper: { briefingId: string; externalId: string } | null;
  importErrors: Record<string, string>;
  onImportPaper: (briefingId: string, externalId: string, source: string, title: string) => void;
}

export function FieldDynamicsHistoryPanel({
  briefings,
  importingPaper,
  importErrors,
  onImportPaper,
}: FieldDynamicsHistoryPanelProps) {
  if (briefings.length === 0) {
    return <p className="py-8 text-center text-sm text-ink-tertiary">暂未积累历史简报；后续扫描会自动保留快照。</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-bold text-ink-primary">历史简报</h2>
        <p className="mt-0.5 text-xs text-ink-tertiary">可回溯过往判断与论文选择；历史记录不会影响当前的已读状态。</p>
      </div>
      {briefings.map((briefing) => (
        <FieldDynamicsBriefingCard
          key={briefing.id}
          briefing={briefing}
          importingPaper={importingPaper}
          importErrors={importErrors}
          onImportPaper={onImportPaper}
          onMarkRead={() => undefined}
          readOnly
        />
      ))}
    </div>
  );
}
