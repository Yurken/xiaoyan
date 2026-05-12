import { Loader2 } from "lucide-react";
import type { PaperTaskProgress, PaperTaskTrackKey, PaperTaskTrackProgress } from "./shared";

interface PaperTaskProgressPanelProps {
  progress: PaperTaskProgress;
}

export default function PaperTaskProgressPanel({ progress }: PaperTaskProgressPanelProps) {
  const width = `${progress.percent}%`;
  const trackEntries = (["analysis", "reproduction"] as PaperTaskTrackKey[])
    .map((key) => progress.tracks?.[key])
    .filter((track): track is PaperTaskTrackProgress => Boolean(track));

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
      {trackEntries.length > 1 ? (
        <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {trackEntries.map((track) => (
            <div
              key={track.label}
              className="rounded-xl px-2.5 py-2"
              style={{ background: "rgba(0,122,255,0.05)" }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[11px] font-medium text-ink-secondary">{track.label}</span>
                <span className="flex-shrink-0 text-[10px] font-semibold text-apple-blue">
                  {track.done ? "完成" : `${track.percent}%`}
                </span>
              </div>
              <p className="mt-0.5 truncate text-[10px] text-ink-tertiary">{track.detail}</p>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/70">
                <div
                  className="h-full rounded-full bg-apple-blue/70 transition-all duration-500 ease-out"
                  style={{ width: `${Math.min(100, Math.max(0, track.percent))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
