import { Download, Loader2, RefreshCw, X } from "lucide-react";
import type { AutoUpdateState } from "../lib/useAutoUpdate";

function formatDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export default function UpdateNotification({ updateInfo, installing, install, dismiss }: AutoUpdateState) {
  if (!updateInfo?.available) return null;

  return (
    <div
      className="fixed bottom-5 right-5 z-50 w-[320px] rounded-[28px] p-5 space-y-4"
      style={{
        background: "linear-gradient(145deg, var(--rc-surface), var(--rc-surface))",
        boxShadow: "10px 10px 24px rgba(183,190,199,0.75), -10px -10px 24px rgba(255,255,255,0.9)",
      }}
    >
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
              {updateInfo.pub_date ? ` · ${formatDate(updateInfo.pub_date)}` : ""}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="w-7 h-7 flex-shrink-0 rounded-xl flex items-center justify-center text-ink-tertiary hover:text-ink-secondary transition-colors"
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
          当前 {updateInfo.current_version}
        </span>
        <span className="text-ink-tertiary">→</span>
        <span
          className="rc-accent-chip rounded-xl px-2.5 py-1 font-medium"
        >
          {updateInfo.version}
        </span>
      </div>

      {/* Changelog */}
      {updateInfo.body && (
        <p className="text-xs leading-5 text-ink-secondary line-clamp-3">{updateInfo.body}</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void install()}
          disabled={installing}
          className="flex flex-1 items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl text-sm font-semibold text-white transition-all duration-150 active:scale-95 disabled:opacity-60"
          style={{
            background: "linear-gradient(145deg, #1A8AFF, #0062CC)",
            boxShadow: "4px 4px 10px rgba(0,62,204,0.3), -3px -3px 8px rgba(58,155,255,0.15)",
          }}
        >
          {installing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {installing ? "安装中…" : "下载并安装"}
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="px-4 py-2.5 rounded-2xl text-sm font-medium text-ink-secondary transition-all duration-150 active:scale-95"
          style={{ background: "var(--rc-chip-inset-bg)", boxShadow: "var(--rc-chip-inset-shadow)" }}
        >
          稍后
        </button>
      </div>
    </div>
  );
}
