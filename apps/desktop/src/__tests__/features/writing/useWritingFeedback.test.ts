import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useWritingFeedback } from "../../../features/writing/useWritingFeedback";

describe("useWritingFeedback", () => {
  afterEach(() => cleanup());

  it("同文稿保留正常提示语义：错误保留消息，成功清空错误，清理移除两者", () => {
    const { result } = renderHook(() => useWritingFeedback("draft-a"));
    expect(result.current.message).toBe("");
    expect(result.current.error).toBe("");
    act(() => { result.current.showMessage("Saved"); });
    expect(result.current.message).toBe("Saved");
    expect(result.current.error).toBe("");
    act(() => { result.current.showError("Compilation failed"); });
    expect(result.current.message).toBe("Saved");
    expect(result.current.error).toBe("Compilation failed");
    act(() => { result.current.showMessage("Compiled"); });
    expect(result.current.message).toBe("Compiled");
    expect(result.current.error).toBe("");
    act(() => {
      result.current.showError("Another error");
      result.current.clearStatus();
    });
    expect(result.current.message).toBe("");
    expect(result.current.error).toBe("");
  });

  it("B 的首次 render 就没有 A 的消息或错误", () => {
    const renders: Array<{ draftId: string; message: string; error: string }> = [];
    const { result, rerender } = renderHook((draftId: string) => {
      const feedback = useWritingFeedback(draftId);
      renders.push({ draftId, message: feedback.message, error: feedback.error });
      return feedback;
    }, { initialProps: "draft-a" });
    act(() => {
      result.current.showMessage("A saved");
      result.current.showError("A compilation failed");
    });
    rerender("draft-b");
    const bRenders = renders.filter((render) => render.draftId === "draft-b");
    expect(bRenders.length).toBeGreaterThan(0);
    for (const render of bRenders) {
      expect(render.message).toBe("");
      expect(render.error).toBe("");
    }
  });

  it.each(["draft-b", "draft-a"])("A→B 后进入 %s，旧 A 回调不能改变当前提示", (destination) => {
    const { result, rerender } = renderHook(useWritingFeedback, { initialProps: "draft-a" });
    const oldA = result.current;
    rerender("draft-b");
    if (destination === "draft-a") rerender("draft-a");
    act(() => {
      result.current.showMessage("Current message");
      result.current.showError("Current error");
    });

    const staleActions = [
      () => oldA.showError("Late A error"),
      () => oldA.clearStatus(),
      () => oldA.showMessage("Late A message"),
      () => oldA.showMessage("Late targeted A message", destination),
    ];
    for (const action of staleActions) {
      act(action);
      expect(result.current.message).toBe("Current message");
      expect(result.current.error).toBe("Current error");
    }
  });

  it("同步新建或删除导航保留目标文稿成功提示，来源回调随后失效", () => {
    const { result, rerender } = renderHook(useWritingFeedback, { initialProps: "draft-a" });
    const oldA = result.current;
    act(() => { result.current.showError("Old A error"); });

    // Mirrors the synchronous workspace action: announce the destination and
    // select that draft in the same event, before React commits the next view.
    act(() => {
      result.current.showMessage("Created B", "draft-b");
      rerender("draft-b");
    });
    expect(result.current.message).toBe("Created B");
    expect(result.current.error).toBe("");

    const staleActions = [
      () => oldA.clearStatus(),
      () => oldA.showError("Late A error"),
      () => oldA.showMessage("Late A message"),
      () => oldA.showMessage("Late targeted message", "draft-b"),
      () => oldA.showMessage("Late redirect", "draft-c"),
    ];
    for (const action of staleActions) {
      act(action);
      expect(result.current.message).toBe("Created B");
      expect(result.current.error).toBe("");
    }

    act(() => { result.current.showError("Current B error"); });
    expect(result.current.error).toBe("Current B error");
    act(() => { result.current.clearStatus(); });
    expect(result.current.message).toBe("");
    expect(result.current.error).toBe("");
  });
});
