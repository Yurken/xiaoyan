import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { KnowledgeNote } from "@research-copilot/types";
import NoteDocumentPane from "../../../features/knowledge/notes/NoteDocumentPane";

const note: KnowledgeNote = {
  id: "note-pane", title: "已保存标题", content: "已保存正文", source_type: "manual",
  created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-22T00:00:00Z",
};
const draftKey = "rc:knowledge:note-draft:note-pane";

function renderPane() {
  const onSave = vi.fn();
  render(<NoteDocumentPane
    note={note} creating={false} initialEditing interests={[]} linkedClaimCount={0}
    onCreate={vi.fn()} onSave={onSave} onCreated={vi.fn()} onDelete={vi.fn()}
  />);
  return { onSave };
}

describe("NoteDocumentPane 草稿恢复", () => {
  beforeEach(() => { localStorage.clear(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it("持久化失败不声称草稿已保存，并能通过界面重试", () => {
    const setItem = vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });
    renderPane();
    fireEvent.change(screen.getByRole("textbox", { name: "笔记标题" }), { target: { value: "未落盘标题" } });

    expect(screen.getByRole("status")).toHaveTextContent("有未保存修改");
    expect(screen.getByRole("alert")).toHaveTextContent("本机草稿写入失败");
    expect(screen.queryByText("草稿已保存在本机")).not.toBeInTheDocument();

    setItem.mockRestore();
    fireEvent.click(screen.getByRole("button", { name: "重试草稿操作" }));
    expect(screen.getByRole("status")).toHaveTextContent("草稿已保存在本机");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(draftKey) ?? "{}").title).toBe("未落盘标题");
  });

  it("冲突提供已保存版本对照，放弃草稿需要明确确认", () => {
    localStorage.setItem(draftKey, JSON.stringify({
      title: "待恢复标题", content: "待恢复正文", research_interest_id: "",
      baseUpdatedAt: "2026-09-21T00:00:00Z",
    }));
    const { onSave } = renderPane();
    expect(screen.getByRole("status")).toHaveTextContent("有其他修改，需处理");
    expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();
    expect(screen.getByText("已保存正文")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "笔记标题" })).toHaveValue("待恢复标题");

    fireEvent.click(screen.getByRole("button", { name: "使用已保存版本" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(screen.getByRole("textbox", { name: "笔记标题" })).toHaveValue("待恢复标题");
    fireEvent.click(screen.getByRole("button", { name: "使用已保存版本" }));
    fireEvent.click(screen.getByRole("button", { name: "放弃草稿" }));

    expect(screen.getByRole("textbox", { name: "笔记标题" })).toHaveValue("已保存标题");
    expect(localStorage.getItem(draftKey)).toBeNull();
    expect(onSave).not.toHaveBeenCalled();
  });
});
