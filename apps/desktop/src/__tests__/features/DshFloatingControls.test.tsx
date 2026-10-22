import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DshFloatingControls from "../../features/deepseek-harness/DshFloatingControls";

const native = vi.hoisted(() => ({
  setPosition: vi.fn().mockResolvedValue(undefined),
  setSize: vi.fn().mockResolvedValue(undefined),
  listen: vi.fn().mockResolvedValue(() => {}),
}));
const restart = vi.hoisted(() => vi.fn());
const stop = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => native }));
vi.mock("../../features/deepseek-harness/useDeepSeekHarnessRuntime", () => ({
  useDeepSeekHarnessRuntime: () => ({ snapshot: { phase: "running" }, busy: false, restart, stop }),
}));

class PointerEventMock extends MouseEvent {
  pointerId: number;
  isPrimary: boolean;
  constructor(type: string, options: PointerEventInit = {}) {
    super(type, options);
    this.pointerId = options.pointerId ?? 1;
    this.isPrimary = true;
  }
}

describe("DshFloatingControls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.history.replaceState({}, "", `/?surface=dsh-runtime-controls&viewport=${encodeURIComponent(JSON.stringify({ x: 60, y: 0, width: 1200, height: 800 }))}`);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 240, 40));
    vi.stubGlobal("PointerEvent", PointerEventMock);
    HTMLElement.prototype.setPointerCapture = vi.fn();
    HTMLElement.prototype.hasPointerCapture = vi.fn().mockReturnValue(true);
    HTMLElement.prototype.releasePointerCapture = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    window.history.replaceState({}, "", "/");
  });

  it("moves the native floating surface by screen coordinates, clamps and remembers its position", async () => {
    const { unmount } = render(<DshFloatingControls />);
    const handle = screen.getByRole("button", { name: "拖动 DSH 运行控制" });
    await waitFor(() => expect(native.setPosition).toHaveBeenCalledWith(expect.objectContaining({ x: 812, y: 12 })));
    fireEvent.pointerDown(handle, { button: 0, pointerId: 1, screenX: 900, screenY: 100 });
    fireEvent.pointerMove(handle, { pointerId: 1, screenX: 120, screenY: 200 });
    fireEvent.pointerUp(handle, { pointerId: 1 });
    await waitFor(() => expect(native.setPosition).toHaveBeenLastCalledWith(expect.objectContaining({ x: 72, y: 112 })));
    expect(window.localStorage.setItem).toHaveBeenCalledWith("rc:floating-runtime-controls:dsh", JSON.stringify({ x: 12, y: 112 }));
    unmount();

    render(<DshFloatingControls />);
    await waitFor(() => expect(native.setPosition).toHaveBeenLastCalledWith(expect.objectContaining({ x: 72, y: 112 })));
  });

  it("supports keyboard movement, reset, and process actions", async () => {
    render(<DshFloatingControls />);
    const handle = screen.getByRole("button", { name: "拖动 DSH 运行控制" });
    fireEvent.keyDown(handle, { key: "ArrowDown" });
    await waitFor(() => expect(native.setPosition).toHaveBeenLastCalledWith(expect.objectContaining({ y: 20 })));
    fireEvent.keyDown(handle, { key: "Home" });
    await waitFor(() => expect(native.setPosition).toHaveBeenLastCalledWith(expect.objectContaining({ y: 12 })));
    fireEvent.click(screen.getByRole("button", { name: "重启" }));
    fireEvent.click(screen.getByRole("button", { name: "停止" }));
    expect(restart).toHaveBeenCalledOnce();
    expect(stop).toHaveBeenCalledOnce();
  });

  it("keeps the panel inside a resized workspace", async () => {
    render(<DshFloatingControls />);
    await waitFor(() => expect(native.listen).toHaveBeenCalled());
    const onBounds = native.listen.mock.calls[0][1] as (event: { payload: unknown }) => void;
    act(() => onBounds({ payload: { x: 60, y: 0, width: 500, height: 400 } }));
    await waitFor(() => expect(native.setPosition).toHaveBeenLastCalledWith(expect.objectContaining({ x: 112, y: 12 })));
  });
});
