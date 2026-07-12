import { AlertCircle, Download, Globe, Loader2, RefreshCw, X } from "lucide-react";
import { OFFICIAL_SITE_URL, openLink } from "../lib/links";
import type { AutoUpdateState, DownloadProgress } from "../lib/useAutoUpdate";
import {
  getUpdateButtonLabel,
  getUpdateCurrentVersion,
  getUpdatePublishedAt,
  getUpdateProgressPercent,
  getUpdateProgressSummary,
  getUpdateStatusMessage,
} from "../lib/updateProgress";

function formatDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function ProgressBar({ progress }: { progress: DownloadProgress | null }) {
  if (!progress) return null;
  const pct = getUpdateProgressPercent(progress);
  return (
    <div className="space-y-1.5">
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(0,122,255,0.12)" }}>
        <div
          className="h-1.5 rounded-full transition-all duration-300 ease-out"
          style={{
            width: pct !== null ? `${pct}%` : "30%",
            background: "linear-gradient(90deg, #1A8AFF, #0062CC)",
            ...(pct === null ? { animation: "update-progress-indeterminate 1.5s ease-in-out infinite" } : {}),
          }}
        />
      </div>
      <p className="text-[11px] text-ink-tertiary text-right">
        {getUpdateProgressSummary(progress)}
      </p>
    </div>
  );
}

export default function UpdateNotification({
  updateInfo,
  installing,
  downloadProgress,
  installError,
  install,
  dismiss,
}: AutoUpdateState) {
  if (!updateInfo?.available) return null;

  const label = getUpdateButtonLabel(downloadProgress, installing);
  const showProgress = installing && downloadProgress !== null;
  const statusMessage = installing ? getUpdateStatusMessage(downloadProgress) : "";
  const publishedAt = getUpdatePublishedAt(updateInfo);

  return (
    <div
      className="fixed bottom-5 right-5 z-50 w-[320px] rounded-[28px] p-5 space-y-4"
      style={{
        background: "linear-gradient(145deg, var(--rc-surface), var(--rc-surface))",
        boxShadow: "10px 10px 24px rgba(183,190,199,0.75), -10px -10px 24px rgba(255,255,255,0.9)",
      }}
    >
      <style>{`
        @keyframes update-progress-indeterminate {
          0% { transform: translateX(-100%); width: 30%; }
          50% { transform: translateX(50%); width: 40%; }
          100% { transform: translateX(250%); width: 30%; }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white flex-shrink-0"
            style={{
              background: "linear-gradient(145deg, #1A8AFF, #0062CC)",
              boxShadow: "3px 3px 8px rgba(0,62,204,0.4), -2px -2px 6px rgba(58,155,255,0.25)",
            }}
          >
            <RefreshCw className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-ink-primary">发现新版本</p>
            <p className="text-xs text-ink-tertiary mt-0.5">
              {updateInfo.version}
              {publishedAt ? ` · ${formatDate(publishedAt)}` : ""}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          disabled={installing}
          className="w-7 h-7 flex-shrink-0 rounded-xl flex items-center justify-center text-ink-tertiary hover:text-ink-secondary transition-colors disabled:opacity-40"
          style={{ background: "var(--rc-chip-inset-bg)", boxShadow: "var(--rc-chip-inset-shadow)" }}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Version chips */}
      <div className="flex items-center gap-2 text-xs">
        <span
          className="rounded-xl px-2.5 py-1 text-ink-tertiary"
          style={{ background: "var(--rc-chip-inset-bg)", boxShadow: "var(--rc-chip-inset-shadow)" }}
        >
          当前 {getUpdateCurrentVersion(updateInfo)}
        </span>
        <span className="text-ink-tertiary">→</span>
        <span
          className="rc-accent-chip rounded-xl px-2.5 py-1 font-medium"
        >
          {updateInfo.version}
        </span>
      </div>

      {/* Changelog */}
      {updateInfo.body && !showProgress && !installError && (
        <p className="text-xs leading-5 text-ink-secondary line-clamp-3">{updateInfo.body}</p>
      )}

      {statusMessage && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-700">
          {statusMessage}
        </div>
      )}

      {installError && !installing && (
        <div className="flex gap-2 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-600">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <span>安装失败：{installError}</span>
        </div>
      )}

      {/* Progress bar */}
      {showProgress && <ProgressBar progress={downloadProgress} />}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void install()}
          disabled={installing}
          className="flex min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap px-3 py-2.5 rounded-2xl text-sm font-semibold text-white transition-all duration-150 active:scale-95 disabled:opacity-60"
          style={{
            background: "linear-gradient(145deg, #1A8AFF, #0062CC)",
            boxShadow: "4px 4px 10px rgba(0,62,204,0.3), -3px -3px 8px rgba(58,155,255,0.15)",
          }}
        >
          {installing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {installError && !installing ? "重试下载并安装" : label}
        </button>
        <button
          type="button"
          onClick={() => void openLink(OFFICIAL_SITE_URL)}
          className="flex items-center justify-center gap-1.5 whitespace-nowrap px-3 py-2.5 rounded-2xl text-sm font-medium text-ink-secondary transition-all duration-150 active:scale-95"
          style={{ background: "var(--rc-chip-inset-bg)", boxShadow: "var(--rc-chip-inset-shadow)" }}
        >
          <Globe className="w-3.5 h-3.5" />
          官网
        </button>
        <button
          type="button"
          onClick={dismiss}
          disabled={installing}
          className="whitespace-nowrap px-3 py-2.5 rounded-2xl text-sm font-medium text-ink-secondary transition-all duration-150 active:scale-95 disabled:opacity-40"
          style={{ background: "var(--rc-chip-inset-bg)", boxShadow: "var(--rc-chip-inset-shadow)" }}
        >
          稍后
        </button>
      </div>
    </div>
  );
}
