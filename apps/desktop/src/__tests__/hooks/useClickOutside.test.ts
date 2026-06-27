import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useClickOutside } from "../../hooks/useClickOutside";

describe("useClickOutside", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("应返回 ref", () => {
    const { result } = renderHook(() => useClickOutside(false, vi.fn()));
    expect(result.current.current).toBeNull();
  });

  it("isOpen 为 false 时不应监听点击", () => {
    const onClose = vi.fn();
    renderHook(() => useClickOutside(false, onClose));
    document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("isOpen 为 true 且点击外部时应调用 onClose", () => {
    const onClose = vi.fn();

    // Create container element first
    const containerDiv = document.createElement("div");
    document.body.appendChild(containerDiv);

    // Render hook with isOpen=true
    const { result } = renderHook(() => useClickOutside(true, onClose));

    // Set the ref to our container
    Object.defineProperty(result.current, "current", {
      value: containerDiv,
      writable: true,
    });

    // Create an outside element
    const outsideDiv = document.createElement("div");
    document.body.appendChild(outsideDiv);

    act(() => {
      outsideDiv.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });

    expect(onClose).toHaveBeenCalled();
  });

  it("isOpen 为 true 且点击内部时不应调用 onClose", () => {
    const onClose = vi.fn();

    // Create container element first
    const containerDiv = document.createElement("div");
    document.body.appendChild(containerDiv);

    // Render hook with isOpen=true
    const { result } = renderHook(() => useClickOutside(true, onClose));

    // Set the ref to our container
    Object.defineProperty(result.current, "current", {
      value: containerDiv,
      writable: true,
    });

    act(() => {
      containerDiv.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });

    expect(onClose).not.toHaveBeenCalled();
  });
});
