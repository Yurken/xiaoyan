import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import RuntimeWebFrame from "../../features/code-harness/RuntimeWebFrame";
import { RUNTIME_WEB_FRAME_SANDBOX } from "../../features/code-harness/shared";

const startWindowDragging = vi.fn();
const platform = { isMacOS: true };

vi.mock("../../lib/windowChrome", () => ({
  get IS_MACOS_DESKTOP() {
    return platform.isMacOS;
  },
  MACOS_WINDOW_DRAG_HEIGHT: 28,
  startWindowDragging: () => startWindowDragging(),
}));

function renderFrame() {
  return render(
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-nm-bg">
      <RuntimeWebFrame
        provider="dsh"
        label="DSH"
        title="DeepSeek Harness"
        url="http://127.0.0.1:63244"
        sandbox={RUNTIME_WEB_FRAME_SANDBOX}
      >
        <span>运行中</span>
      </RuntimeWebFrame>
    </div>,
  );
}

describe("RuntimeWebFrame", () => {
  beforeEach(() => {
    startWindowDragging.mockReset();
    platform.isMacOS = true;
  });

  it("keeps a host-owned drag band above the embedded page on macOS", () => {
    const { container } = renderFrame();

    const band = container.querySelector<HTMLElement>(".runtime-frame__window-drag-band");
    const frame = screen.getByTitle("DeepSeek Harness");

    expect(band).not.toBeNull();
    const dragBand = band as HTMLElement;
    expect(dragBand).toHaveAttribute("data-tauri-drag-region");
    expect(dragBand.style.height).toBe("28px");
    // 带子排在 iframe 之前，内嵌页面从带子下方开始，不再被透明拖拽区盖住顶栏。
    expect(dragBand.compareDocumentPosition(frame) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.mouseDown(dragBand, { button: 0 });
    expect(startWindowDragging).toHaveBeenCalledTimes(1);
  });

  it("ignores non-primary buttons so right-click menus still work", () => {
    const { container } = renderFrame();
    const band = container.querySelector<HTMLElement>(".runtime-frame__window-drag-band");

    fireEvent.mouseDown(band as HTMLElement, { button: 2 });
    expect(startWindowDragging).not.toHaveBeenCalled();
  });

  it("leaves the embedded page full height on other platforms", () => {
    platform.isMacOS = false;
    const { container } = renderFrame();

    expect(container.querySelector(".runtime-frame__window-drag-band")).toBeNull();
    const column = container.firstElementChild as HTMLElement;
    expect(column.firstElementChild).toBe(screen.getByTitle("DeepSeek Harness").parentElement);
  });

  it("embeds the runtime URL with its own sandbox", () => {
    renderFrame();
    const frame = screen.getByTitle("DeepSeek Harness");

    expect(frame).toHaveAttribute("src", "http://127.0.0.1:63244");
    expect(frame).toHaveAttribute("sandbox", RUNTIME_WEB_FRAME_SANDBOX);
    expect(screen.getByText("运行中")).toBeInTheDocument();
  });
});
