import { act, fireEvent, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { usePdfZoomAnchor } from "../../../features/reader/usePdfZoomAnchor";

function setup() {
  let layoutScale = 1;
  const container = document.createElement("div");
  Object.defineProperties(container, { clientWidth: { value: 1000 }, clientHeight: { value: 800 } });
  container.scrollTop = 900;
  container.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 800 }) as DOMRect;
  const pages = [0, 1, 2].map((index) => {
    const page = document.createElement("div");
    page.getBoundingClientRect = () => {
      const height = 800 * layoutScale;
      const top = index * (height + 16) - container.scrollTop;
      return { left: -container.scrollLeft, top, bottom: top + height, width: 600 * layoutScale, height } as DOMRect;
    };
    container.append(page);
    return page;
  });
  const containerRef = { current: container }, pageRefs = { current: pages };
  const documentKey = {}, onZoom = vi.fn();
  const hook = renderHook(({ scale }) => usePdfZoomAnchor({ containerRef, pageRefs, scale, documentKey, onZoom }),
    { initialProps: { scale: 1 } });
  const setScale = (scale: number) => { layoutScale = scale; hook.rerender({ scale }); };
  const point = (y: number) => { const r = pages[1].getBoundingClientRect(); return (y - r.top) / r.height; };
  return { ...hook, container, onZoom, setScale, point };
}

describe("PDF zoom anchoring", () => {
  it("holds the cursor's document point and normalizes wheel units without intercepting scrolling", () => {
    const test = setup();
    const before = test.point(250);
    fireEvent.wheel(test.container, { ctrlKey: true, deltaY: -2, deltaMode: 1, clientX: 400, clientY: 250 });
    expect(test.onZoom).toHaveBeenCalledWith(Math.exp(32 * 0.0015));
    test.setScale(1.8);
    expect(test.point(250)).toBeCloseTo(before, 10);
    fireEvent.wheel(test.container, { deltaY: 100 });
    expect(test.onZoom).toHaveBeenCalledOnce();
    test.unmount();
    fireEvent.wheel(test.container, { ctrlKey: true, deltaY: -10 });
    expect(test.onZoom).toHaveBeenCalledOnce();
  });
  it("uses the viewport centre after ordinary scrolling for toolbar zoom", () => {
    const test = setup();
    act(() => { test.container.scrollTop += 60; fireEvent.scroll(test.container); });
    const before = test.point(400);
    test.setScale(2);
    expect(test.point(400)).toBeCloseTo(before, 10);
    test.unmount();
  });
});
