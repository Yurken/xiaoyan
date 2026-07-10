import { Target, Timer, Package, Ruler, Tag } from "lucide-react";

export interface InterestProfileHighlight {
  label: string;
  value: string;
}

interface InterestProfilePanelProps {
  highlights: InterestProfileHighlight[];
  // 兼容旧数据库中偶尔以单个字符串保存的画像字段。
  constraints?: string[] | string | null;
  keywords?: string[] | string | null;
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

function getIcon(label: string) {
  switch (label) {
    case "目标":
      return <Target className="h-3.5 w-3.5 text-apple-blue" />;
    case "时间":
      return <Timer className="h-3.5 w-3.5 text-apple-green" />;
    case "输出":
      return <Package className="h-3.5 w-3.5 text-apple-purple" />;
    default:
      return <Ruler className="h-3.5 w-3.5 text-ink-tertiary" />;
  }
}

export default function InterestProfilePanel({ highlights, constraints, keywords }: InterestProfilePanelProps) {
  const normalizeList = (value: string[] | string | null | undefined) => {
    if (Array.isArray(value)) return value.filter(Boolean);
    if (typeof value === "string" && value.trim()) return [value.trim()];
    return [];
  };
  const constraintList = normalizeList(constraints);
  const keywordList = normalizeList(keywords);

  if (highlights.length === 0 && constraintList.length === 0 && keywordList.length === 0) {
    return null;
  }

  return (
    <section className="rounded-[24px] p-4" style={shellStyle}>
      <div className="flex items-center gap-2 px-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-tertiary">研究画像</p>
        <span className="h-1.5 w-1.5 rounded-full bg-apple-blue/70" aria-hidden="true" />
      </div>

      {highlights.length > 0 && (
        <div className="mt-3.5 grid gap-3 lg:grid-cols-3">
          {highlights.map((item) => (
            <div
              key={item.label}
              className="group flex flex-col gap-2.5 rounded-[20px] px-4 py-3.5 transition-all hover:shadow-md"
              style={highlightStyle}
            >
              <div className="flex items-center gap-2">
                {getIcon(item.label)}
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-tertiary">{item.label}</p>
              </div>
              <p className="text-sm leading-6 text-ink-primary font-medium">{item.value}</p>
            </div>
          ))}
        </div>
      )}

      {(keywordList.length > 0 || constraintList.length > 0) && (
        <div className="mt-5 border-t pt-4" style={{ borderColor: "rgb(var(--rc-border-rgb) / 0.45)" }}>
          <div className="grid gap-5 md:grid-cols-2">
            {keywordList.length > 0 && (
              <div>
                <div className="flex items-center gap-2 px-1 mb-3">
                  <Tag className="h-3 w-3 text-apple-blue" />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-tertiary">关键词</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {keywordList.map((keyword) => (
                    <span
                      key={keyword}
                      className="rc-accent-chip rounded-full px-3 py-1 text-[11px] font-medium"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {constraintList.length > 0 && (
              <div>
                <div className="flex items-center gap-2 px-1 mb-3">
                  <Ruler className="h-3 w-3 text-apple-orange" />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-tertiary">约束条件</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {constraintList.map((constraint) => (
                    <span
                      key={constraint}
                      className="flex items-center gap-1.5 rounded-full bg-white/40 px-3 py-1 text-[11px] font-medium text-ink-secondary border border-nm-dark/5 shadow-sm"
                    >
                      <div className="h-1 w-1 rounded-full bg-apple-orange/60" />
                      {constraint}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
