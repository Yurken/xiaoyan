import { Download, Info, Loader2, RefreshCw } from "lucide-react";
import { Card } from "@research-copilot/ui";
import type { AppUpdateInfo } from "@research-copilot/types";
import type { UpdateState } from "./useSettingsController";
import type { DownloadProgress } from "../../lib/useAutoUpdate";

interface AboutSectionProps {
  appVersion: string;
  loading: boolean;
  updateState: UpdateState;
  updateInfo: AppUpdateInfo | null;
  updateMsg: string;
  updatePublishedAt: string;
  downloadProgress: DownloadProgress | null;
  onCheckUpdate: () => void | Promise<void>;
  onInstallUpdate: () => void | Promise<void>;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function installButtonLabel(state: UpdateState, progress: DownloadProgress | null) {
  if (state !== "installing") return "下载并安装";
  if (!progress) return "准备中…";
  if (progress.status === "finished") return "安装中…";
  if (progress.total && progress.total > 0) {
    const pct = Math.round((progress.downloaded / progress.total) * 100);
    return `下载中… ${pct}%`;
  }
  return `下载中… ${formatBytes(progress.downloaded)}`;
}

function SectionIcon({
  icon: Icon,
  color,
}: {
  icon: typeof RefreshCw;
  color: string;
}) {
  return (
    <div
      className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
      style={{
        background: `${color}12`,
        color,
        boxShadow: "var(--rc-chip-shadow)",
      }}
    >
      <Icon className="w-5 h-5" />
    </div>
  );
}

export default function AboutSection({
  appVersion,
  loading,
  updateState,
  updateInfo,
  updateMsg,
  updatePublishedAt,
  downloadProgress,
  onCheckUpdate,
  onInstallUpdate,
}: AboutSectionProps) {
  const showProgress = updateState === "installing" && downloadProgress !== null;
  const pct = downloadProgress?.total && downloadProgress.total > 0
    ? Math.min(100, Math.round((downloadProgress.downloaded / downloadProgress.total) * 100))
    : null;

  return (
    <div className="space-y-4">
      <Card padding="md" className="space-y-4">
        <div className="flex items-center gap-3">
          <SectionIcon icon={RefreshCw} color="#5AC8FA" />
          <div>
            <h2 className="text-base font-semibold text-ink-primary">桌面端升级</h2>
            <p className="text-xs text-ink-tertiary mt-0.5">发布版会从已配置的更新源检查新版本，并支持一键安装。</p>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr),auto] lg:items-center">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-nm-dark/10 bg-white/35 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-ink-tertiary">当前版本</p>
              <p className="mt-1 text-sm font-semibold text-ink-primary">{appVersion || updateInfo?.current_version || "—"}</p>
            </div>
            <div className="rounded-2xl border border-nm-dark/10 bg-white/35 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-ink-tertiary">最新版本</p>
              <p className="mt-1 text-sm font-semibold text-ink-primary">
                {updateInfo?.available ? updateInfo.version : updateInfo ? "已是最新" : "未检测"}
              </p>
            </div>
            <div className="rounded-2xl border border-nm-dark/10 bg-white/35 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-ink-tertiary">发布时间</p>
              <p className="mt-1 text-sm font-semibold text-ink-primary">{updatePublishedAt || "未提供"}</p>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap lg:justify-end">
            <button
              type="button"
              onClick={() => void onCheckUpdate()}
              disabled={loading || updateState === "checking" || updateState === "installing"}
              className="flex items-center gap-1.5 px-4 py-2 rounded-2xl text-sm font-medium transition-all duration-150 active:scale-95 disabled:opacity-50"
              style={{
                background: "var(--rc-chip-bg)",
                color: "var(--rc-text-soft)",
                boxShadow: "var(--rc-chip-shadow)",
              }}
            >
              {updateState === "checking" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              {updateState === "checking" ? "检查中…" : "检查更新"}
            </button>
            <button
              type="button"
              onClick={() => void onInstallUpdate()}
              disabled={updateState !== "ready"}
              className="flex items-center gap-1.5 px-4 py-2 rounded-2xl text-sm font-semibold text-white transition-all duration-150 active:scale-95 disabled:opacity-50"
              style={{
                background: "linear-gradient(145deg,#1A8AFF,#0062CC)",
                boxShadow: "4px 4px 10px rgba(0,62,204,0.3), -3px -3px 8px rgba(58,155,255,0.15)",
              }}
            >
              {updateState === "installing" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              {installButtonLabel(updateState, downloadProgress)}
            </button>
          </div>
        </div>

        {/* Progress bar */}
        {showProgress && (
          <div className="space-y-1.5">
            <div className="h-1.5 rounded-full" style={{ background: "rgba(0,122,255,0.12)" }}>
              <div
                className="h-1.5 rounded-full transition-all duration-300 ease-out"
                style={{
                  width: pct !== null ? `${pct}%` : "30%",
                  background: "linear-gradient(90deg, #1A8AFF, #0062CC)",
                  ...(pct === null ? { animation: "about-progress-indeterminate 1.5s ease-in-out infinite" } : {}),
                }}
              />
            </div>
            <p className="text-xs text-ink-tertiary text-right">
              {pct !== null ? `${pct}%` : formatBytes(downloadProgress!.downloaded)}
              {downloadProgress?.total ? ` / ${formatBytes(downloadProgress.total)}` : ""}
            </p>
            <style>{`
              @keyframes about-progress-indeterminate {
                0% { transform: translateX(-100%); width: 30%; }
                50% { transform: translateX(50%); width: 40%; }
                100% { transform: translateX(250%); width: 30%; }
              }
            `}</style>
          </div>
        )}

        {updateMsg ? (
          <div
            className={`rounded-2xl border px-4 py-3 text-xs leading-5 ${
              updateState === "error"
                ? "border-red-200 bg-red-50 text-red-600"
                : updateState === "disabled"
                  ? "border-amber-200 bg-amber-50 text-amber-700"
                  : updateState === "ready"
                    ? "border-blue-200 bg-blue-50 text-blue-700"
                    : "border-nm-dark/10 bg-white/35 text-ink-secondary"
            }`}
          >
            {updateMsg}
          </div>
        ) : null}

        {updateInfo?.body ? (
          <div className="rounded-2xl border border-nm-dark/10 bg-white/35 px-4 py-3">
            <p className="text-xs font-semibold text-ink-primary">更新说明</p>
            <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-ink-secondary">{updateInfo.body}</p>
          </div>
        ) : null}
      </Card>

      <Card padding="md" className="space-y-3">
        <div className="flex items-center gap-3">
          <SectionIcon icon={Info} color="#5AC8FA" />
          <div>
            <h2 className="text-base font-semibold text-ink-primary">说明</h2>
            <p className="text-xs text-ink-tertiary mt-0.5">几条最容易混淆的配置规则</p>
          </div>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {[
            "主模型连接是最后的兜底值。没有单独指定的场景，最终都会回退到这里。",
            "按场景选模用于独立功能，比如规划提示、综述写作、论文精读和复现指导。",
            "小妍步骤的专项覆盖只影响小妍任务拆解流程，不影响独立功能页的模型选择。",
            "如果你刚开始配置，建议先填主对话模型、方向提示模型和最终整合模型，其他项之后再细化。",
          ].map((item) => (
            <div key={item} className="rounded-2xl border border-nm-dark/10 bg-white/35 px-4 py-3">
              <p className="text-xs leading-5 text-ink-secondary">{item}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
