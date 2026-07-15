import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import NotesFilterBar from "../../../features/knowledge/NotesFilterBar";

describe("NotesFilterBar", () => {
  it("使用下拉框切换知识笔记来源", () => {
    const onSourceChange = vi.fn();

    render(
      <NotesFilterBar
        sourceOptions={[
          { value: "all", label: "全部" },
          { value: "paper_note", label: "论文笔记" },
          { value: "web_clip", label: "网页剪藏" },
        ]}
        sourceValue="all"
        onSourceChange={onSourceChange}
        search=""
        onSearchChange={vi.fn()}
        viewMode="card"
        onViewModeChange={vi.fn()}
        actions={null}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "按来源筛选知识笔记" }));
    fireEvent.click(screen.getByRole("option", { name: "论文笔记" }));

    expect(onSourceChange).toHaveBeenCalledWith("paper_note");
  });
});
