import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import WritingPdfExportFeedback from "../../../features/writing/WritingPdfExportFeedback";

describe("WritingPdfExportFeedback", () => {
  it("无反馈时不占据界面空间", () => {
    const { container } = render(
      <WritingPdfExportFeedback saving={false} message="" error="" onRetry={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("保存中使用状态语义，不提供重复保存入口", () => {
    render(
      <WritingPdfExportFeedback saving message="正在保存 PDF…" error="" onRetry={vi.fn()} />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("正在保存 PDF…");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("失败使用 alert，重试回调只由按钮触发，保存中禁用重试", () => {
    const onRetry = vi.fn();
    const { rerender } = render(
      <WritingPdfExportFeedback saving={false} message="" error="PDF 保存失败：磁盘已满" onRetry={onRetry} />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("磁盘已满");
    expect(onRetry).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "重试保存" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    rerender(
      <WritingPdfExportFeedback saving message="" error="PDF 保存失败：磁盘已满" onRetry={onRetry} />,
    );
    expect(screen.getByRole("button", { name: "重试保存" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "重试保存" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("成功反馈使用 status 并支持调用方为全屏关闭按钮预留空间", () => {
    const { rerender } = render(
      <WritingPdfExportFeedback saving={false} message="PDF 已保存：论文.pdf" error="" onRetry={vi.fn()} />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("PDF 已保存：论文.pdf");
    expect(screen.getByRole("status")).not.toHaveClass("mr-16");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    rerender(
      <WritingPdfExportFeedback
        saving={false}
        message="PDF 已保存：论文.pdf"
        error=""
        onRetry={vi.fn()}
        className="mr-16"
      />,
    );
    expect(screen.getByRole("status")).toHaveClass("mr-16");
  });
});
