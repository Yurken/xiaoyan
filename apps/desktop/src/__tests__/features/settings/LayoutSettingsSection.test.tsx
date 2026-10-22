import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { relaunch } from "@tauri-apps/plugin-process";
import { useLayoutSettingsController } from "../../../features/settings/useLayoutSettingsController";
import LayoutSettingsSection from "../../../features/settings/LayoutSettingsSection";
import { fireEvent, renderWithRouter, screen } from "../../helpers/render";

function LayoutSettingsHarness() {
  const {
    currentTheme,
    currentStyle,
    pendingLayout,
    changeTheme,
    changeStyle,
    changeLayout,
  } = useLayoutSettingsController();

  return (
    <LayoutSettingsSection
      currentTheme={currentTheme}
      currentStyle={currentStyle}
      pendingLayout={pendingLayout}
      onThemeChange={changeTheme}
      onStyleChange={changeStyle}
      onLayoutChange={changeLayout}
    />
  );
}

function option(title: string) {
  return screen.getByRole("button", {
    name: (accessibleName) => accessibleName.trim().startsWith(title),
  });
}

describe("界面布局里的风格切换", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    document.documentElement.removeAttribute("data-style");
    document.documentElement.removeAttribute("data-theme");
    vi.mocked(relaunch).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("点选极简和拟态立即切换 data-style，且不重启；深浅色不改风格", () => {
    renderWithRouter(<LayoutSettingsHarness />);

    expect(option("拟态")).toBeInTheDocument();
    expect(option("极简")).toBeInTheDocument();
    expect(option("拟态")).toHaveAttribute("aria-pressed", "true");
    expect(option("极简")).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(option("极简"));
    expect(option("极简")).toHaveAttribute("aria-pressed", "true");
    expect(option("拟态")).toHaveAttribute("aria-pressed", "false");
    expect(document.documentElement.getAttribute("data-style")).toBe("modern-minimal");
    vi.advanceTimersByTime(1000);
    expect(relaunch).not.toHaveBeenCalled();

    fireEvent.click(option("拟态"));
    expect(option("拟态")).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement.getAttribute("data-style")).toBe("neumorphic");

    fireEvent.click(option("浅色"));
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(document.documentElement.getAttribute("data-style")).toBe("neumorphic");
    expect(option("浅色")).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(option("深色"));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.getAttribute("data-style")).toBe("neumorphic");
    expect(option("深色")).toHaveAttribute("aria-pressed", "true");
    vi.advanceTimersByTime(1000);
    expect(relaunch).not.toHaveBeenCalled();
  });
});
