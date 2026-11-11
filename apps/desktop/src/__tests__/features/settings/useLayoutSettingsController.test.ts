import { act, renderHook } from "@testing-library/react";
import { relaunch } from "@tauri-apps/plugin-process";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLayoutSettingsController } from "../../../features/settings/useLayoutSettingsController";

describe("useLayoutSettingsController 页面风格", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-style");
    vi.mocked(relaunch).mockClear();
  });

  it("切换风格立即应用且不触发布局重启，重新进入后保留选择", () => {
    const first = renderHook(() => useLayoutSettingsController());

    act(() => first.result.current.changeStyle("modern-minimal"));

    expect(document.documentElement).toHaveAttribute("data-style", "modern-minimal");
    expect(first.result.current.currentStyle).toBe("modern-minimal");
    expect(localStorage.getItem("rc_style")).toBe("modern-minimal");
    expect(first.result.current.pendingLayout).toBe("landscape");
    expect(relaunch).not.toHaveBeenCalled();

    first.unmount();
    const second = renderHook(() => useLayoutSettingsController());
    expect(second.result.current.currentStyle).toBe("modern-minimal");

    act(() => second.result.current.changeStyle("neumorphic"));
    expect(document.documentElement).toHaveAttribute("data-style", "neumorphic");
    expect(localStorage.getItem("rc_style")).toBe("neumorphic");
    expect(relaunch).not.toHaveBeenCalled();
  });
});
