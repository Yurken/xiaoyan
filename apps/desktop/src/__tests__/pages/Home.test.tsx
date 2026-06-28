import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithRouter } from "../helpers/render";
import { resetInvokeMock } from "../mocks/tauri";
import Home from "../../pages/Home";

// Mock workbench overview hook
const mockUseWorkbenchOverview = vi.fn();
vi.mock("../../features/workbench/useWorkbenchOverview", () => ({
  useWorkbenchOverview: () => mockUseWorkbenchOverview(),
}));

vi.mock("../../features/workbench/OverviewWorkspace", () => ({
  default: ({ model, beforeQuickActions }: { model: unknown; beforeQuickActions?: React.ReactNode }) => (
    <div data-testid="overview-workspace">
      {beforeQuickActions}
      {JSON.stringify(model)}
    </div>
  ),
}));

vi.mock("../../features/research-context/ContinueResearchPanel", () => ({
  default: () => <div data-testid="continue-research">继续研究</div>,
}));

describe("Home 页面", () => {
  beforeEach(() => {
    resetInvokeMock();
  });

  it("加载中应显示加载动画", () => {
    mockUseWorkbenchOverview.mockReturnValue({ model: null, loading: true, error: null });
    renderWithRouter(<Home />);
    expect(screen.getByText("正在加载工作台…")).toBeInTheDocument();
  });

  it("加载出错应显示错误信息", () => {
    mockUseWorkbenchOverview.mockReturnValue({ model: null, loading: false, error: "网络错误" });
    renderWithRouter(<Home />);
    expect(screen.getByText("无法加载工作台")).toBeInTheDocument();
    expect(screen.getByText("网络错误")).toBeInTheDocument();
  });

  it("无数据应显示空状态引导", () => {
    mockUseWorkbenchOverview.mockReturnValue({ model: null, loading: false, error: null });
    renderWithRouter(<Home />);
    expect(screen.getByText("还没有工作台概览")).toBeInTheDocument();
    expect(screen.getByText("打开规划")).toBeInTheDocument();
    expect(screen.getByText("问问小妍")).toBeInTheDocument();
  });

  it("空状态应有正确的导航链接", () => {
    mockUseWorkbenchOverview.mockReturnValue({ model: null, loading: false, error: null });
    renderWithRouter(<Home />);
    expect(screen.getByText("打开规划").closest("a")).toHaveAttribute("href", "/planner");
    expect(screen.getByText("问问小妍").closest("a")).toHaveAttribute("href", "/xiaoyan");
  });

  it("有数据应显示工作台概览", () => {
    const model = { summary: "测试概览", metrics: [] };
    mockUseWorkbenchOverview.mockReturnValue({ model, loading: false, error: null });
    renderWithRouter(<Home />);
    expect(screen.getByTestId("overview-workspace")).toBeInTheDocument();
    expect(screen.getByTestId("continue-research")).toBeInTheDocument();
  });
});
