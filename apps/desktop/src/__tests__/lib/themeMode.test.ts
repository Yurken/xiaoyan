import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getThemePreference,
  getTheme,
  setTheme,
  applyTheme,
  watchSystemTheme,
} from "../../lib/themeMode";

function mockSystemPrefersDark(dark: boolean) {
  let changeHandler: (() => void) | null = null;
  const mq = {
    matches: dark,
    media: "(prefers-color-scheme: dark)",
    addEventListener: vi.fn((_: string, cb: () => void) => {
      changeHandler = cb;
    }),
    removeEventListener: vi.fn(),
  };
  (window.matchMedia as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mq);
  return {
    triggerChange: () => changeHandler?.(),
    mq,
  };
}

describe("themeMode 偏好与解析", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("未设置时偏好为 auto", () => {
    mockSystemPrefersDark(false);
    expect(getThemePreference()).toBe("auto");
  });

  it("显式 light/dark 偏好被保留", () => {
    mockSystemPrefersDark(false);
    setTheme("dark");
    expect(getThemePreference()).toBe("dark");
    expect(getTheme()).toBe("dark");
  });

  it("auto 偏好跟随系统：系统暗色时解析为 dark", () => {
    mockSystemPrefersDark(true);
    setTheme("auto");
    expect(getThemePreference()).toBe("auto");
    expect(getTheme()).toBe("dark");
  });

  it("auto 偏好跟随系统：系统亮色时解析为 light", () => {
    mockSystemPrefersDark(false);
    setTheme("auto");
    expect(getTheme()).toBe("light");
  });

  it("setTheme 会把解析后的模式写入 data-theme", () => {
    mockSystemPrefersDark(false);
    setTheme("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("applyTheme 直接设置 data-theme", () => {
    applyTheme("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });
});

describe("watchSystemTheme", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("仅在 auto 偏好下响应系统变化并回调", () => {
    const sys = mockSystemPrefersDark(true);
    setTheme("auto");
    const cb = vi.fn();
    const stop = watchSystemTheme(cb);
    sys.triggerChange();
    expect(cb).toHaveBeenCalledWith("dark");
    stop();
    expect(sys.mq.removeEventListener).toHaveBeenCalled();
  });

  it("用户显式选定主题时忽略系统变化", () => {
    const sys = mockSystemPrefersDark(true);
    setTheme("light");
    const cb = vi.fn();
    const stop = watchSystemTheme(cb);
    sys.triggerChange();
    expect(cb).not.toHaveBeenCalled();
    stop();
  });
});
