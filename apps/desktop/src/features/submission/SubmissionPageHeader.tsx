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
    // 直接置于 rc-app-page 的标准内边距下，与论文库/规划/综述等页面对齐（不再叠加 px-6/app-header 造成双重缩进）。
    <div>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0" />

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
