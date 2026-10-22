import { StrictMode, createElement, type PropsWithChildren } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { save } from "@tauri-apps/plugin-dialog";
import { readFile, writeFile } from "@tauri-apps/plugin-fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWritingPdfExport } from "../../../features/writing/useWritingPdfExport";

const saveMock = vi.mocked(save);
const readMock = vi.mocked(readFile);
const writeMock = vi.mocked(writeFile);
const sourceA = "/synthetic/compile/a/main.pdf";
const sourceB = "/synthetic/compile/b/main.pdf";
const destination = "/synthetic/export/paper.pdf";
const pdfBytes = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55]);

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function startSave(savePdf: () => Promise<void>) {
  let job!: Promise<void>;
  act(() => { job = savePdf(); });
  return job;
}

function StrictWrapper({ children }: PropsWithChildren) {
  return createElement(StrictMode, null, children);
}

describe("useWritingPdfExport", () => {
  beforeEach(() => {
    saveMock.mockReset().mockResolvedValue(destination);
    readMock.mockReset().mockResolvedValue(pdfBytes);
    writeMock.mockReset().mockResolvedValue(undefined);
  });
  afterEach(() => {
    cleanup();
    saveMock.mockReset();
    readMock.mockReset();
    writeMock.mockReset();
  });

  it("没有 PDF 时不打开对话框或读写文件", async () => {
    const { result } = renderHook(() => useWritingPdfExport(null));
    await act(async () => { await result.current.savePdf(); });
    expect(result.current).toMatchObject({ saving: false, message: "", error: "" });
    expect(saveMock).not.toHaveBeenCalled();
    expect(readMock).not.toHaveBeenCalled();
    expect(writeMock).not.toHaveBeenCalled();
  });

  it("同一 tick 的重复点击与选择、读取、写入期间的点击只创建一次保存，写入完成才报告成功", async () => {
    const picker = deferred<string | null>();
    const reading = deferred<typeof pdfBytes>();
    const writing = deferred<void>();
    saveMock.mockReturnValueOnce(picker.promise);
    readMock.mockReturnValueOnce(reading.promise);
    writeMock.mockReturnValueOnce(writing.promise);
    const { result } = renderHook(() => useWritingPdfExport(sourceA));
    const click = result.current.savePdf;
    let first!: Promise<void>;
    let duplicate!: Promise<void>;
    act(() => {
      first = click();
      duplicate = click();
    });
    expect(result.current.saving).toBe(true);
    await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(1));
    expect(saveMock).toHaveBeenCalledWith(expect.objectContaining({
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    }));
    expect(readMock).not.toHaveBeenCalled();
    expect(writeMock).not.toHaveBeenCalled();

    await act(async () => { picker.resolve(destination); });
    await waitFor(() => expect(readMock).toHaveBeenCalledWith(sourceA));
    await act(async () => { await result.current.savePdf(); });
    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(writeMock).not.toHaveBeenCalled();
    expect(result.current.saving).toBe(true);

    await act(async () => { reading.resolve(pdfBytes); });
    await waitFor(() => expect(writeMock).toHaveBeenCalledWith(destination, pdfBytes));
    await act(async () => { await result.current.savePdf(); });
    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(result.current.saving).toBe(true);
    expect(result.current.message).not.toContain("已保存");
    await act(async () => {
      writing.resolve(undefined);
      await Promise.all([first, duplicate]);
    });
    expect(result.current.saving).toBe(false);
    expect(result.current.message).toContain("PDF 已保存");
    expect(result.current.message).toContain("paper.pdf");
    expect(result.current.error).toBe("");
    expect(readMock).toHaveBeenCalledTimes(1);
    expect(writeMock).toHaveBeenCalledTimes(1);
  });

  it("用户取消后不读写、不显示失败或成功，并允许下一次保存", async () => {
    saveMock.mockResolvedValueOnce(null);
    const { result } = renderHook(() => useWritingPdfExport(sourceA));
    await act(async () => { await result.current.savePdf(); });
    expect(result.current).toMatchObject({ saving: false, message: "", error: "" });
    expect(readMock).not.toHaveBeenCalled();
    expect(writeMock).not.toHaveBeenCalled();
    await act(async () => { await result.current.savePdf(); });
    expect(saveMock).toHaveBeenCalledTimes(2);
    expect(writeMock).toHaveBeenCalledWith(destination, pdfBytes);
    expect(result.current.message).toContain("已保存");
  });

  it.each(["dialog", "read", "write"] as const)("%s 失败可见且释放锁；重试完成前不提前报告成功", async (stage) => {
    const failure = new Error(`${stage} permission denied`);
    if (stage === "dialog") saveMock.mockRejectedValueOnce(failure);
    if (stage === "read") readMock.mockRejectedValueOnce(failure);
    if (stage === "write") writeMock.mockRejectedValueOnce(failure);
    const { result } = renderHook(() => useWritingPdfExport(sourceA));
    await act(async () => { await result.current.savePdf(); });
    expect(result.current.saving).toBe(false);
    expect(result.current.error).toContain(failure.message);
    expect(result.current.error).toContain("PDF 保存失败");
    expect(result.current.message).toBe("");
    if (stage === "dialog") expect(readMock).not.toHaveBeenCalled();
    if (stage !== "write") expect(writeMock).not.toHaveBeenCalled();

    const writing = deferred<void>();
    writeMock.mockReturnValueOnce(writing.promise);
    const retry = startSave(result.current.savePdf);
    expect(result.current.saving).toBe(true);
    expect(result.current.error).toBe("");
    await waitFor(() => expect(writeMock).toHaveBeenCalledTimes(stage === "write" ? 2 : 1));
    expect(result.current.message).not.toContain("已保存");
    await act(async () => { writing.resolve(undefined); await retry; });
    expect(result.current.saving).toBe(false);
    expect(result.current.error).toBe("");
    expect(result.current.message).toContain("已保存");
  });

  it("失败后的取消会清除旧失败，不能误报保存成功", async () => {
    writeMock.mockRejectedValueOnce(new Error("Disk full"));
    const { result } = renderHook(() => useWritingPdfExport(sourceA));
    await act(async () => { await result.current.savePdf(); });
    expect(result.current.error).toContain("Disk full");
    saveMock.mockResolvedValueOnce(null);
    await act(async () => { await result.current.savePdf(); });
    expect(result.current).toMatchObject({ saving: false, message: "", error: "" });
    expect(writeMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["/private/output/final-paper.pdf", "final-paper.pdf"],
    ["C:\\private\\output\\最终论文.pdf", "最终论文.pdf"],
  ])("保存到 %s 后只在反馈中呈现文件名", async (target, fileName) => {
    saveMock.mockResolvedValueOnce(target);
    const { result } = renderHook(() => useWritingPdfExport(sourceA));
    await act(async () => { await result.current.savePdf(); });
    expect(writeMock).toHaveBeenCalledWith(target, pdfBytes);
    expect(result.current.message).toBe(`PDF 已保存：${fileName}`);
    expect(result.current.message).not.toContain("private");
  });

  it("目标与源相同时先读完整字节，再写入目标，不先截断源文件", async () => {
    saveMock.mockResolvedValueOnce(sourceA);
    const reading = deferred<typeof pdfBytes>();
    readMock.mockReturnValueOnce(reading.promise);
    const { result } = renderHook(() => useWritingPdfExport(sourceA));
    const job = startSave(result.current.savePdf);
    await waitFor(() => expect(readMock).toHaveBeenCalledWith(sourceA));
    expect(writeMock).not.toHaveBeenCalled();
    await act(async () => { reading.resolve(pdfBytes); await job; });
    expect(writeMock).toHaveBeenCalledWith(sourceA, pdfBytes);
    expect(readMock.mock.invocationCallOrder[0]).toBeLessThan(writeMock.mock.invocationCallOrder[0]);
  });

  it.each(["switch", "unmount"] as const)("动态导入恢复前发生 %s 时不再打开原生选择器", async (change) => {
    const { result, rerender, unmount } = renderHook(useWritingPdfExport, {
      initialProps: sourceA as string | null,
    });
    // Start and change scope synchronously, before the awaited import resumes.
    const job = startSave(result.current.savePdf);
    if (change === "switch") rerender(sourceB);
    else unmount();
    await act(async () => { await job; });
    expect(saveMock).not.toHaveBeenCalled();
    expect(readMock).not.toHaveBeenCalled();
    expect(writeMock).not.toHaveBeenCalled();
    if (change === "switch") expect(result.current.saving).toBe(false);
  });

  describe.each([false, true])("选择器已打开后切换 PDF（再返回 A：%s）", (returnToA) => {
    it.each(["success", "failure"] as const)("继续保存点击时的源，旧 %s 不污染新访问且最后释放锁", async (completion) => {
      const picker = deferred<string | null>();
      saveMock.mockReturnValueOnce(picker.promise);
      if (completion === "failure") writeMock.mockRejectedValueOnce(new Error("Old export failed"));
      const { result, rerender } = renderHook(useWritingPdfExport, {
        initialProps: sourceA as string | null,
      });
      const job = startSave(result.current.savePdf);
      await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(1));
      rerender(sourceB);
      if (returnToA) rerender(sourceA);
      expect(result.current.saving).toBe(true);
      expect(result.current.message).toContain("之前选择");
      await act(async () => { await result.current.savePdf(); });
      expect(saveMock).toHaveBeenCalledTimes(1);
      await act(async () => { picker.resolve(destination); await job; });
      expect(readMock).toHaveBeenCalledWith(sourceA);
      expect(writeMock).toHaveBeenCalledWith(destination, pdfBytes);
      expect(result.current).toMatchObject({ saving: false, message: "", error: "" });

      await act(async () => { await result.current.savePdf(); });
      expect(saveMock).toHaveBeenCalledTimes(2);
      expect(readMock).toHaveBeenLastCalledWith(returnToA ? sourceA : sourceB);
      expect(result.current.message).toContain("已保存");
    });
  });

  it("卸载后仍完成已经打开且确认的保存；卸载前闭包不能再启动保存", async () => {
    const picker = deferred<string | null>();
    saveMock.mockReturnValueOnce(picker.promise);
    const { result, unmount } = renderHook(() => useWritingPdfExport(sourceA));
    const click = result.current.savePdf;
    const job = startSave(click);
    await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(1));
    unmount();
    await act(async () => { picker.resolve(destination); await job; });
    expect(readMock).toHaveBeenCalledWith(sourceA);
    expect(writeMock).toHaveBeenCalledWith(destination, pdfBytes);
    await click();
    expect(saveMock).toHaveBeenCalledTimes(1);
  });

  it("A→B→A 后遗留的 A 保存闭包不能发起新导出", async () => {
    const { result, rerender } = renderHook(useWritingPdfExport, {
      initialProps: sourceA as string | null,
    });
    const staleSave = result.current.savePdf;
    rerender(sourceB);
    rerender(sourceA);
    await act(async () => { await staleSave(); });
    expect(saveMock).not.toHaveBeenCalled();
    await act(async () => { await result.current.savePdf(); });
    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(result.current.message).toContain("已保存");
  });

  it("StrictMode 的 setup/cleanup 重放不会禁用保存或重复导出", async () => {
    const { result } = renderHook(() => useWritingPdfExport(sourceA), { wrapper: StrictWrapper });
    await act(async () => { await result.current.savePdf(); });
    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(readMock).toHaveBeenCalledTimes(1);
    expect(writeMock).toHaveBeenCalledTimes(1);
    expect(result.current).toMatchObject({ saving: false, error: "" });
    expect(result.current.message).toContain("已保存");
  });
});
