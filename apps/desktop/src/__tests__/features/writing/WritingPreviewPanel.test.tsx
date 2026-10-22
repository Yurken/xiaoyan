import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { save } from "@tauri-apps/plugin-dialog";
import { readFile, writeFile } from "@tauri-apps/plugin-fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WritingPreviewPanel from "../../../features/writing/WritingPreviewPanel";
import type { LatexPreviewBlock, WritingCompileSummary } from "../../../features/writing/shared";

// Keep the real panel, hook, feedback and tabs. Only the native IO and PDF renderer
// are boundaries. Most cases use zero pages; the fullscreen render case supplies
// one synthetic page and a minimal canvas context without running PDF.js.
const pdfRenderer = vi.hoisted(() => ({ getDocument: vi.fn(), getPage: vi.fn(), documentDestroy: vi.fn() }));
vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: { workerSrc: "" },
  getDocument: pdfRenderer.getDocument,
}));
vi.mock("pdfjs-dist/build/pdf.worker.min.mjs?url", () => ({ default: "synthetic-pdf-worker" }));

const saveMock = vi.mocked(save);
const readMock = vi.mocked(readFile);
const writeMock = vi.mocked(writeFile);
const pdfBytes = new Uint8Array([37, 80, 68, 70]);
const source = "/synthetic/compile/main.pdf";
const destination = "/synthetic/export/review.pdf";
const blocks: LatexPreviewBlock[] = [
  { id: "intro", kind: "section", title: "引言", content: "用于预览的正文", level: 1 },
];
const compileResult: WritingCompileSummary = {
  success: true, pdfPath: source, workDir: "/synthetic/compile", engine: "xelatex", log: "",
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function renderPanel() {
  return render(<WritingPreviewPanel blocks={blocks} compileResult={compileResult} compact={false} />);
}

describe("WritingPreviewPanel PDF 预览与保存交互", () => {
  beforeEach(() => {
    saveMock.mockReset().mockResolvedValue(destination);
    readMock.mockReset().mockResolvedValue(pdfBytes);
    writeMock.mockReset().mockResolvedValue(undefined);
    pdfRenderer.getPage.mockReset();
    pdfRenderer.documentDestroy.mockReset().mockResolvedValue(undefined);
    pdfRenderer.getDocument.mockReset().mockImplementation(() => ({
      promise: Promise.resolve({ numPages: 0, getPage: pdfRenderer.getPage, destroy: pdfRenderer.documentDestroy }),
      destroy: vi.fn().mockResolvedValue(undefined),
    }));
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    saveMock.mockReset();
    readMock.mockReset();
    writeMock.mockReset();
  });

  it("切到结构销毁已加载 PDF，返回时创建新 owner，卸载各自只销毁一次", async () => {
    const { unmount } = renderPanel();
    await screen.findByRole("button", { name: "下载 PDF" });
    const firstTask = pdfRenderer.getDocument.mock.results[0].value;
    fireEvent.click(screen.getByRole("button", { name: "结构" }));
    expect(firstTask.destroy).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "下载 PDF" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "PDF" }));
    await screen.findByRole("button", { name: "下载 PDF" });
    expect(pdfRenderer.getDocument).toHaveBeenCalledTimes(2);
    const secondTask = pdfRenderer.getDocument.mock.results[1].value;
    expect(secondTask).not.toBe(firstTask);
    expect(secondTask.destroy).not.toHaveBeenCalled();
    unmount();
    expect(firstTask.destroy).toHaveBeenCalledTimes(1);
    expect(secondTask.destroy).toHaveBeenCalledTimes(1);
    expect(pdfRenderer.documentDestroy).not.toHaveBeenCalled();
  });

  it("PDF 仍在加载时切到结构立即销毁 owner，迟到文档不能恢复旧工具栏", async () => {
    const loading = deferred<{ numPages: number; getPage: typeof pdfRenderer.getPage }>();
    const destroy = vi.fn().mockResolvedValue(undefined);
    pdfRenderer.getDocument.mockReturnValueOnce({ promise: loading.promise, destroy });
    renderPanel();
    await waitFor(() => expect(pdfRenderer.getDocument).toHaveBeenCalledTimes(1));
    expect(screen.getByText("加载 PDF...")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "结构" }));
    expect(destroy).toHaveBeenCalledTimes(1);
    await act(async () => { loading.resolve({ numPages: 0, getPage: pdfRenderer.getPage }); });
    expect(screen.getByText("用于预览的正文")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "下载 PDF" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "PDF" }));
    await screen.findByRole("button", { name: "下载 PDF" });
    expect(pdfRenderer.getDocument).toHaveBeenCalledTimes(2);
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it("进入和退出全屏复用已加载文档，最终卸载才销毁 owner", async () => {
    const { unmount } = renderPanel();
    await screen.findByRole("button", { name: "下载 PDF" });
    const task = pdfRenderer.getDocument.mock.results[0].value;
    fireEvent.click(screen.getByTitle("全屏预览"));
    expect(screen.getAllByTitle("退出全屏").length).toBeGreaterThan(0);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByTitle("全屏预览")).toBeInTheDocument();
    expect(readMock).toHaveBeenCalledTimes(1);
    expect(pdfRenderer.getDocument).toHaveBeenCalledTimes(1);
    expect(task.destroy).not.toHaveBeenCalled();
    unmount();
    expect(task.destroy).toHaveBeenCalledTimes(1);
    expect(pdfRenderer.documentDestroy).not.toHaveBeenCalled();
  });

  it("换 PDF 后立即隐藏旧工具栏，等新文档加载后再提供下载", async () => {
    const { rerender } = renderPanel();
    await screen.findByRole("button", { name: "下载 PDF" });
    const oldTask = pdfRenderer.getDocument.mock.results[0].value;
    const reading = deferred<typeof pdfBytes>();
    readMock.mockReturnValueOnce(reading.promise);
    const nextSummary = { ...compileResult, pdfPath: "/synthetic/compile/next.pdf" };
    rerender(<WritingPreviewPanel blocks={blocks} compileResult={nextSummary} compact={false} />);
    expect(screen.queryByRole("button", { name: "下载 PDF" })).not.toBeInTheDocument();
    expect(screen.queryByTitle("全屏预览")).not.toBeInTheDocument();
    expect(screen.getByText("加载 PDF...")).toBeInTheDocument();
    expect(oldTask.destroy).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(readMock).toHaveBeenCalledWith(nextSummary.pdfPath));
    await act(async () => { reading.resolve(pdfBytes); });
    await screen.findByRole("button", { name: "下载 PDF" });
    expect(pdfRenderer.getDocument).toHaveBeenCalledTimes(2);
  });

  it("下载失败在实际预览中可见，重试写入完成后才呈现成功并恢复下载按钮", async () => {
    writeMock.mockRejectedValueOnce(new Error("目标目录不可写"));
    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: "下载 PDF" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("PDF 保存失败：目标目录不可写");
    expect(screen.getByRole("alert")).not.toHaveClass("mr-16");
    expect(screen.getByRole("button", { name: "下载 PDF" })).toBeEnabled();
    expect(screen.queryByText(/PDF 已保存/)).not.toBeInTheDocument();

    const writing = deferred<void>();
    writeMock.mockReturnValueOnce(writing.promise);
    fireEvent.click(screen.getByRole("button", { name: "重试保存" }));
    await waitFor(() => expect(writeMock).toHaveBeenCalledTimes(2));
    const busyButton = screen.getByRole("button", { name: "正在保存 PDF" });
    expect(busyButton).toBeDisabled();
    expect(busyButton).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status")).toHaveTextContent("正在保存 PDF");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText(/PDF 已保存/)).not.toBeInTheDocument();
    await act(async () => { writing.resolve(undefined); });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("PDF 已保存：review.pdf"));
    expect(screen.getByRole("button", { name: "下载 PDF" })).toBeEnabled();
    expect(saveMock).toHaveBeenCalledTimes(2);
    expect(writeMock).toHaveBeenLastCalledWith(destination, pdfBytes);
    expect(pdfRenderer.getPage).not.toHaveBeenCalled();
  });

  it("全屏 portal 内可见失败与重试，反馈预留关闭按钮空间，退出全屏后恢复普通间距", async () => {
    writeMock.mockRejectedValueOnce(new Error("磁盘已满"));
    const { container } = renderPanel();
    await screen.findByRole("button", { name: "下载 PDF" });
    fireEvent.click(screen.getByTitle("全屏预览"));
    fireEvent.click(screen.getByRole("button", { name: "下载 PDF" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("磁盘已满");
    expect(container.contains(alert)).toBe(false);
    expect(alert).toHaveClass("mr-16");
    fireEvent.click(screen.getByRole("button", { name: "重试保存" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("PDF 已保存：review.pdf"));
    expect(container.contains(screen.getByRole("status"))).toBe(false);
    expect(screen.getByRole("status")).toHaveClass("mr-16");
    expect(screen.getAllByTitle("退出全屏").length).toBeGreaterThan(0);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(container.contains(screen.getByRole("status"))).toBe(true);
    expect(screen.getByRole("status")).not.toHaveClass("mr-16");
    expect(screen.getByTitle("全屏预览")).toBeInTheDocument();
  });

  it("切到结构并返回 PDF 不丢失在途保存锁，已选目标仍保存原 PDF", async () => {
    const picker = deferred<string | null>();
    const writing = deferred<void>();
    saveMock.mockReturnValueOnce(picker.promise);
    writeMock.mockReturnValueOnce(writing.promise);
    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: "下载 PDF" }));
    await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "结构" }));
    expect(screen.getByText("用于预览的正文")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "下载 PDF" })).not.toBeInTheDocument();

    await act(async () => { picker.resolve(destination); });
    await waitFor(() => expect(writeMock).toHaveBeenCalledWith(destination, pdfBytes));
    expect(readMock).toHaveBeenLastCalledWith(source);
    fireEvent.click(screen.getByRole("button", { name: "PDF" }));
    const busyButton = await screen.findByRole("button", { name: "正在保存 PDF" });
    expect(busyButton).toBeDisabled();
    fireEvent.click(busyButton);
    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toHaveTextContent("正在保存 PDF");
    await act(async () => { writing.resolve(undefined); });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("PDF 已保存：review.pdf"));
    expect(screen.getByRole("button", { name: "下载 PDF" })).toBeEnabled();
    expect(writeMock).toHaveBeenCalledTimes(1);
  });

  it("取消选择不会在实际面板中留下错误或假成功，也不写文件", async () => {
    saveMock.mockResolvedValueOnce(null);
    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: "下载 PDF" }));
    await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole("button", { name: "下载 PDF" })).toBeEnabled());
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(writeMock).not.toHaveBeenCalled();
  });

  it("读取失败后可重试同一 PDF，重试加载期间隐藏重试和下载，成功后恢复工具栏", async () => {
    const reading = deferred<typeof pdfBytes>();
    readMock.mockRejectedValueOnce(new Error("读取失败")).mockReturnValueOnce(reading.promise);
    renderPanel();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("无法加载 PDF 预览");
    expect(alert).toHaveTextContent("可重试预览；若文件已移动或删除，请重新编译 PDF。");
    expect(screen.getByRole("button", { name: "下载 PDF" })).toBeEnabled();
    expect(pdfRenderer.getDocument).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "重试预览" }));
    expect(screen.getByRole("status", { name: "正在加载 PDF 预览" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "重试预览" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "下载 PDF" })).not.toBeInTheDocument();
    expect(screen.queryByTitle("全屏预览")).not.toBeInTheDocument();
    await waitFor(() => expect(readMock).toHaveBeenCalledTimes(2));
    expect(readMock.mock.calls.map(([path]) => path)).toEqual([source, source]);

    await act(async () => { reading.resolve(pdfBytes); });
    expect(await screen.findByRole("button", { name: "下载 PDF" })).toBeEnabled();
    expect(screen.getByTitle("全屏预览")).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "正在加载 PDF 预览" })).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "重试预览" })).not.toBeInTheDocument();
    expect(pdfRenderer.getDocument).toHaveBeenCalledTimes(1);
    expect(pdfRenderer.getDocument).toHaveBeenCalledWith({ data: pdfBytes });
    expect(saveMock).not.toHaveBeenCalled();
    expect(writeMock).not.toHaveBeenCalled();
  });

  it("预览重试仍失败时重新提供重试入口，下一次成功恢复同一 PDF", async () => {
    const retryReading = deferred<typeof pdfBytes>();
    const finalReading = deferred<typeof pdfBytes>();
    readMock.mockRejectedValueOnce(new Error("首次读取失败"))
      .mockReturnValueOnce(retryReading.promise)
      .mockReturnValueOnce(finalReading.promise);
    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: "重试预览" }));
    await waitFor(() => expect(readMock).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("status", { name: "正在加载 PDF 预览" })).toBeInTheDocument();

    await act(async () => { retryReading.reject(new Error("再次读取失败")); });
    expect(screen.getByRole("alert")).toHaveTextContent("无法加载 PDF 预览");
    expect(screen.getByRole("button", { name: "重试预览" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "重试预览" }));
    expect(screen.getByRole("status", { name: "正在加载 PDF 预览" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "重试预览" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "下载 PDF" })).not.toBeInTheDocument();
    await waitFor(() => expect(readMock).toHaveBeenCalledTimes(3));

    await act(async () => { finalReading.resolve(pdfBytes); });
    await screen.findByRole("button", { name: "下载 PDF" });
    expect(screen.getByTitle("全屏预览")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(readMock.mock.calls.map(([path]) => path)).toEqual([source, source, source]);
    expect(pdfRenderer.getDocument).toHaveBeenCalledTimes(1);
    expect(saveMock).not.toHaveBeenCalled();
    expect(writeMock).not.toHaveBeenCalled();
  });

  it("PDF 解析失败后仍能独立保存原文件，错误区下载保留保存锁和成功反馈", async () => {
    pdfRenderer.getDocument.mockImplementationOnce(() => { throw new Error("无法解析 PDF"); });
    const writing = deferred<void>();
    writeMock.mockReturnValueOnce(writing.promise);
    renderPanel();
    expect(await screen.findByRole("alert")).toHaveTextContent("无法加载 PDF 预览");
    expect(screen.queryByTitle("全屏预览")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "下载 PDF" }));
    await waitFor(() => expect(writeMock).toHaveBeenCalledWith(destination, pdfBytes));
    const busyButton = screen.getByRole("button", { name: "正在保存 PDF" });
    expect(busyButton).toBeDisabled();
    expect(busyButton).toHaveAttribute("aria-busy", "true");
    expect(busyButton).toHaveAttribute("title", "正在保存 PDF");
    expect(screen.getByRole("status")).toHaveTextContent("正在保存 PDF");
    expect(screen.getByRole("alert")).toHaveTextContent("无法加载 PDF 预览");
    fireEvent.click(busyButton);
    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(writeMock).toHaveBeenCalledTimes(1);

    await act(async () => { writing.resolve(undefined); });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("PDF 已保存：review.pdf"));
    expect(screen.getByRole("button", { name: "下载 PDF" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "重试预览" })).toBeEnabled();
    expect(screen.getByRole("alert")).toHaveTextContent("无法加载 PDF 预览");
    expect(readMock.mock.calls.map(([path]) => path)).toEqual([source, source]);
    expect(pdfRenderer.getDocument).toHaveBeenCalledTimes(1);
    expect(pdfRenderer.getPage).not.toHaveBeenCalled();
    expect(writeMock).toHaveBeenCalledTimes(1);
  });

  it("错误区保存期间重试预览不丢在途导出锁，原写入完成后当前预览继续显示成功反馈", async () => {
    pdfRenderer.getDocument.mockImplementationOnce(() => { throw new Error("无法解析 PDF"); });
    const writing = deferred<void>();
    writeMock.mockReturnValueOnce(writing.promise);
    renderPanel();
    expect(await screen.findByRole("alert")).toHaveTextContent("无法加载 PDF 预览");
    fireEvent.click(screen.getByRole("button", { name: "下载 PDF" }));
    await waitFor(() => expect(writeMock).toHaveBeenCalledWith(destination, pdfBytes));
    expect(screen.getByRole("button", { name: "正在保存 PDF" })).toBeDisabled();
    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(readMock).toHaveBeenCalledTimes(2);

    // Queue the preview read only after export has read its original source.
    const reading = deferred<typeof pdfBytes>();
    readMock.mockReturnValueOnce(reading.promise);
    fireEvent.click(screen.getByRole("button", { name: "重试预览" }));
    expect(screen.getByRole("status", { name: "正在加载 PDF 预览" })).toBeInTheDocument();
    expect(screen.getByText("正在保存 PDF…")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "重试预览" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "下载 PDF" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "正在保存 PDF" })).not.toBeInTheDocument();
    await waitFor(() => expect(readMock).toHaveBeenCalledTimes(3));

    await act(async () => { reading.resolve(pdfBytes); });
    const busyButton = await screen.findByRole("button", { name: "正在保存 PDF" });
    expect(busyButton).toBeDisabled();
    expect(busyButton).toHaveAttribute("aria-busy", "true");
    expect(screen.getByTitle("全屏预览")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("正在保存 PDF");
    expect(screen.queryByRole("status", { name: "正在加载 PDF 预览" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "重试预览" })).not.toBeInTheDocument();
    expect(screen.queryByText(/PDF 已保存/)).not.toBeInTheDocument();
    fireEvent.click(busyButton);
    fireEvent.click(busyButton);
    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(writeMock).toHaveBeenCalledTimes(1);
    expect(readMock.mock.calls.map(([path]) => path)).toEqual([source, source, source]);
    expect(pdfRenderer.getDocument).toHaveBeenCalledTimes(2);

    await act(async () => { writing.resolve(undefined); });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("PDF 已保存：review.pdf"));
    const download = screen.getByRole("button", { name: "下载 PDF" });
    expect(download).toBeEnabled();
    expect(download).toHaveAttribute("aria-busy", "false");
    expect(screen.getByTitle("全屏预览")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(writeMock).toHaveBeenCalledTimes(1);
    expect(writeMock).toHaveBeenLastCalledWith(destination, pdfBytes);
  });

  it("全屏绘制失败后在 portal 内重试同一 PDF，加载和恢复均保持全屏及关闭入口", async () => {
    const context = { setTransform: vi.fn() } as unknown as CanvasRenderingContext2D;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
    const fullscreenRendering = deferred<void>();
    const page = {
      getViewport: vi.fn(() => ({ width: 600, height: 800 })),
      render: vi.fn().mockImplementation(() => ({ promise: Promise.resolve(), cancel: vi.fn() })),
    };
    page.render.mockReturnValueOnce({ promise: Promise.resolve(), cancel: vi.fn() })
      .mockReturnValueOnce({ promise: fullscreenRendering.promise, cancel: vi.fn() });
    pdfRenderer.getPage.mockResolvedValue(page);
    pdfRenderer.getDocument.mockImplementation(() => ({
      promise: Promise.resolve({ numPages: 1, getPage: pdfRenderer.getPage, destroy: pdfRenderer.documentDestroy }),
      destroy: vi.fn().mockResolvedValue(undefined),
    }));
    const { container } = renderPanel();
    await waitFor(() => expect(page.render).toHaveBeenCalledTimes(1));
    const oldTask = pdfRenderer.getDocument.mock.results[0].value;
    fireEvent.click(screen.getByTitle("全屏预览"));
    await waitFor(() => expect(page.render).toHaveBeenCalledTimes(2));
    await act(async () => { fullscreenRendering.reject(new Error("全屏绘制失败")); });

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("无法加载 PDF 预览");
    expect(container.contains(alert)).toBe(false);
    expect(screen.getByTitle("退出全屏")).toBeEnabled();
    expect(oldTask.destroy).toHaveBeenCalledTimes(1);
    const reading = deferred<typeof pdfBytes>();
    readMock.mockReturnValueOnce(reading.promise);
    fireEvent.click(screen.getByRole("button", { name: "重试预览" }));
    const loading = screen.getByRole("status", { name: "正在加载 PDF 预览" });
    expect(container.contains(loading)).toBe(false);
    expect(screen.getByTitle("退出全屏")).toBeEnabled();
    expect(screen.queryByRole("button", { name: "重试预览" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "下载 PDF" })).not.toBeInTheDocument();
    await waitFor(() => expect(readMock).toHaveBeenCalledTimes(2));

    await act(async () => { reading.resolve(pdfBytes); });
    await waitFor(() => expect(page.render).toHaveBeenCalledTimes(3));
    const download = screen.getByRole("button", { name: "下载 PDF" });
    expect(container.contains(download)).toBe(false);
    expect(screen.getAllByTitle("退出全屏").length).toBeGreaterThan(0);
    expect(screen.queryByTitle("全屏预览")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "正在加载 PDF 预览" })).not.toBeInTheDocument();
    expect(readMock.mock.calls.map(([path]) => path)).toEqual([source, source]);
    expect(pdfRenderer.getDocument).toHaveBeenCalledTimes(2);
    expect(oldTask.destroy).toHaveBeenCalledTimes(1);
    expect(pdfRenderer.documentDestroy).not.toHaveBeenCalled();
    expect(saveMock).not.toHaveBeenCalled();
    expect(writeMock).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByTitle("全屏预览")).toBeInTheDocument();
    expect(container.contains(screen.getByRole("button", { name: "下载 PDF" }))).toBe(true);
  });
});
