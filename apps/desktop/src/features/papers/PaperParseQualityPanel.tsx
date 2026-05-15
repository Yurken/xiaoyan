import { AlertTriangle, CheckCircle2, FileScan, Loader2, Timer } from "lucide-react";
import type { PaperParseRun } from "./shared";

interface PaperParseQualityPanelProps {
  runs: PaperParseRun[];
  loading: boolean;
}

const STATUS_STYLE: Record<PaperParseRun["status"], { label: string; color: string; bg: string }> = {
  done: { label: "解析完成", color: "#34C759", bg: "rgba(52,199,89,0.10)" },
  failed: { label: "解析失败", color: "#FF3B30", bg: "rgba(255,59,48,0.10)" },
  running: { label: "解析中", color: "#007AFF", bg: "rgba(0,122,255,0.10)" },
};

function formatCount(value: number): string {
  if (value >= 10000) {
    return `${(value / 10000).toFixed(1)} 万`;
  }
  return value.toLocaleString("zh-CN");
}

function formatDuration(value?: number): string {
  if (!value || value <= 0) {
    return "未记录";
  }
  if (value < 1000) {
    return `${value} ms`;
  }
  return `${(value / 1000).toFixed(1)} s`;
}

export default function PaperParseQualityPanel({ runs, loading }: PaperParseQualityPanelProps) {
  const latest = runs[0];
  const statusStyle = latest ? STATUS_STYLE[latest.status] : null;

  return (
    <section
      className="rounded-[22px] px-4 py-3"
      style={{ background: "rgba(15,23,42,0.035)", border: "1px solid rgba(15,23,42,0.06)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileScan className="h-4 w-4 text-[#5856D6]" />
          <p className="text-sm font-semibold text-ink-primary">解析质量</p>
        </div>
        {loading ? <Loader2 className="h-4 w-4 animate-spin text-ink-tertiary" /> : null}
      </div>

      {!latest ? (
        <p className="mt-2 text-xs leading-5 text-ink-tertiary">暂无解析运行记录。</p>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-bold"
              style={{ background: statusStyle?.bg, color: statusStyle?.color }}
            >
              {latest.status === "failed" ? <AlertTriangle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
              {statusStyle?.label}
            </span>
            <span className="rounded-lg px-2 py-0.5 text-[11px] text-ink-tertiary" style={{ background: "rgba(255,255,255,0.65)" }}>
              {latest.parserName}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] text-ink-tertiary">
              <Timer className="h-3 w-3" />
              {formatDuration(latest.durationMs)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              ["正文", formatCount(latest.textLength)],
              ["预览", formatCount(latest.previewLength)],
              ["章节", formatCount(latest.sectionCount)],
              ["图表", formatCount(latest.figureCount)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl px-3 py-2" style={{ background: "rgba(255,255,255,0.62)" }}>
                <p className="text-[11px] text-ink-tertiary">{label}</p>
                <p className="mt-0.5 text-sm font-semibold text-ink-primary">{value}</p>
              </div>
            ))}
          </div>

          {latest.fallbackPath || latest.error ? (
            <p className="rounded-2xl px-3 py-2 text-xs leading-5 text-ink-secondary" style={{ background: "rgba(255,149,0,0.08)" }}>
              {latest.error ?? `回退路径：${latest.fallbackPath}`}
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
