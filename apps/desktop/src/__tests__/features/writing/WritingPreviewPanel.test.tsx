import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { save } from "@tauri-apps/plugin-dialog";
import { readFile, writeFile } from "@tauri-apps/plugin-fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WritingPreviewPanel from "../../../features/writing/WritingPreviewPanel";
import type { LatexPreviewBlock, WritingCompileSummary } from "../../../features/writing/shared";

// Keep the real panel, hook, feedback and tabs. Only the native IO and PDF renderer
// are boundaries: zero synthetic pages avoid canvas/DOMMatrix work in jsdom.
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
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
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
    const reading = deferred<Uint8Array>();
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
});
