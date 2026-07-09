import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  LAYOUT_MODE_CHANGE_EVENT,
  getLayoutMode,
  setLayoutMode,
  landscapePathForFocusPath,
} from "../../lib/layoutMode";

describe("layoutMode 存取", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("默认返回 landscape", () => {
    expect(getLayoutMode()).toBe("landscape");
  });

  it("写入 focus 后读取一致", () => {
    setLayoutMode("focus");
    expect(getLayoutMode()).toBe("focus");
  });

  it("非法存值回退到 landscape", () => {
    localStorage.setItem("rc_layout_mode", "garbage");
    expect(getLayoutMode()).toBe("landscape");
  });

  it("setLayoutMode 派发变更事件", () => {
    const handler = vi.fn();
    window.addEventListener(LAYOUT_MODE_CHANGE_EVENT, handler);
    setLayoutMode("focus");
    expect(handler).toHaveBeenCalledTimes(1);
    expect((handler.mock.calls[0][0] as CustomEvent).detail).toBe("focus");
    window.removeEventListener(LAYOUT_MODE_CHANGE_EVENT, handler);
  });
});

describe("landscapePathForFocusPath 反查", () => {
  it("free 工作台按 tab 映射到对应横屏路由", () => {
    expect(landscapePathForFocusPath("/workbench/free/papers")).toBe("/papers");
    expect(landscapePathForFocusPath("/workbench/free/tools")).toBe("/tools");
    expect(landscapePathForFocusPath("/workbench/free/copilot")).toBe("/chat");
  });

  it("free 工作台无 tab 默认 survey", () => {
    expect(landscapePathForFocusPath("/workbench/free")).toBe("/survey");
  });

  it("free 工作台未知 tab 回退 survey", () => {
    expect(landscapePathForFocusPath("/workbench/free/unknown")).toBe("/survey");
  });

  it("兴趣工作台按 tab 映射", () => {
    expect(landscapePathForFocusPath("/workbench/topic-1/notes")).toBe("/knowledge");
    expect(landscapePathForFocusPath("/workbench/topic-1/papers")).toBe("/papers");
  });

  it("兴趣工作台无 tab 默认 papers", () => {
    expect(landscapePathForFocusPath("/workbench/topic-1")).toBe("/papers");
  });

  it("尾部斜杠归一化", () => {
    expect(landscapePathForFocusPath("/workbench/free/papers/")).toBe("/papers");
  });

  it("非工作台路径原样返回（去尾斜杠）", () => {
    expect(landscapePathForFocusPath("/settings/")).toBe("/settings");
    expect(landscapePathForFocusPath("/")).toBe("/");
  });
});
