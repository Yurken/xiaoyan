import type { ResearchFieldBriefing } from "@research-copilot/types";
import { Card } from "@research-copilot/ui";
import { FieldDynamicsActivityChart } from "./FieldDynamicsActivityChart";
import { buildActivityPoints, sumBriefingStats } from "./shared";

interface FieldDynamicsInsightsPanelProps {
  briefings: ResearchFieldBriefing[];
  history: ResearchFieldBriefing[];
  loading: boolean;
}

export function FieldDynamicsInsightsPanel({
  briefings,
  history,
  loading,
}: FieldDynamicsInsightsPanelProps) {
  const stats = sumBriefingStats(briefings);
  const points = buildActivityPoints(history);

  return (
    <Card variant="inset" padding="md" className="mb-4">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-ink-primary">领域活跃度</h2>
          <p className="mt-0.5 text-xs text-ink-tertiary">基于已保存的扫描快照汇总，不把“精选”误当作全部论文量。</p>
        </div>
        <span className="text-xs text-ink-tertiary">{history.length} 条历史简报</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric label="关注领域" value={briefings.length} />
        <Metric label="候选论文" value={stats.candidatePaperCount} />
        <Metric label="精选论文" value={stats.selectedPaperCount} />
        <Metric label="临近截稿" value={stats.deadlineCount} />
      </div>
      <div className="mt-5 border-t border-black/5 pt-4 dark:border-white/10">
        {loading ? <p className="py-5 text-center text-xs text-ink-tertiary">正在加载历史快照…</p> : <FieldDynamicsActivityChart points={points} />}
      </div>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-black/[0.03] px-3 py-2.5 dark:bg-white/[0.05]">
      <div className="text-lg font-bold tabular-nums text-ink-primary">{value}</div>
      <div className="mt-0.5 text-[11px] text-ink-tertiary">{label}</div>
    </div>
  );
}
