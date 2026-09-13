import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { KnowledgeNote, ResearchInterest } from "@research-copilot/types";
import NotesSidebar from "../../../features/knowledge/notes/NotesSidebar";

const notes: KnowledgeNote[] = [
  {
    id: "note-1",
    title: "只显示这行标题",
    content: "正文不应出现在笔记列中",
    source_type: "paper_note",
    tags: ["不展示的标签"],
    created_at: "2026-09-12T00:00:00Z",
    updated_at: "2026-09-13T00:00:00Z",
  },
];

const interests: ResearchInterest[] = [{
  id: "interest-1",
  topic: "检索增强生成",
  keywords: [],
  status: "active",
  created_at: "2026-09-01T00:00:00Z",
}];

describe("NotesSidebar", () => {
  it("笔记行只展示标题并保持整行可选", () => {
    const onSelect = vi.fn();
    render(
      <NotesSidebar
        notes={notes}
        interests={[]}
        scope="all"
        selectedId="note-1"
        search=""
        loading={false}
        showScopeFilter
        onScopeChange={vi.fn()}
        onSearchChange={vi.fn()}
        onSelect={onSelect}
        onCreate={vi.fn()}
      />,
    );

    const row = screen.getByRole("option", { name: notes[0].title });
    expect(within(row).getByText(notes[0].title)).toBeInTheDocument();
    expect(within(row).queryByText(notes[0].content)).not.toBeInTheDocument();
    expect(within(row).queryByText(notes[0].source_type)).not.toBeInTheDocument();
    expect(within(row).queryByText("不展示的标签")).not.toBeInTheDocument();
    expect(row).toHaveAttribute("aria-selected", "true");

    fireEvent.click(row);
    expect(onSelect).toHaveBeenCalledWith(notes[0]);
  });

  it("在同一栏内切换全部、未归档和研究主题范围", () => {
    const onScopeChange = vi.fn();
    render(
      <NotesSidebar
        notes={notes}
        interests={interests}
        scope="all"
        selectedId={null}
        search=""
        loading={false}
        showScopeFilter
        onScopeChange={onScopeChange}
        onSearchChange={vi.fn()}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "筛选笔记范围" }));
    fireEvent.click(screen.getByRole("option", { name: "研究主题 · 检索增强生成" }));

    expect(onScopeChange).toHaveBeenCalledWith("interest:interest-1");
  });
});
