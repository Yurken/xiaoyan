import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithRouter } from "../../helpers/render";
import { PapersListPanel } from "../../../features/papers/PapersListPanel";
import type { Paper, ResearchInterest, KnowledgeNote } from "@research-copilot/types";
import type { InterestTreeNode } from "../../../features/papers/interestTree";

const mockInterests: ResearchInterest[] = [
  { id: "folder-1", topic: "Topic 1", folder_name: "Folder 1", created_at: "2024-01-01T00:00:00Z", status: "active" },
  { id: "folder-2", topic: "Topic 2", folder_name: "Folder 2", created_at: "2024-01-01T00:00:00Z", status: "active" },
];

const mockPapers: Paper[] = [
  { id: "paper-a", title: "Paper A", research_interest_id: "folder-1", status: "parsed", created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z" },
  { id: "paper-b", title: "Paper B", research_interest_id: "folder-1", status: "parsed", created_at: "2024-01-02T00:00:00Z", updated_at: "2024-01-02T00:00:00Z" },
  { id: "paper-c", title: "Paper C", research_interest_id: "folder-2", status: "parsed", created_at: "2024-01-03T00:00:00Z", updated_at: "2024-01-03T00:00:00Z" },
];

const folderForest: InterestTreeNode[] = mockInterests.map((i) => ({ interest: i, depth: 0, children: [] }));

const defaultProps = {
  papers: mockPapers,
  interests: mockInterests,
  loading: false,
  loadError: "",
  deletingPaperId: null,
  deletingGroupId: null,
  savingEdit: false,
  folderForest,
  paperGroups: [
    { key: "folder-1", title: "Folder 1", subtitle: "Topic 1", papers: [mockPapers[0], mockPapers[1]] },
    { key: "folder-2", title: "Folder 2", subtitle: "Topic 2", papers: [mockPapers[2]] },
  ],
  ungroupedPapers: [],
  detailPaperId: null,
  taskProgressByPaperId: {},
  getSortKey: () => "created_at" as const,
  getSortDirection: () => "desc" as const,
  onAnalyze: vi.fn(),
  onReproduce: vi.fn(),
  onReparse: vi.fn(),
  onUpdatePaper: vi.fn(),
  onDeletePaper: vi.fn(),
  onDeleteInterestGroup: vi.fn(),
  onOpenDetail: vi.fn(),
  onCloseDetail: vi.fn(),
  interestMap: Object.fromEntries(mockInterests.map((i) => [i.id, i])),
  paperNotesMap: {} as Record<string, KnowledgeNote>,
  onSortKeyChange: vi.fn(),
  onMovePaper: vi.fn(),
  onReorderPaper: vi.fn(),
  onCreateFolder: vi.fn(),
  onMoveFolder: vi.fn(),
};

describe("PapersListPanel paper ordering and move menu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.removeItem("rc:papers:display-mode");
  });

  it("should render paper cards as non-draggable", () => {
    renderWithRouter(<PapersListPanel {...defaultProps} />);

    const paperA = screen.getByText("Paper A").closest("[data-paper-card]");

    expect(paperA).toBeTruthy();
    expect(paperA).not.toHaveAttribute("draggable", "true");
  });

  it("should move paper from the context menu folder flyout", () => {
    const onMovePaper = vi.fn();
    renderWithRouter(<PapersListPanel {...defaultProps} onMovePaper={onMovePaper} />);

    const paperA = screen.getByText("Paper A").closest("[data-paper-card]");
    expect(paperA).toBeTruthy();

    if (!paperA) return;

    fireEvent.contextMenu(paperA);
    fireEvent.mouseEnter(screen.getByRole("menuitem", { name: /移至文件夹/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Folder 2" }));

    expect(onMovePaper).toHaveBeenCalledWith("paper-a", "folder-2");
  });

  it("should change sort key via group controls", () => {
    const onSortKeyChange = vi.fn();
    renderWithRouter(
      <PapersListPanel {...defaultProps} onSortKeyChange={onSortKeyChange} />,
    );

    fireEvent.click(screen.getAllByText("名称")[0]);

    expect(onSortKeyChange).toHaveBeenCalledWith("folder-1", "title");
  });

  it("should show ascending import time sorting in green", () => {
    renderWithRouter(
      <PapersListPanel
        {...defaultProps}
        getSortDirection={() => "asc"}
      />,
    );

    expect(screen.getAllByText("导入时间")[0]).toHaveStyle({ background: "#34C759" });
  });

  it("should switch to a minimal paper list without metadata", () => {
    renderWithRouter(<PapersListPanel {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: "切换为极简展示" }));

    expect(screen.getAllByTestId("paper-compact-row")).toHaveLength(3);
    expect(document.querySelector("[data-paper-card]")).toBeNull();
    expect(window.localStorage.getItem("rc:papers:display-mode")).toBe("minimal");
  });
});
