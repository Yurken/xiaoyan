import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { KnowledgeNote, ResearchInterest } from "@research-copilot/types";
import NotesWorkspace from "../../../features/knowledge/notes/NotesWorkspace";
import { apiClient } from "../../../lib/client";

const interests: ResearchInterest[] = [{
  id: "interest-1",
  topic: "检索增强生成",
  keywords: [],
  status: "active",
  created_at: "2026-09-01T00:00:00Z",
}, {
  id: "interest-2",
  topic: "智能体协作",
  keywords: [],
  status: "active",
  created_at: "2026-09-01T00:00:00Z",
}];

const notes: KnowledgeNote[] = [
  {
    id: "note-1",
    title: "第一篇笔记",
    content: "第一篇正文",
    source_type: "manual",
    research_interest_id: "interest-1",
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-13T02:00:00Z",
  },
  {
    id: "note-2",
    title: "第二篇笔记",
    content: "第二篇正文里的独有内容",
    source_type: "paper_note",
    research_interest_id: "interest-1",
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-13T01:00:00Z",
  },
];

describe("NotesWorkspace", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("整个工作区重挂载后仍接收在途创建的结果并选中正式笔记", async () => {
    let finishCreation!: (note: KnowledgeNote) => void;
    const pending = new Promise<KnowledgeNote>((resolve) => { finishCreation = resolve; });
    const created = { ...notes[0], id: "created-after-workspace-remount", title: "跨工作区保存的笔记" };
    const createNote = vi.spyOn(apiClient.knowledge, "createNote").mockReturnValue(pending);
    const original = render(<NotesWorkspace initialNotes={notes} initialInterests={interests} />);
    fireEvent.click(screen.getByRole("button", { name: "新建" }));
    fireEvent.change(screen.getByRole("textbox", { name: "笔记标题" }), { target: { value: created.title } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(createNote).toHaveBeenCalledTimes(1);
    original.unmount();

    render(<NotesWorkspace initialNotes={notes} initialInterests={interests} />);
    fireEvent.click(screen.getByRole("button", { name: "新建" }));
    await act(async () => { finishCreation(created); });

    expect(createNote).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("option", { name: created.title })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("textbox", { name: "笔记标题" })).toHaveValue(created.title);
  });

  it("工具栏不再重复显示页面标题和说明", () => {
    render(
      <NotesWorkspace
        toolbarStart={<button type="button">知识笔记页签</button>}
        initialNotes={notes}
        initialInterests={interests}
      />,
    );

    expect(screen.getByRole("button", { name: "知识笔记页签" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "导出当前笔记" })).toBeInTheDocument();
    expect(screen.queryByText("阅读、编辑和整理研究过程中的笔记。")).not.toBeInTheDocument();
  });

  it("在标题列表中切换笔记并在右侧阅读正文", async () => {
    render(<NotesWorkspace initialNotes={notes} initialInterests={interests} />);

    const list = screen.getByRole("listbox", { name: "笔记标题" });
    const first = within(list).getByRole("option", { name: "第一篇笔记" });
    const second = within(list).getByRole("option", { name: "第二篇笔记" });
    expect(within(first).queryByText("第一篇正文")).not.toBeInTheDocument();

    await waitFor(() => expect(screen.getByRole("heading", { name: "第一篇笔记", level: 1 })).toBeInTheDocument());
    fireEvent.click(second);

    expect(screen.getByRole("heading", { name: "第二篇笔记", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("第二篇正文里的独有内容")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("searchbox", { name: "搜索当前范围的笔记" }), {
      target: { value: "独有内容" },
    });
    expect(within(list).getAllByRole("option")).toHaveLength(1);
    expect(within(list).getByRole("option", { name: "第二篇笔记" })).toBeInTheDocument();
    expect(within(list).queryByText("第二篇正文里的独有内容")).not.toBeInTheDocument();
  });

  it("搜索隐藏当前笔记或没有结果时保留编辑草稿，清除搜索后仍保持选中", () => {
    render(<NotesWorkspace initialNotes={notes} initialInterests={interests} />);
    fireEvent.click(screen.getByRole("button", { name: "编辑" }));
    fireEvent.change(screen.getByRole("textbox", { name: "笔记标题" }), {
      target: { value: "尚未保存的标题" },
    });
    const search = screen.getByRole("searchbox", { name: "搜索当前范围的笔记" });
    const list = screen.getByRole("listbox", { name: "笔记标题" });

    fireEvent.change(search, { target: { value: "独有内容" } });
    expect(within(list).getAllByRole("option")).toHaveLength(1);
    expect(within(list).getByRole("option", { name: "第二篇笔记" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByText("当前笔记不在筛选结果中")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "笔记标题" })).toHaveValue("尚未保存的标题");

    fireEvent.change(search, { target: { value: "不存在的关键词" } });
    expect(screen.getByText("没有匹配的笔记")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "笔记标题" })).toHaveValue("尚未保存的标题");

    fireEvent.change(search, { target: { value: "" } });
    expect(screen.queryByText("当前笔记不在筛选结果中")).not.toBeInTheDocument();
    expect(within(list).getByRole("option", { name: "第一篇笔记" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("textbox", { name: "笔记标题" })).toHaveValue("尚未保存的标题");

    fireEvent.click(within(list).getByRole("option", { name: "第二篇笔记" }));
    expect(screen.getByRole("heading", { name: "第二篇笔记", level: 1 })).toBeInTheDocument();
  });

  it("切换范围筛选只改变标题列表，返回全部笔记仍保留打开的正文", () => {
    render(<NotesWorkspace initialNotes={notes} initialInterests={interests} />);

    fireEvent.click(screen.getByRole("button", { name: "筛选笔记范围" }));
    fireEvent.click(screen.getByRole("option", { name: "未归档" }));
    expect(screen.getByText("这里还没有笔记")).toBeInTheDocument();
    expect(screen.getByText("当前笔记不在筛选结果中")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "第一篇笔记", level: 1 })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "筛选笔记范围" }));
    fireEvent.click(screen.getByRole("option", { name: "全部笔记" }));
    expect(screen.queryByText("当前笔记不在筛选结果中")).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "第一篇笔记" })).toHaveAttribute("aria-selected", "true");
  });

  it.each([undefined, "interest-1"])("保存后移出当前主题仍保持打开（主题上下文：%s）", async (researchInterestId) => {
    const moved = { ...notes[0], research_interest_id: "interest-2", updated_at: "2026-09-22T01:00:00Z" };
    const updateNote = vi.spyOn(apiClient.knowledge, "updateNote").mockResolvedValue(moved);
    render(<NotesWorkspace researchInterestId={researchInterestId} initialNotes={notes} initialInterests={interests} />);
    if (!researchInterestId) {
      fireEvent.click(screen.getByRole("button", { name: "筛选笔记范围" }));
      fireEvent.click(screen.getByRole("option", { name: "研究主题 · 检索增强生成" }));
    }
    fireEvent.click(screen.getByRole("button", { name: "编辑" }));
    fireEvent.click(screen.getByRole("button", { name: "详情" }));
    fireEvent.click(screen.getByRole("button", { name: "检索增强生成" }));
    fireEvent.click(screen.getByRole("option", { name: "智能体协作" }));
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(screen.getByText("当前笔记不在筛选结果中")).toBeInTheDocument());
    expect(updateNote).toHaveBeenCalledWith("note-1", expect.objectContaining({ research_interest_id: "interest-2" }));
    expect(screen.getByRole("textbox", { name: "笔记标题" })).toHaveValue("第一篇笔记");
    expect(screen.getByRole("button", { name: "智能体协作" })).toBeInTheDocument();
    const list = screen.getByRole("listbox", { name: "笔记标题" });
    expect(within(list).queryByRole("option", { name: "第一篇笔记" })).not.toBeInTheDocument();
    expect(within(list).getByRole("option", { name: "第二篇笔记" })).toHaveAttribute("aria-selected", "false");
  });

  it("外部切换主题会清除旧搜索并打开新主题笔记，退出主题恢复全部范围", () => {
    const otherNote = { ...notes[0], id: "note-3", title: "另一主题笔记", content: "另一主题正文", research_interest_id: "interest-2" };
    const allNotes = [...notes, otherNote];
    const { rerender } = render(<NotesWorkspace researchInterestId="interest-1" initialNotes={allNotes} initialInterests={interests} />);
    fireEvent.change(screen.getByRole("searchbox", { name: "搜索当前范围的笔记" }), { target: { value: "第一篇" } });

    rerender(<NotesWorkspace researchInterestId="interest-2" initialNotes={allNotes} initialInterests={interests} />);
    expect(screen.getByRole("searchbox", { name: "搜索当前范围的笔记" })).toHaveValue("");
    expect(screen.getByRole("heading", { name: "另一主题笔记", level: 1 })).toBeInTheDocument();
    expect(screen.queryByText("第一篇正文")).not.toBeInTheDocument();
    expect(screen.queryByText("当前笔记不在筛选结果中")).not.toBeInTheDocument();

    rerender(<NotesWorkspace researchInterestId="empty-interest" initialNotes={allNotes} initialInterests={interests} />);
    expect(screen.getByText("选择一篇笔记开始阅读")).toBeInTheDocument();
    expect(screen.queryByText("另一主题正文")).not.toBeInTheDocument();

    rerender(<NotesWorkspace initialNotes={allNotes} initialInterests={interests} />);
    expect(screen.getByRole("button", { name: "筛选笔记范围" })).toHaveTextContent("全部笔记");
    expect(screen.getByRole("heading", { name: "第一篇笔记", level: 1 })).toBeInTheDocument();
    expect(within(screen.getByRole("listbox", { name: "笔记标题" })).getAllByRole("option")).toHaveLength(3);
  });

  it("新建时外部切换主题退出旧新建会话", () => {
    const { rerender } = render(<NotesWorkspace researchInterestId="interest-1" initialNotes={notes} initialInterests={interests} />);
    fireEvent.click(screen.getByRole("button", { name: "新建" }));
    fireEvent.change(screen.getByRole("textbox", { name: "笔记标题" }), { target: { value: "原主题的草稿" } });

    rerender(<NotesWorkspace researchInterestId="interest-2" initialNotes={notes} initialInterests={interests} />);
    expect(screen.getByText("选择一篇笔记开始阅读")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "笔记标题" })).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("rc:knowledge:note-draft:new:interest-1") ?? "null"))
      .toMatchObject({ title: "原主题的草稿", research_interest_id: "interest-1" });
  });
});
