import { createElement } from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { useThemeInit } from "../../hooks/useThemeInit";
import {
  getThemeStyle,
  setThemeStyle,
  applyThemeStyle,
} from "../../lib/themeStyle";

function ThemeBoot() {
  useThemeInit();
  return null;
}

describe("themeStyle", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-style");
    document.documentElement.removeAttribute("data-theme");
  });

  it("空存储默认为 neumorphic", () => {
    expect(getThemeStyle()).toBe("neumorphic");
  });

  it("已保存的合法风格在读取时生效", () => {
    localStorage.setItem("rc_style", "modern-minimal");
    expect(getThemeStyle()).toBe("modern-minimal");

    localStorage.setItem("rc_style", "neumorphic");
    expect(getThemeStyle()).toBe("neumorphic");
  });

  it("写入 modern-minimal 后存储与 data-style 保持该值，再次读取仍生效", () => {
    setThemeStyle("modern-minimal");
    expect(localStorage.getItem("rc_style")).toBe("modern-minimal");
    expect(document.documentElement.getAttribute("data-style")).toBe("modern-minimal");

    expect(getThemeStyle()).toBe("modern-minimal");
    applyThemeStyle(getThemeStyle());
    expect(document.documentElement.getAttribute("data-style")).toBe("modern-minimal");
    expect(getThemeStyle()).toBe("modern-minimal");
  });

  it("初始化时把已保存的 modern-minimal 写到 data-style", () => {
    localStorage.setItem("rc_style", "modern-minimal");
    render(createElement(ThemeBoot));
    expect(getThemeStyle()).toBe("modern-minimal");
    expect(document.documentElement.getAttribute("data-style")).toBe("modern-minimal");
  });

  it("非法存值回退为 neumorphic 且不抛错", () => {
    localStorage.setItem("rc_style", "liquid-glass");
    expect(() => getThemeStyle()).not.toThrow();
    expect(getThemeStyle()).toBe("neumorphic");

    localStorage.setItem("rc_style", "paper");
    expect(getThemeStyle()).toBe("neumorphic");

    localStorage.setItem("rc_style", "");
    expect(getThemeStyle()).toBe("neumorphic");
  });

  it("applyThemeStyle 设置 data-style", () => {
    applyThemeStyle("neumorphic");
    expect(document.documentElement.getAttribute("data-style")).toBe("neumorphic");
  });
});
