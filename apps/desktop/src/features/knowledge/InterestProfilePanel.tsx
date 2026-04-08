export interface InterestProfileHighlight {
  label: string;
  value: string;
}

interface InterestProfilePanelProps {
  highlights: InterestProfileHighlight[];
  constraints?: string[] | null;
}

const shellStyle = {
  background: "var(--rc-card-inset-bg)",
  border: "1px solid var(--rc-card-inset-outline)",
  boxShadow: "var(--rc-card-inset-shadow)",
};

const highlightStyle = {
  background: "var(--rc-card-bg)",
  border: "1px solid var(--rc-card-outline)",
  boxShadow: "var(--rc-card-shadow)",
};

export default function InterestProfilePanel({ highlights, constraints }: InterestProfilePanelProps) {
  const constraintList = constraints?.filter(Boolean) ?? [];

  if (highlights.length === 0 && constraintList.length === 0) {
    return null;
  }

  return (
    <section className="mt-3 rounded-[24px] p-3.5" style={shellStyle}>
      <div className="flex items-center gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-tertiary">研究画像</p>
        <span className="h-1.5 w-1.5 rounded-full bg-apple-blue/70" aria-hidden="true" />
      </div>

      {highlights.length > 0 && (
        <div className="mt-3 grid gap-2.5 lg:grid-cols-3">
          {highlights.map((item) => (
            <div
              key={item.label}
              className="rounded-[20px] px-3.5 py-3"
              style={highlightStyle}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-tertiary">{item.label}</p>
              <p className="mt-1.5 text-sm leading-5 text-ink-secondary">{item.value}</p>
            </div>
          ))}
        </div>
      )}

      {constraintList.length > 0 && (
        <div className="mt-4 border-t pt-3" style={{ borderColor: "rgb(var(--rc-border-rgb) / 0.55)" }}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-tertiary">约束条件</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {constraintList.map((constraint) => (
              <span
                key={constraint}
                className="rc-accent-chip rounded-full px-3 py-1.5 text-[11px] font-medium"
              >
                {constraint}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
