import { act, fireEvent, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSmoothReaderZoom } from "../../../features/reader/useSmoothReaderZoom";
import { usePdfTextSelection } from "../../../features/reader/usePdfTextSelection";

beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); document.getSelection()?.removeAllRanges(); });

describe("continuous reader zoom", () => {
  it("accumulates tiny trackpad deltas and only sharpens after the gesture pauses", () => {
    const { result } = renderHook(() => useSmoothReaderZoom(1));
    act(() => { for (let i = 0; i < 100; i++) result.current.zoomByFactor(1.001); });
    expect(result.current.scale).toBe(1);
    act(() => vi.advanceTimersByTime(20));
    expect(result.current.scale).toBeCloseTo(1.001 ** 100, 10);
    expect(result.current.renderScale).toBe(1);
    act(() => vi.advanceTimersByTime(160));
    expect(result.current.renderScale).toBe(result.current.scale);
  });
  it("explicit zoom replaces a pending gesture and rejects invalid values", () => {
    const { result, unmount } = renderHook(() => useSmoothReaderZoom(1));
    act(() => { result.current.zoomByFactor(1.2); result.current.setScale(2); });
    act(() => vi.advanceTimersByTime(200));
    expect(result.current.scale).toBe(2);
    expect(result.current.renderScale).toBe(2);
    act(() => { result.current.zoomByFactor(NaN); result.current.setScale(Infinity); });
    expect(result.current.scale).toBe(2);
    act(() => result.current.zoomByFactor(1.1));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

function setupSelection() {
  const container = document.createElement("div");
  container.innerHTML = '<div data-page-num="1"><div class="textLayer"><span>妍</span></div></div>';
  document.body.append(container);
  const layer = container.querySelector<HTMLElement>(".textLayer");
  const span = layer?.querySelector("span");
  const page = container.firstElementChild;
  if (!layer || !span || !page) throw new Error("Missing selection fixture");
  const bounds = { left: 0, top: 0, width: 600, height: 800 } as DOMRect;
  vi.spyOn(page, "getBoundingClientRect").mockReturnValue(bounds);
  const range = document.createRange(); range.selectNodeContents(span);
  Object.assign(range, { getClientRects: () => [{ left: 50, top: 50, width: 10, height: 12 }] });
  const selected = vi.fn(), cleared = vi.fn();
  const hook = renderHook(() => usePdfTextSelection({ containerRef: { current: container }, enabled: true,
    onTextSelected: selected, onSelectionCleared: cleared }));
  const drag = () => {
    fireEvent.mouseDown(span);
    document.getSelection()?.addRange(range);
    fireEvent.mouseUp(span);
  };
  return { ...hook, container, layer, span, selected, cleared, drag };
}

describe("reader selection lifecycle", () => {
  it("accepts a single CJK character and cancels the previous drag's deferred read", () => {
    const test = setupSelection();
    test.drag();
    act(() => vi.advanceTimersByTime(20));
    expect(test.selected).toHaveBeenCalledWith(expect.objectContaining({ text: "妍", page: 1 }));
    test.selected.mockClear();
    test.drag();
    fireEvent.mouseDown(test.span);
    act(() => vi.advanceTimersByTime(20));
    expect(test.selected).not.toHaveBeenCalled();
    test.unmount(); test.container.remove();
  });
  it("does not clear selections outside the reader and cancels reads on unmount", () => {
    const test = setupSelection();
    test.drag();
    act(() => vi.advanceTimersByTime(20));
    fireEvent.mouseUp(document.body);
    act(() => vi.advanceTimersByTime(20));
    expect(document.getSelection()?.toString()).toBe("妍");
    expect(test.cleared).not.toHaveBeenCalled();
    test.selected.mockClear(); test.drag(); test.unmount();
    act(() => vi.advanceTimersByTime(20));
    expect(test.selected).not.toHaveBeenCalled();
    test.container.remove();
  });
  it("blocks blank-page selection without disturbing the native text nodes", () => {
    const test = setupSelection();
    test.drag();
    act(() => vi.advanceTimersByTime(20));
    const original = test.span.firstChild;
    fireEvent.mouseDown(test.layer);
    expect(document.getSelection()?.toString()).toBe("");
    expect(test.cleared).toHaveBeenCalledOnce();
    expect(test.span.firstChild).toBe(original);
    test.unmount(); test.container.remove();
  });
});
