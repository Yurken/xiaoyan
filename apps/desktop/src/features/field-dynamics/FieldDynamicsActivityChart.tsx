import type { FieldDynamicsActivityPoint } from "./shared";

interface FieldDynamicsActivityChartProps {
  points: FieldDynamicsActivityPoint[];
}

export function FieldDynamicsActivityChart({ points }: FieldDynamicsActivityChartProps) {
  if (points.length === 0) {
    return <p className="py-5 text-center text-xs text-ink-tertiary">生成简报后，这里会显示领域活跃度变化。</p>;
  }

  const maxValue = Math.max(...points.map((point) => point.candidatePaperCount), 1);
  const coordinates = points.map((point, index) => {
    const x = points.length === 1 ? 50 : (index / (points.length - 1)) * 100;
    const y = 34 - (point.candidatePaperCount / maxValue) * 28;
    return `${x},${y}`;
  });

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-[11px] text-ink-tertiary">
        <span>候选论文活跃度</span>
        <span>近 {points.length} 次采样</span>
      </div>
      <svg viewBox="0 0 100 40" className="h-20 w-full overflow-visible" role="img" aria-label="候选论文活跃度趋势">
        <line x1="0" x2="100" y1="34" y2="34" stroke="currentColor" className="text-black/10 dark:text-white/15" strokeWidth="0.7" />
        <polyline fill="none" points={coordinates.join(" ")} stroke="currentColor" className="text-brand-500" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {points.map((point, index) => {
          const [x, y] = coordinates[index].split(",");
          return <circle key={point.label} cx={x} cy={y} r="1.7" className="fill-brand-500" />;
        })}
      </svg>
      <div className="flex justify-between gap-2 text-[10px] text-ink-tertiary">
        <span>{points[0].label}</span>
        <span>{points.at(-1)?.label}</span>
      </div>
    </div>
  );
}
