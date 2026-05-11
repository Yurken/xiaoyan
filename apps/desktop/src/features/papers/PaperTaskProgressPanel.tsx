import { Loader2 } from "lucide-react";
import type { PaperTaskProgress } from "./shared";

interface PaperTaskProgressPanelProps {
  progress: PaperTaskProgress;
}

export default function PaperTaskProgressPanel({ progress }: PaperTaskProgressPanelProps) {
  const width = `${progress.percent}%`;

  return (
    <div className="mt-3 border-t border-nm-dark/10 pt-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 flex-shrink-0 animate-spin text-apple-blue" />
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-ink-primary">{progress.label}</p>
            <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-ink-tertiary">{progress.detail}</p>
          </div>
        </div>
        <span className="flex-shrink-0 text-[11px] font-semibold text-apple-blue">{progress.percent}%</span>
      </div>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-[rgba(0,122,255,0.12)]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.percent}
        aria-label={progress.label}
      >
        <div
          className="h-full rounded-full bg-apple-blue transition-all duration-500 ease-out"
          style={{ width }}
        />
      </div>
    </div>
  );
}
