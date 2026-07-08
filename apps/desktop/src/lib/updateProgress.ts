import type { AppUpdateInfo } from "@research-copilot/types";

export type DownloadProgressStatus = "started" | "progress" | "installing" | "installed";

export interface DownloadProgress {
  status: DownloadProgressStatus;
  downloaded: number;
  total: number | null;
}

export function formatUpdateBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getUpdateProgressPercent(progress: DownloadProgress | null) {
  if (!progress) return null;
  if (progress.status === "installing" || progress.status === "installed") return 100;
  if (!progress.total || progress.total <= 0) return null;
  return Math.min(100, Math.round((progress.downloaded / progress.total) * 100));
}

export function getUpdateProgressSummary(progress: DownloadProgress) {
  const pct = getUpdateProgressPercent(progress);
  if (pct !== null) {
    return `${pct}%${progress.total ? ` / ${formatUpdateBytes(progress.total)}` : ""}`;
  }
  return formatUpdateBytes(progress.downloaded);
}

export function getUpdateStatusMessage(progress: DownloadProgress | null) {
  if (!progress) return "正在准备下载更新包。";
  switch (progress.status) {
    case "started":
      return "正在准备下载更新包。";
    case "progress":
      return "正在下载更新包，请稍候。";
    case "installing":
      return "下载完成，正在安装更新，请稍候。";
    case "installed":
      return "更新已安装，正在重启应用。";
    default:
      return "正在处理更新。";
  }
}

export function getUpdateButtonLabel(progress: DownloadProgress | null, active: boolean) {
  if (!active) return "下载并安装";
  if (!progress) return "准备下载…";

  switch (progress.status) {
    case "started":
      return "准备下载…";
    case "progress": {
      const pct = getUpdateProgressPercent(progress);
      return pct !== null ? `下载中… ${pct}%` : `下载中… ${formatUpdateBytes(progress.downloaded)}`;
    }
    case "installing":
      return "安装中…";
    case "installed":
      return "重启中…";
    default:
      return "处理中…";
  }
}

export function getUpdateCurrentVersion(info: AppUpdateInfo | null) {
  return info?.currentVersion ?? info?.current_version ?? "";
}

export function getUpdatePublishedAt(info: AppUpdateInfo | null) {
  return info?.pubDate ?? info?.pub_date ?? "";
}
