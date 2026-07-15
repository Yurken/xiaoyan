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
    <div className="flex flex-wrap items-center justify-between gap-3">
      <SubmissionTabs activeTab={activeTab} onTabChange={onTabChange} />
      <div className="flex flex-wrap gap-2">
        {statItems.map((stat) => (
          <div
            key={stat.key}
            className="flex items-center gap-1.5 rounded-2xl px-3 py-1.5"
            style={{ background: "var(--rc-chip-bg)", boxShadow: "var(--rc-chip-shadow)" }}
          >
            <span className="text-lg font-bold tabular-nums" style={{ color: stat.color }}>
              {stats[stat.key]}
            </span>
            <span className="text-[11px] text-ink-tertiary">{stat.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
