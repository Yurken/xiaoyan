import { fireEvent, render, screen } from "@testing-library/react";
import { open } from "@tauri-apps/plugin-shell";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AboutSection from "../../features/settings/AboutSection";
import { GITHUB_REPOSITORY_URL } from "../../lib/links";

describe("AboutSection", () => {
  beforeEach(() => {
    vi.mocked(open).mockClear();
  });

  it("提供 GitHub 仓库入口并通过系统浏览器打开", () => {
    render(
      <AboutSection
        appVersion="0.5.0"
        loading={false}
        updateState="idle"
        updateInfo={null}
        updateMsg=""
        updatePublishedAt=""
        downloadProgress={null}
        onCheckUpdate={vi.fn()}
        onInstallUpdate={vi.fn()}
      />,
    );

    const repositoryLink = screen.getByRole("link", { name: "GitHub" });
    expect(repositoryLink).toHaveAttribute("href", GITHUB_REPOSITORY_URL);

    fireEvent.click(repositoryLink);

    expect(open).toHaveBeenCalledWith(GITHUB_REPOSITORY_URL);
  });
});
