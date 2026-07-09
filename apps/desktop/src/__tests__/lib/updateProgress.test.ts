import { describe, expect, it } from "vitest";
import {
  getUpdateButtonLabel,
  getUpdateCurrentVersion,
  getUpdatePublishedAt,
  getUpdateProgressPercent,
  getUpdateStatusMessage,
  type DownloadProgress,
} from "../../lib/updateProgress";

describe("updateProgress", () => {
  it("区分下载、安装和重启状态", () => {
    const downloading: DownloadProgress = { status: "progress", downloaded: 40, total: 100 };
    const installing: DownloadProgress = { status: "installing", downloaded: 100, total: 100 };
    const installed: DownloadProgress = { status: "installed", downloaded: 100, total: 100 };

    expect(getUpdateButtonLabel(downloading, true)).toBe("下载中… 40%");
    expect(getUpdateButtonLabel(installing, true)).toBe("安装中…");
    expect(getUpdateButtonLabel(installed, true)).toBe("重启中…");
    expect(getUpdateStatusMessage(installing)).toBe("下载完成，正在安装更新，请稍候。");
    expect(getUpdateProgressPercent(installed)).toBe(100);
  });

  it("兼容 Tauri 返回的 camelCase 字段和旧 snake_case 字段", () => {
    expect(getUpdateCurrentVersion({
      configured: true,
      available: true,
      currentVersion: "0.4.6",
      pubDate: "2026-07-08T00:00:00Z",
    })).toBe("0.4.6");
    expect(getUpdatePublishedAt({
      configured: true,
      available: true,
      current_version: "0.4.5",
      pub_date: "2026-07-07T00:00:00Z",
    })).toBe("2026-07-07T00:00:00Z");
  });
});
