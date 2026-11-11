import {
  CS_GROUPS,
  DOMAIN_VENUES,
  NON_CS_KEYS,
  TOOL_PRIMARY_STYLE,
  TOOL_SECONDARY_STYLE,
  TOOL_SELECTED_CHIP_STYLE,
} from "./shared";

interface PaperDiscoveryDomainPickerProps {
  selectedDomains: string[];
  onDomainsChange: (value: string[]) => void;
  onClear: () => void;
}

export function PaperDiscoveryDomainPicker({
  selectedDomains,
  onDomainsChange,
  onClear,
}: PaperDiscoveryDomainPickerProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold tracking-wide text-ink-tertiary">
          步骤 1 · 研究领域
          <span className="ml-1 font-normal">（可多选）</span>
        </label>
        {selectedDomains.length > 0 ? (
          <button
            type="button"
            onClick={onClear}
            className="text-[11px] text-ink-tertiary transition-colors hover:text-apple-red"
          >
            清空筛选
          </button>
        ) : null}
      </div>

      <div className="space-y-2 rounded-xl p-2.5" style={{ background: "var(--rc-elevated)", boxShadow: "var(--rc-inset-shadow)" }}>
        <p className="px-0.5 text-[10px] font-semibold uppercase tracking-widest text-ink-tertiary">计算机科学</p>
        {CS_GROUPS.map((group) => {
          const groupKeys = group.keys;
          const allSelected = groupKeys.every((key) => selectedDomains.includes(key));
          const someSelected = groupKeys.some((key) => selectedDomains.includes(key));
          return (
            <div key={group.label} className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                aria-pressed={allSelected}
                onClick={() =>
                  onDomainsChange(
                    allSelected
                      ? selectedDomains.filter((key) => !groupKeys.includes(key))
                      : [...new Set([...selectedDomains, ...groupKeys])]
                  )
                }
                className="shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-semibold transition-all duration-100 active:scale-95"
                style={
                  allSelected
                    ? TOOL_PRIMARY_STYLE
                    : someSelected
                      ? TOOL_SELECTED_CHIP_STYLE
                      : TOOL_SECONDARY_STYLE
                }
              >
                {group.label}
              </button>
              <span className="text-ink-tertiary" style={{ fontSize: 10 }}>
                ›
              </span>
              {groupKeys.map((key) => {
                const domain = DOMAIN_VENUES[key];
                const selected = selectedDomains.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={selected}
                    onClick={() =>
                      onDomainsChange(
                        selected
                          ? selectedDomains.filter((value) => value !== key)
                          : [...selectedDomains, key]
                      )
                    }
                    className="rounded-xl px-2.5 py-1 text-xs font-medium transition-all duration-100 active:scale-95"
                    style={
                      selected
                        ? TOOL_PRIMARY_STYLE
                        : TOOL_SECONDARY_STYLE
                    }
                  >
                    {domain?.label}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="space-y-1.5">
        <p className="px-0.5 text-[10px] font-semibold uppercase tracking-widest text-ink-tertiary">其他领域</p>
        <div className="flex flex-wrap gap-1.5">
          {NON_CS_KEYS.map((key) => {
            const domain = DOMAIN_VENUES[key];
            const selected = selectedDomains.includes(key);
            return (
              <button
                key={key}
                type="button"
                aria-pressed={selected}
                onClick={() =>
                  onDomainsChange(
                    selected
                      ? selectedDomains.filter((value) => value !== key)
                      : [...selectedDomains, key]
                  )
                }
                className="rounded-xl px-2.5 py-1 text-xs font-medium transition-all duration-100 active:scale-95"
                style={
                  selected
                    ? TOOL_PRIMARY_STYLE
                    : TOOL_SECONDARY_STYLE
                }
              >
                {domain?.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
