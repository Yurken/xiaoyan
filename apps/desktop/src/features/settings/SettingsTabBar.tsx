import type { SETTINGS_SECTIONS, SettingsSectionKey } from "./pageConfig";

export default function SettingsTabBar({
  sections,
  activeSection,
  onSelect,
}: {
  sections: typeof SETTINGS_SECTIONS;
  activeSection: SettingsSectionKey;
  onSelect: (key: SettingsSectionKey) => void;
}) {
  return (
    <nav
      aria-label="设置分区"
      className="grid min-w-0 gap-1 rounded-[24px] p-1"
      style={{
        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 7.5rem), 1fr))",
        background: "var(--rc-chip-inset-bg)",
        border: "1px solid var(--rc-card-inset-outline)",
        boxShadow: "var(--rc-chip-inset-shadow)",
      }}
    >
      {sections.map((item) => {
        const active = activeSection === item.key;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelect(item.key)}
            aria-pressed={active}
            title={item.description}
            className="flex min-w-0 items-center justify-center gap-2 rounded-2xl px-2 py-2 text-[13px] font-semibold transition-colors"
            style={{
              background: active ? "var(--rc-nav-item-active-bg)" : "transparent",
              color: active ? "var(--rc-nav-item-active-text)" : "var(--rc-text-soft)",
              border: `1px solid ${active ? "var(--rc-nav-item-active-border)" : "transparent"}`,
              boxShadow: active ? "var(--rc-card-flat-shadow)" : "none",
            }}
          >
            <item.icon aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span className="whitespace-nowrap leading-5">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
