import { StrictMode, type ComponentProps, type PropsWithChildren } from "react";
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WritingCompileButton from "../../../features/writing/WritingCompileButton";
import { useWritingCompileFlash } from "../../../features/writing/useWritingCompileFlash";
import type { WritingCompileStatus } from "../../../features/writing/shared";

type ButtonProps = ComponentProps<typeof WritingCompileButton>;

function renderButton(initial: Partial<ButtonProps> = {}) {
  const onCompile = vi.fn();
  let props: ButtonProps = {
    draftId: "draft-a",
    compileStatus: "idle",
    exportingTarget: null,
    onCompile,
    ...initial,
  };
  const view = render(<WritingCompileButton {...props} />);
  return {
    ...view,
    onCompile,
    update(patch: Partial<ButtonProps>) {
      props = { ...props, ...patch };
      view.rerender(<WritingCompileButton {...props} />);
    },
  };
}

function expectComplete() {
  const button = screen.getByRole("button", { name: "编译完成" });
  expect(button).toHaveStyle({ background: "#34C759" });
  return button;
}

function expectNormal() {
  const button = screen.getByRole("button", { name: "编译 PDF" });
  expect(button).not.toHaveStyle({ background: "#34C759" });
  return button;
}

function advance(ms: number) {
  act(() => { vi.advanceTimersByTime(ms); });
}

describe("WritingCompileButton", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("首次挂载已有 ready 结果时不显示本次编译完成提示", () => {
    renderButton({ compileStatus: "ready" });
    expect(expectNormal()).toBeEnabled();
    expect(vi.getTimerCount()).toBe(0);
    advance(3000);
    expectNormal();
  });

  it.each(["idle", "compiling", "failed"] as const)(
    "同文稿从 %s 进入 ready 后显示绿色提示，满 3 秒恢复",
    (compileStatus) => {
      const view = renderButton({ compileStatus });
      view.update({ compileStatus: "ready" });
      expectComplete();
      advance(2999);
      expectComplete();
      advance(1);
      expectNormal();
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it.each(["idle", "compiling", "failed"] as const)(
    "成功后进入 %s 的每次 render 都已清除提示，不等待 effect",
    (status) => {
      const renders: Array<{ status: WritingCompileStatus; flash: boolean }> = [];
      const view = renderHook((current: WritingCompileStatus) => {
        const flash = useWritingCompileFlash("draft-a", current);
        renders.push({ status: current, flash });
        return flash;
      }, { initialProps: "compiling" as WritingCompileStatus });
      view.rerender("ready");
      expect(view.result.current).toBe(true);
      renders.length = 0;

      view.rerender(status);
      expect(renders.length).toBeGreaterThan(0);
      expect(renders.every((entry) => entry.status === status && !entry.flash)).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it("普通 rerender 和导出状态变化不续期，提示过期后 ready 不会重新闪烁", () => {
    const view = renderButton({ compileStatus: "compiling" });
    view.update({ compileStatus: "ready" });
    advance(1000);
    view.update({});
    advance(1000);
    view.update({ exportingTarget: "texstudio" });
    expect(expectComplete()).toBeDisabled();
    advance(999);
    expectComplete();
    advance(1);
    expectNormal();

    view.update({ exportingTarget: null, onCompile: vi.fn() });
    expect(expectNormal()).toBeEnabled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("切换到另一个 ready 文稿立即清提示，A→B→A 不复活且按钮 DOM 保持不变", () => {
    const view = renderButton({ compileStatus: "compiling" });
    const button = screen.getByRole("button");
    view.update({ compileStatus: "ready" });
    expect(expectComplete()).toBe(button);
    button.focus();

    view.update({ draftId: "draft-b" });
    expect(expectNormal()).toBe(button);
    expect(button).toHaveFocus();
    expect(vi.getTimerCount()).toBe(0);
    view.update({ draftId: "draft-a" });
    expect(expectNormal()).toBe(button);
    expect(button).toHaveFocus();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("文稿切换的第一次 render 就清除旧成功提示", () => {
    const renders: Array<{ draftId: string; flash: boolean }> = [];
    const view = renderHook(({ draftId, status }: {
      draftId: string;
      status: WritingCompileStatus;
    }) => {
      const flash = useWritingCompileFlash(draftId, status);
      renders.push({ draftId, flash });
      return flash;
    }, { initialProps: { draftId: "draft-a", status: "compiling" as WritingCompileStatus } });
    view.rerender({ draftId: "draft-a", status: "ready" });
    expect(view.result.current).toBe(true);
    renders.length = 0;

    view.rerender({ draftId: "draft-b", status: "ready" });
    expect(renders.length).toBeGreaterThan(0);
    expect(renders.every((entry) => entry.draftId === "draft-b" && !entry.flash)).toBe(true);
  });

  it("再次成功获得完整 3 秒，已取消的旧 timer 回调也不能清除新提示", () => {
    const timers = vi.spyOn(globalThis, "setTimeout");
    const view = renderButton({ compileStatus: "compiling" });
    view.update({ compileStatus: "ready" });
    const oldCallback = timers.mock.calls.find(([, delay]) => delay === 3000)?.[0];
    if (typeof oldCallback !== "function") throw new Error("Missing success timeout");

    advance(1000);
    view.update({ compileStatus: "compiling" });
    expectNormal();
    view.update({ compileStatus: "ready" });
    expectComplete();

    // Simulate a callback already queued before its timer was cancelled.
    act(() => { oldCallback(); });
    expectComplete();
    advance(2000);
    expectComplete();
    advance(999);
    expectComplete();
    advance(1);
    expectNormal();
  });

  it("使用真实共享 Button：编译中或导出时禁用点击，恢复后可以再次编译", () => {
    const view = renderButton();
    fireEvent.click(expectNormal());
    expect(view.onCompile).toHaveBeenCalledTimes(1);

    view.update({ compileStatus: "compiling" });
    expect(expectNormal()).toBeDisabled();
    fireEvent.click(screen.getByRole("button"));
    expect(view.onCompile).toHaveBeenCalledTimes(1);
    view.update({ compileStatus: "ready", exportingTarget: "texstudio" });
    expect(expectComplete()).toBeDisabled();
    fireEvent.click(screen.getByRole("button"));
    view.update({ exportingTarget: "overleaf" });
    expect(screen.getByRole("button")).toBeDisabled();
    fireEvent.click(screen.getByRole("button"));
    expect(view.onCompile).toHaveBeenCalledTimes(1);

    view.update({ exportingTarget: null });
    expect(expectComplete()).toBeEnabled();
    fireEvent.click(screen.getByRole("button"));
    expect(view.onCompile).toHaveBeenCalledTimes(2);
  });

  it("StrictMode 下只保留当前提示的 timer，卸载时清除且不会带到下次挂载", () => {
    function Wrapper({ children }: PropsWithChildren) {
      return <StrictMode>{children}</StrictMode>;
    }
    const view = renderHook(
      (status: WritingCompileStatus) => useWritingCompileFlash("draft-a", status),
      { initialProps: "compiling" as WritingCompileStatus, wrapper: Wrapper },
    );
    view.rerender("ready");
    expect(view.result.current).toBe(true);
    expect(vi.getTimerCount()).toBe(1);
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);

    const next = renderHook(() => useWritingCompileFlash("draft-a", "ready"), { wrapper: Wrapper });
    expect(next.result.current).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});
