import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithRouter } from "../helpers/render";
import { getInvokeMock, resetInvokeMock } from "../mocks/tauri";
import Submission from "../../pages/Submission";

// Submission 页面挂载时各 feature hook 会通过 submissionApi/apiClient(底层 invoke)
// 拉取期刊会议、投稿列表、CCF 目录、研究兴趣等。这里按命令返回正确形状的默认值，
// 避免 hook 内 response.venues.map / undefined.then 等空值崩溃。
function mockSubmissionInvoke() {
  getInvokeMock().mockImplementation(async (cmd: string) => {
    switch (cmd) {
      case "submission_list_venues":
        return { venues: [] };
      case "submission_list":
        return { submissions: [] };
      case "ccf_list":
        return { venues: [] };
      case "knowledge_list_interests":
        return [];
      case "submission_list_versions":
        return { versions: [] };
      case "submission_list_rounds":
        return { rounds: [] };
      case "submission_list_comments":
        return { comments: [] };
      case "submission_get_checklist":
        return { checklist: [] };
      case "submission_list_diagnosis_reports":
        return { reports: [] };
      case "submission_list_revision_tasks":
        return { tasks: [] };
      case "submission_stats":
        return { active: 0, pendingReviews: 0, upcomingDdls: [] };
      default:
        return undefined;
    }
  });
}

// Mock submission components
vi.mock("../../features/submission/VenueTrackerWorkspace", () => ({
  default: () => <div data-testid="venue-tracker">期刊会议追踪</div>,
}));

vi.mock("../../features/submission/KanbanWorkspace", () => ({
  default: () => <div data-testid="kanban-workspace">看板</div>,
}));

vi.mock("../../features/submission/ReviewWorkspace", () => ({
  default: () => <div data-testid="review-workspace">审稿意见</div>,
}));

vi.mock("../../features/submission/ChecklistWorkspace", () => ({
  default: () => <div data-testid="checklist-workspace">清单</div>,
}));

vi.mock("../../features/submission/VersionWorkspace", () => ({
  default: () => <div data-testid="version-workspace">版本管理</div>,
}));

// 注意：不 mock SubmissionPageHeader —— 页面标题、描述与标签栏(SubmissionTabs/CapsuleTabs)
// 都由真实的 header 渲染，这里需要它真实挂载才能对标题/描述/标签做有意义的断言。

// Mock CapsuleTabs
vi.mock("@research-copilot/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@research-copilot/ui")>();
  return {
    ...actual,
    CapsuleTabs: ({ options, value, onChange }: { options: Array<{ value: string; label: string }>; value: string; onChange: (v: string) => void }) => (
      <div data-testid="capsule-tabs">
        {options.map((opt) => (
          <button
            key={opt.value}
            data-testid={`tab-${opt.value}`}
            onClick={() => onChange(opt.value)}
            style={{ fontWeight: value === opt.value ? "bold" : "normal" }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    ),
  };
});

describe("Submission 页面", () => {
  beforeEach(() => {
    resetInvokeMock();
    mockSubmissionInvoke();
    localStorage.clear();
  });

  it("应显示标签页切换", () => {
    renderWithRouter(<Submission />);
    expect(screen.getByText("DDL 日历")).toBeInTheDocument();
    expect(screen.getByText("投稿看板")).toBeInTheDocument();
    expect(screen.getByText("审稿归档")).toBeInTheDocument();
    expect(screen.getByText("提交清单")).toBeInTheDocument();
    expect(screen.getByText("版本控制")).toBeInTheDocument();
  });

  it("默认应显示期刊会议追踪", () => {
    renderWithRouter(<Submission />);
    expect(screen.getByTestId("venue-tracker")).toBeInTheDocument();
  });

  it("点击看板应切换标签", () => {
    renderWithRouter(<Submission />);
    // 点击「投稿看板」标签，应切换到看板工作区
    const kanbanTab = screen.getByTestId("tab-kanban");
    fireEvent.click(kanbanTab);
    expect(screen.getByTestId("kanban-workspace")).toBeInTheDocument();
    expect(screen.queryByTestId("venue-tracker")).not.toBeInTheDocument();
  });
});
