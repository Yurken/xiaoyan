import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { KnowledgeNote } from "@research-copilot/types";
import NoteTitleList from "../../../features/knowledge/notes/NoteTitleList";

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

describe("NoteTitleList", () => {
  it("笔记行只展示标题并保持整行可选", () => {
    const onSelect = vi.fn();
    render(
      <NoteTitleList
        notes={notes}
        selectedId="note-1"
        search=""
        loading={false}
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
});
