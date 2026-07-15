import { Loader2 } from "lucide-react";
import type { ResearchFieldBriefing } from "@research-copilot/types";
import { FieldDynamicsBriefingCard } from "./FieldDynamicsBriefingCard";

interface FieldDynamicsPanelProps {
  briefings: ResearchFieldBriefing[];
  loading: boolean;
  importingPaper: { briefingId: string; externalId: string } | null;
  importErrors: Record<string, string>;
  onImportPaper: (
    briefingId: string,
    externalId: string,
    source: string,
    title: string,
  ) => void;
  onMarkRead: (id: string) => void;
}

export function FieldDynamicsPanel({
  briefings,
  loading,
  importingPaper,
  importErrors,
  onImportPaper,
  onMarkRead,
}: FieldDynamicsPanelProps) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-ink-tertiary" />
        <p className="text-sm text-ink-tertiary">正在加载领域简报…</p>
      </div>
    );
  }

  if (briefings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2">
        <p className="text-sm text-ink-tertiary">暂无领域简报</p>
        <p className="text-xs text-ink-tertiary">点击「立即刷新」让小妍生成最新简报</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {briefings.map((briefing) => (
        <FieldDynamicsBriefingCard
          key={briefing.id}
          briefing={briefing}
          importingPaper={importingPaper}
          importErrors={importErrors}
          onImportPaper={onImportPaper}
          onMarkRead={onMarkRead}
        />
      ))}
    </div>
  );
}
