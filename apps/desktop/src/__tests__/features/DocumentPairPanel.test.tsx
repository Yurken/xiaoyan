import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DocumentPairPanel } from "../../features/document-checker/DocumentPairPanel";

describe("DocumentPairPanel", () => {
  it("要求先选择规范文档和待校验文档", () => {
    const onChoose = vi.fn();
    render(
      <DocumentPairPanel
        referenceFile={null}
        candidateFile={null}
        loading={false}
        canCompare={false}
        onChoose={onChoose}
        onClear={vi.fn()}
        onCompare={vi.fn()}
      />,
    );

    expect(screen.getByText("规范文档")).toBeInTheDocument();
    expect(screen.getByText("待校验文档")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "提取规范并开始比对" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "选择规范文档" }));
    fireEvent.click(screen.getByRole("button", { name: "选择待校验文档" }));
    expect(onChoose).toHaveBeenNthCalledWith(1, "reference");
    expect(onChoose).toHaveBeenNthCalledWith(2, "candidate");
  });

  it("两份文档就绪后允许开始比对和重新选择", () => {
    const onCompare = vi.fn();
    const onClear = vi.fn();
    render(
      <DocumentPairPanel
        referenceFile={{ path: "/tmp/rules.docx", name: "投稿规范.docx" }}
        candidateFile={{ path: "/tmp/paper.pdf", name: "论文成稿.pdf" }}
        loading={false}
        canCompare
        onChoose={vi.fn()}
        onClear={onClear}
        onCompare={onCompare}
      />,
    );

    expect(screen.getByText("投稿规范.docx")).toBeInTheDocument();
    expect(screen.getByText("论文成稿.pdf")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "提取规范并开始比对" }));
    expect(onCompare).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: "移除规范文档" }));
    expect(onClear).toHaveBeenCalledWith("reference");
  });
});
