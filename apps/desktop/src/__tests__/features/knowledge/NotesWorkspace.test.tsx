import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { KnowledgeNote, ResearchInterest } from "@research-copilot/types";
import NotesWorkspace from "../../../features/knowledge/notes/NotesWorkspace";

const interests: ResearchInterest[] = [{
  id: "interest-1",
  topic: "检索增强生成",
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
});
