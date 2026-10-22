import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DshRuntimeView from "../../features/deepseek-harness/DshRuntimeView";

const views = vi.hoisted(() => [] as Array<{
  label: string;
  options: { url: string; x: number; y: number; width: number; height: number };
  callbacks: Record<string, (event: { payload?: unknown }) => void>;
  close: ReturnType<typeof vi.fn>;
  setPosition: ReturnType<typeof vi.fn>;
  setSize: ReturnType<typeof vi.fn>;
  emitTo: ReturnType<typeof vi.fn>;
}>);

vi.mock("@tauri-apps/api/webview", () => ({
  Webview: class {
    label: string;
    options: typeof views[number]["options"];
    callbacks: Record<string, (event: { payload?: unknown }) => void> = {};
    close = vi.fn().mockResolvedValue(undefined);
    setPosition = vi.fn().mockResolvedValue(undefined);
    setSize = vi.fn().mockResolvedValue(undefined);
    emitTo = vi.fn().mockResolvedValue(undefined);
    constructor(_window: unknown, label: string, options: typeof views[number]["options"]) {
      this.label = label;
      this.options = options;
      views.push(this);
    }
    once(event: string, callback: (event: { payload?: unknown }) => void) {
      this.callbacks[event] = callback;
      return Promise.resolve(() => { delete this.callbacks[event]; });
    }
  },
}));

const authenticatedUrl = "http://127.0.0.1:63244/?token=synthetic-launch-token";
let bounds: DOMRect;
let notifyResize: () => void;
let disconnect: ReturnType<typeof vi.fn>;

describe("DshRuntimeView", () => {
  beforeEach(() => {
    views.length = 0;
    vi.stubGlobal("__TAURI_INTERNALS__", {});
    bounds = new DOMRect(80, 64, 1200, 736);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => bounds);
    disconnect = vi.fn();
    vi.stubGlobal("ResizeObserver", class {
      constructor(callback: () => void) { notifyResize = callback; }
      observe = vi.fn();
      disconnect = disconnect;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const contentViews = () => views.filter((view) => view.options.url.startsWith("http://127.0.0.1"));
  async function created(index = 0) {
    await waitFor(() => expect(contentViews()[index]?.callbacks["tauri://error"]).toBeDefined());
    act(() => contentViews()[index].callbacks["tauri://created"]({}));
    const controls = views.at(-1);
    await waitFor(() => expect(controls?.callbacks["tauri://error"]).toBeDefined());
    act(() => controls?.callbacks["tauri://created"]({}));
  }

  it("uses a native browsing context with the full launch token and fits the content area", async () => {
    const { unmount } = render(<DshRuntimeView url={authenticatedUrl} />);
    await created();

    expect(screen.queryByTitle("DeepSeek Harness")).not.toBeInTheDocument();
    expect(new URL(views[1].options.url).searchParams.get("surface")).toBe("dsh-runtime-controls");
    expect(views[1].options.url).not.toContain("synthetic-launch-token");
    expect(views[0].options).toMatchObject({ url: authenticatedUrl, x: 80, y: 64, width: 1200, height: 736 });
    bounds = new DOMRect(100, 64, 900, 600);
    act(() => notifyResize());
    await waitFor(() => expect(views[0].setSize).toHaveBeenCalledWith(expect.objectContaining({ width: 900, height: 600 })));
    expect(views[0].setPosition).toHaveBeenCalledWith(expect.objectContaining({ x: 100, y: 64 }));

    unmount();
    expect(disconnect).toHaveBeenCalled();
    expect(views[0].close).toHaveBeenCalledOnce();
    expect(views[1].close).toHaveBeenCalledOnce();
  });

  it("closes a view that finishes creation after leaving the workspace", async () => {
    const { unmount } = render(<DshRuntimeView url={authenticatedUrl} />);
    await waitFor(() => expect(views[0]?.callbacks["tauri://error"]).toBeDefined());
    unmount();
    act(() => views[0].callbacks["tauri://created"]({}));
    expect(views[0].close).toHaveBeenCalledOnce();
  });

  it("closes controls that finish creation after their workspace has unmounted", async () => {
    const { unmount } = render(<DshRuntimeView url={authenticatedUrl} />);
    await waitFor(() => expect(views[0]?.callbacks["tauri://created"]).toBeDefined());
    act(() => views[0].callbacks["tauri://created"]({}));
    await waitFor(() => expect(views[1]?.callbacks["tauri://created"]).toBeDefined());
    unmount();
    act(() => views[1].callbacks["tauri://created"]({}));
    expect(views[0].close).toHaveBeenCalledOnce();
    expect(views[1].close).toHaveBeenCalledOnce();
  });

  it("replaces the native view on restart and closes each instance separately", async () => {
    const { rerender, unmount } = render(<DshRuntimeView url={authenticatedUrl} />);
    await created();
    const nextUrl = "http://127.0.0.1:63245/?token=next-launch-token";
    rerender(<DshRuntimeView url={nextUrl} />);
    await created(1);

    expect(views[0].close).toHaveBeenCalledOnce();
    expect(contentViews()[1].options.url).toBe(nextUrl);
    expect(contentViews()[1].label).not.toBe(views[0].label);
    expect(contentViews()[1].close).not.toHaveBeenCalled();
    unmount();
    expect(contentViews()[1].close).toHaveBeenCalledOnce();
  });

  it("allows retry after native creation fails without showing authentication details", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<DshRuntimeView url={authenticatedUrl} />);
    await waitFor(() => expect(views[0]?.callbacks["tauri://error"]).toBeDefined());
    act(() => views[0].callbacks["tauri://error"]({ payload: authenticatedUrl }));

    expect(screen.getByRole("alert")).toHaveTextContent("DSH 页面未能加载");
    expect(screen.getByRole("alert")).not.toHaveTextContent("synthetic-launch-token");
    await user.click(screen.getByRole("button", { name: "重新加载" }));
    await created(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    unmount();
  });
});
