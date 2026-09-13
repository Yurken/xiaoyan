import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { useLocation } from "react-router-dom";
import { renderWithRouter } from "../helpers/render";
import Home from "../../pages/Home";
import { EMPTY_HOME } from "../../features/workbench/home/shared";

const mockUseWorkbenchOverview = vi.fn();
vi.mock("../../features/workbench/useWorkbenchOverview", () => ({
  useWorkbenchOverview: () => mockUseWorkbenchOverview(),
}));

function Destination() {
  const location = useLocation();
  return <output data-testid="destination">{JSON.stringify({ path: location.pathname, state: location.state })}</output>;
}

describe("Home 页面", () => {
  beforeEach(() => {
    mockUseWorkbenchOverview.mockReturnValue({ model: EMPTY_HOME, loading: false, error: "", refresh: vi.fn() });
  });

  it("加载中仍可直接打开工作入口", () => {
    mockUseWorkbenchOverview.mockReturnValue({ model: EMPTY_HOME, loading: true, error: "", refresh: vi.fn() });
    renderWithRouter(<Home />);
    expect(screen.getByText("正在读取近期工作…")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /读一篇论文/ })).toHaveAttribute("href", "/papers");
    expect(screen.getByRole("link", { name: /写一段文稿/ })).toHaveAttribute("href", "/writing");
  });

  it("失败时保留工作入口且不误报暂无提醒，并支持重试", () => {
    const refresh = vi.fn();
    mockUseWorkbenchOverview.mockReturnValue({ model: EMPTY_HOME, loading: false, error: "部分记录暂时无法读取", refresh });
    renderWithRouter(<Home />);
    expect(screen.getByRole("status")).toHaveTextContent("部分记录暂时无法读取");
    expect(screen.queryByText("暂无待处理提醒。")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "刷新首页" }));
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("只展示一次最近记录，继续对话携带正确会话", () => {
    mockUseWorkbenchOverview.mockReturnValue({
      model: { ...EMPTY_HOME, recent: [{ id: "chat:1", kind: "chat", title: "论文消融分析", context: "", updatedAt: "2026-09-13", action: { label: "继续对话", to: "/chat", state: { assistantConversationId: "session-1" } } }] },
      loading: false, error: "", refresh: vi.fn(),
    });
    renderWithRouter(<><Home /><Destination /></>);
    expect(screen.getAllByText("论文消融分析")).toHaveLength(1);
    fireEvent.click(screen.getByRole("link", { name: "继续对话" }));
    expect(screen.getByTestId("destination")).toHaveTextContent('"assistantConversationId":"session-1"');
    expect(screen.getByTestId("destination")).toHaveTextContent('"path":"/chat"');
  });

  it("空状态提供开始入口，不制造进度指标", () => {
    renderWithRouter(<Home />);
    expect(screen.getByText("还没想清楚，也可以开始。")).toBeInTheDocument();
    expect(screen.getByText("暂无待处理提醒。")).toBeInTheDocument();
    expect(screen.queryByText("今日推进")).not.toBeInTheDocument();
  });
});
