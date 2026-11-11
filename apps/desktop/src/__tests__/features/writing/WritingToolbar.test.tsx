import type { ComponentProps } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import WritingToolbar from "../../../features/writing/WritingToolbar";

describe("WritingToolbar 编译反馈", () => {
  afterEach(cleanup);

  it("切换已有结果的文稿时清除前一篇成功提示，保持编译按钮和焦点", () => {
    const props: ComponentProps<typeof WritingToolbar> = {
      libraryStatus: "文稿已保存",
      viewMode: "split",
      compileDraftId: "draft-a",
      compileStatus: "compiling",
      exportingTarget: null,
      onViewModeChange: vi.fn(),
      onNewDraft: vi.fn(),
      onManageDrafts: vi.fn(),
      onImportFile: vi.fn(),
      onImportProject: vi.fn(),
      onCompile: vi.fn(),
      onExport: vi.fn(),
    };
    const { rerender } = render(<WritingToolbar {...props} />);
    const button = screen.getByRole("button", { name: "编译 PDF" });
    rerender(<WritingToolbar {...props} compileStatus="ready" />);
    expect(screen.getByRole("button", { name: "编译完成" })).toBe(button);
    button.focus();

    rerender(<WritingToolbar {...props} compileDraftId="draft-b" compileStatus="ready" />);
    expect(screen.getByRole("button", { name: "编译 PDF" })).toBe(button);
    expect(button).toHaveFocus();
    expect(screen.queryByRole("button", { name: "编译完成" })).not.toBeInTheDocument();

    rerender(<WritingToolbar {...props} compileStatus="ready" />);
    expect(screen.getByRole("button", { name: "编译 PDF" })).toBe(button);
  });
});
