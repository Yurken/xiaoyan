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

  it("界面风格锁定为 neumorphic，忽略历史存值", () => {
    localStorage.setItem("rc_style", "modern-minimal");
    expect(getThemeStyle()).toBe("neumorphic");
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
  });
});
