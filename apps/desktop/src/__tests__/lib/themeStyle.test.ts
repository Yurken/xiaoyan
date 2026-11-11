import { describe, it, expect, beforeEach } from "vitest";
import {
  getThemeStyle,
  setThemeStyle,
  applyThemeStyle,
} from "../../lib/themeStyle";

describe("themeStyle", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-style");
  });

  it("未设置或历史值无效时使用拟态风格", () => {
    expect(getThemeStyle()).toBe("neumorphic");
    localStorage.setItem("rc_style", "liquid-glass");
    expect(getThemeStyle()).toBe("neumorphic");
  });

  it("读取已经保存的极简风格", () => {
    localStorage.setItem("rc_style", "modern-minimal");
    expect(getThemeStyle()).toBe("modern-minimal");
  });

  it("applyThemeStyle 设置 data-style", () => {
    applyThemeStyle("neumorphic");
    expect(document.documentElement.getAttribute("data-style")).toBe("neumorphic");
  });

  it("setThemeStyle 写入存储并应用", () => {
    setThemeStyle("modern-minimal");
    expect(localStorage.getItem("rc_style")).toBe("modern-minimal");
    expect(document.documentElement.getAttribute("data-style")).toBe(
      "modern-minimal",
    );
    expect(getThemeStyle()).toBe("modern-minimal");
  });
});
