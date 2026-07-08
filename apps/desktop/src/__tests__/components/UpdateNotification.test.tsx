import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import UpdateNotification from "../../components/UpdateNotification";
import type { AutoUpdateState } from "../../lib/useAutoUpdate";

function renderNotification(overrides: Partial<AutoUpdateState> = {}) {
  const state: AutoUpdateState = {
    updateInfo: {
      configured: true,
      available: true,
      currentVersion: "0.4.6",
      version: "0.4.7",
      body: "更新说明",
      pubDate: "2026-07-08T00:00:00Z",
    },
    installing: false,
    downloadProgress: null,
    installError: "",
    install: vi.fn(),
    dismiss: vi.fn(),
    ...overrides,
  };

  render(<UpdateNotification {...state} />);
  return state;
}

describe("UpdateNotification", () => {
  it("下载完成后显示正在安装", () => {
    renderNotification({
      installing: true,
      downloadProgress: { status: "installing", downloaded: 100, total: 100 },
    });

    expect(screen.getByText("下载完成，正在安装更新，请稍候。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /安装中/ })).toBeDisabled();
  });

  it("安装失败时显示错误并允许重试", () => {
    const state = renderNotification({ installError: "网络连接失败" });

    expect(screen.getByText("安装失败：网络连接失败")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "重试下载并安装" }));

    expect(state.install).toHaveBeenCalledTimes(1);
  });
});
