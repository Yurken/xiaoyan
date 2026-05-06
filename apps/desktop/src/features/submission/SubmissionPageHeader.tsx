import SubmissionTabs, { type SubmissionTab } from "./SubmissionTabs";

interface SubmissionPageHeaderProps {
  activeTab: SubmissionTab;
  conferencesCount: number;
  journalsCount: number;
  activeCount: number;
  acceptedCount: number;
  onTabChange: (tab: SubmissionTab) => void;
}

const statItems = [
  { key: "conferencesCount", label: "追踪会议", color: "var(--rc-accent)" },
  { key: "journalsCount", label: "追踪期刊", color: "var(--rc-text-soft)" },
  { key: "activeCount", label: "进行中", color: "#FF9500" },
  { key: "acceptedCount", label: "已接收", color: "#34C759" },
] as const;

export default function SubmissionPageHeader({
  activeTab,
  conferencesCount,
  journalsCount,
  activeCount,
  acceptedCount,
  onTabChange,
}: SubmissionPageHeaderProps) {
  const stats = { conferencesCount, journalsCount, activeCount, acceptedCount };

  return (
    <div className="flex-shrink-0 px-6 pt-5 pb-3">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-ink-primary">投稿管理</h1>
          <p className="mt-1 text-sm text-ink-tertiary">追踪会议和期刊的截稿日期，小妍陪你走完论文投稿的每一步。</p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex">
          {statItems.map((stat) => (
            <div
              key={stat.key}
              className="min-w-[92px] rounded-2xl px-3.5 py-2"
              style={{ background: "var(--rc-chip-bg)", boxShadow: "var(--rc-chip-shadow)" }}
            >
              <p className="text-[11px] text-ink-tertiary">{stat.label}</p>
              <p className="mt-0.5 text-xl font-bold tabular-nums" style={{ color: stat.color }}>
                {stats[stat.key]}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <SubmissionTabs activeTab={activeTab} onTabChange={onTabChange} />
      </div>
    </div>
  );
}
