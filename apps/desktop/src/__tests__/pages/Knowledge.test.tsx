import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithRouter } from "../helpers/render";
import { resetInvokeMock } from "../mocks/tauri";
import Knowledge from "../../pages/Knowledge";

// Mock useKnowledgeGraphWorkspace
vi.mock("../../features/knowledge/useKnowledgeGraphWorkspace", () => ({
  useKnowledgeGraphWorkspace: () => ({
    snapshot: {
      interests: [],
      notes: [],
      nodes: [],
      edges: [],
      evidenceLinks: [],
    },
    view: { visibleEvidenceLinks: [] },
    activeInterestId: null,
    setActiveInterestId: vi.fn(),
    loading: false,
    refresh: vi.fn(),
  }),
}));

// Mock shared utilities
vi.mock("../../features/knowledge/shared", () => ({
  buildInterestSelectOptions: () => [],
  buildNoteClaimCountMap: () => new Map(),
}));

// Mock components
vi.mock("../../features/knowledge/KnowledgeGraphWorkspace", () => ({
  default: () => <div data-testid="graph-workspace">知识图谱工作区</div>,
}));

vi.mock("../../features/knowledge/NotesPanel", () => ({
  default: () => <div data-testid="notes-panel">笔记面板</div>,
}));

// Mock Select component
vi.mock("@research-copilot/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@research-copilot/ui")>();
  return {
    ...actual,
    Select: ({ label, value, onChange, options }: { label?: string; value: string; onChange: (v: string) => void; options: Array<{ value: string; label: string }> }) => (
      <div data-testid="select">
        {label && <label>{label}</label>}
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
    ),
  };
});

describe("Knowledge 页面", () => {
  beforeEach(() => {
    resetInvokeMock();
    localStorage.clear();
  });

  it("应显示知识图谱视图", () => {
    renderWithRouter(<Knowledge />);
    expect(screen.getByText("知识图谱")).toBeInTheDocument();
  });

  it("应显示知识笔记视图", () => {
    renderWithRouter(<Knowledge />);
    expect(screen.getByText("知识笔记")).toBeInTheDocument();
  });

  it("不应暴露小妍的内部 Wiki 入口", () => {
    renderWithRouter(<Knowledge />);
    expect(screen.queryByRole("button", { name: "研究 Wiki" })).not.toBeInTheDocument();
  });

  it("默认应显示知识图谱工作区", () => {
    renderWithRouter(<Knowledge />);
    expect(screen.getByTestId("graph-workspace")).toBeInTheDocument();
  });

  it("旧的 Wiki 视图记录应回退到知识图谱", () => {
    localStorage.setItem("rc:knowledge:view", "wiki");
    renderWithRouter(<Knowledge />);
    expect(screen.getByTestId("graph-workspace")).toBeInTheDocument();
  });
});
