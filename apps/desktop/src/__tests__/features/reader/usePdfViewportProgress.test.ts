import { act, fireEvent, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePdfViewportProgress } from "../../../features/reader/usePdfViewportProgress";

describe("usePdfViewportProgress", () => {
  let frames: Map<number, FrameRequestCallback>;
  let frameId: number;
  beforeEach(() => {
    frames = new Map();
    frameId = 0;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frames.set(++frameId, callback);
      return frameId;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => { frames.delete(id); });
  });
  afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); });

  function flushFrames() {
    act(() => {
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((callback) => callback(0));
    });
  }

  function setup(initialPage = 1) {
    const container = document.createElement("div");
    Object.defineProperties(container, { clientHeight: { value: 600 }, scrollHeight: { value: 2400 } });
    vi.spyOn(container, "getBoundingClientRect").mockReturnValue({ top: 0 } as DOMRect);
    const pages = [-800, 0, 0].map((top, index) => {
      const element = document.createElement("div");
      element.dataset.pageNum = String(index + 1);
      element.scrollIntoView = vi.fn();
      vi.spyOn(element, "getBoundingClientRect").mockReturnValue({ top, height: 700 } as DOMRect);
      container.append(element);
      return element;
    });
    document.body.append(container);
    const onProgressChange = vi.fn();
    const props = { containerRef: { current: container }, pageRefs: { current: pages }, numPages: 3, documentKey: {}, initialPage, onProgressChange };
    const hook = renderHook((options) => usePdfViewportProgress(options), { initialProps: props });
    flushFrames();
    return { ...hook, container, pages, props, onProgressChange };
  }

  it("导航到右页后，滚动进度与显式目标页一致", () => {
    const { result, onProgressChange } = setup();
    expect(onProgressChange).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
    act(() => result.current.markPageActive(3));
    flushFrames();
    expect(onProgressChange).toHaveBeenLastCalledWith(expect.objectContaining({ page: 3 }));
  });

  it("在右页开始选择文字时，当前页切到右页", () => {
    const { pages, onProgressChange } = setup();
    fireEvent.pointerDown(pages[2]);
    flushFrames();
    expect(onProgressChange).toHaveBeenLastCalledWith(expect.objectContaining({ page: 3 }));
  });

  it("右页断点可恢复，记录进度引起的 initialPage 更新不会重复跳页", () => {
    const { pages, rerender, props, onProgressChange } = setup(3);
    expect(onProgressChange).toHaveBeenLastCalledWith(expect.objectContaining({ page: 3 }));
    const restore = vi.spyOn(pages[2], "scrollIntoView");
    restore.mockClear();
    rerender({ ...props, initialPage: 2 });
    flushFrames();
    expect(restore).not.toHaveBeenCalled();
  });
});
