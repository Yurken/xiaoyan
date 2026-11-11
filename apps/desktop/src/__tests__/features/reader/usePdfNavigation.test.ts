import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePdfNavigation } from "../../../features/reader/usePdfNavigation";

function setup() {
  const container = document.createElement("div");
  container.scrollTo = vi.fn();
  Object.defineProperty(container, "clientHeight", { value: 600 });
  vi.spyOn(container, "getBoundingClientRect").mockReturnValue({ top: 0 } as DOMRect);
  const pages = [0, 1, 2].map((index) => {
    const element = document.createElement("div");
    element.dataset.pageReady = "0";
    element.scrollIntoView = vi.fn();
    vi.spyOn(element, "getBoundingClientRect").mockReturnValue({ top: index * 800, height: 800 } as DOMRect);
    container.append(element);
    return element;
  });
  document.body.append(container);
  const onPageActive = vi.fn();
  const options = { containerRef: { current: container }, pageRefs: { current: pages }, documentKey: {}, layoutKey: "spread", onPageActive };
  const hook = renderHook((props) => usePdfNavigation(props), { initialProps: options });
  return { ...hook, container, pages, options, onPageActive };
}

describe("usePdfNavigation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  it("未渲染页只粗定位，实际就绪后才按真实高度定位到笔记", async () => {
    const { result, container, pages, onPageActive } = setup();
    const scroll = vi.spyOn(container, "scrollTo");
    act(() => result.current.scrollToNote(3, 0.75));
    expect(onPageActive).toHaveBeenCalledWith(3);
    expect(pages[2].scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "center" });
    expect(scroll).not.toHaveBeenCalled();
    pages[2].dataset.pageReady = "1";
    await waitFor(() => expect(scroll).toHaveBeenCalledWith({ top: 2000, behavior: "smooth" }));
  });

  it("先点未就绪笔记再点另一笔记，旧页面完成渲染不能抢回滚动位置", async () => {
    const { result, container, pages } = setup();
    const scroll = vi.spyOn(container, "scrollTo");
    pages[2].dataset.pageReady = "1";
    act(() => result.current.scrollToNote(2, 0.5));
    act(() => result.current.scrollToNote(3, 0.5));
    expect(scroll).toHaveBeenCalledTimes(1);
    pages[1].dataset.pageReady = "1";
    await act(async () => { await Promise.resolve(); });
    expect(scroll).toHaveBeenCalledTimes(1);
    expect(scroll).toHaveBeenLastCalledWith({ top: 1800, behavior: "smooth" });
  });

  it("点击页码或切换布局也会取消之前尚未完成的笔记定位", async () => {
    const { result, container, pages, rerender, options } = setup();
    const scroll = vi.spyOn(container, "scrollTo");
    act(() => result.current.scrollToNote(2, 0.5));
    act(() => result.current.scrollToPage(1, { smooth: false }));
    pages[1].dataset.pageReady = "1";
    await act(async () => { await Promise.resolve(); });
    expect(scroll).not.toHaveBeenCalled();

    act(() => result.current.scrollToNote(3, 0.5));
    rerender({ ...options, layoutKey: "single" });
    pages[2].dataset.pageReady = "1";
    await act(async () => { await Promise.resolve(); });
    expect(scroll).not.toHaveBeenCalled();
  });

  it("用户等待渲染时已手动滚动，就绪页面不会再抢回视口", async () => {
    const { result, container, pages } = setup();
    const scroll = vi.spyOn(container, "scrollTo");
    act(() => result.current.scrollToNote(2, 0.5));
    container.dispatchEvent(new WheelEvent("wheel"));
    pages[1].dataset.pageReady = "1";
    await act(async () => { await Promise.resolve(); });
    expect(scroll).not.toHaveBeenCalled();
  });
});
