import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import type { Paper } from "@research-copilot/types";
import { renderWithRouter } from "../../helpers/render";
import PaperCompactRow from "../../../features/papers/PaperCompactRow";

const paper: Paper = {
  id: "paper-1",
  title: "A Minimal Paper Row",
  authors: "Ada Lovelace, Grace Hopper",
  venue: "Research Conference",
  year: 2026,
  tags: ["important", "graph-rag"],
  notes: "这段备注不应出现在极简展示中。",
  status: "parsed",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("PaperCompactRow", () => {
  it("only renders the title and right-side actions", () => {
    renderWithRouter(
      <PaperCompactRow
        paper={paper}
        detailPaperId={null}
        onAnalyze={vi.fn()}
        onReproduce={vi.fn()}
        onOpenDetail={vi.fn()}
        onCloseDetail={vi.fn()}
      />,
    );

    expect(screen.getByText(paper.title)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: `查看 ${paper.title} 详情` })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: `${paper.title}：生成复现/验证指南` })).toBeInTheDocument();
    expect(screen.queryByText("Ada Lovelace, Grace Hopper")).not.toBeInTheDocument();
    expect(screen.queryByText("Research Conference")).not.toBeInTheDocument();
    expect(screen.queryByText("important")).not.toBeInTheDocument();
    expect(screen.queryByText("这段备注不应出现在极简展示中。")).not.toBeInTheDocument();
  });
});
