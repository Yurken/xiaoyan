import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import type { KnowledgeNote } from "@research-copilot/types";
import { renderWithRouter } from "../../helpers/render";
import NoteCompactRow from "../../../features/knowledge/NoteCompactRow";

const note: KnowledgeNote = {
  id: "note-1",
  title: "A Minimal Research Note",
  content: "这段笔记正文不应出现在极简展示中。",
  source_type: "paper_note",
  source_id: "paper-1",
  tags: ["graph-rag"],
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-02T00:00:00Z",
};

describe("NoteCompactRow", () => {
  it("only renders the title and right-side actions", () => {
    renderWithRouter(<NoteCompactRow note={note} onDelete={vi.fn()} />);

    expect(screen.getByText(note.title)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: `打开 ${note.title}` })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: `删除 ${note.title}` })).toBeInTheDocument();
    expect(screen.queryByText(note.content)).not.toBeInTheDocument();
    expect(screen.queryByText("paper_note")).not.toBeInTheDocument();
    expect(screen.queryByText("graph-rag")).not.toBeInTheDocument();
    expect(screen.queryByText("2026-01-01T00:00:00Z")).not.toBeInTheDocument();
  });
});
