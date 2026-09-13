import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useHomeSuggestions } from "../../../features/workbench/home/useHomeSuggestions";
import { SUGGESTION_FADE_MS, SUGGESTION_HOLD_MS } from "../../../features/workbench/home/shared";

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
describe("首页建议轮换", () => {
  it("先淡出旧建议，再替换文字并淡入；用户阅读或输入时保持稳定", () => {
    vi.useFakeTimers();
    const { result, rerender, unmount } = renderHook(({ busy }) => useHomeSuggestions(busy), { initialProps: { busy: false } });
    const first = result.current.suggestion;
    act(() => vi.advanceTimersByTime(SUGGESTION_HOLD_MS));
    expect(result.current.fading).toBe(true);
    expect(result.current.suggestion).toBe(first);
    act(() => vi.advanceTimersByTime(SUGGESTION_FADE_MS));
    expect(result.current.fading).toBe(false);
    expect(result.current.suggestion).not.toBe(first);
    const second = result.current.suggestion;
    rerender({ busy: true });
    act(() => vi.advanceTimersByTime(30000));
    expect(result.current.suggestion).toBe(second);
    // A manual request must still work while the suggestion controls have focus.
    act(() => result.current.next());
    act(() => vi.advanceTimersByTime(SUGGESTION_FADE_MS));
    expect(result.current.suggestion).not.toBe(second);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("减少动态效果时不自动轮播，手动切换直接完成", () => {
    vi.useFakeTimers();
    vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as MediaQueryList);
    const { result } = renderHook(() => useHomeSuggestions(false));
    const first = result.current.suggestion;
    act(() => vi.advanceTimersByTime(30000));
    expect(result.current.suggestion).toBe(first);
    act(() => result.current.next());
    expect(result.current.suggestion).not.toBe(first);
    expect(result.current.fading).toBe(false);
  });
});
