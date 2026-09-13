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
    expect(screen.getByRole("textbox", { name: "发给小妍的问题" })).toBeEnabled();
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
    fireEvent.click(screen.getByRole("link", { name: /论文消融分析/ }));
    expect(screen.getByTestId("destination")).toHaveTextContent('"assistantConversationId":"session-1"');
    expect(screen.getByTestId("destination")).toHaveTextContent('"path":"/chat"');
  });

  it("建议填入草稿，发送时携带问题开启新对话", () => {
    renderWithRouter(<><Home /><Destination /></>);
    fireEvent.click(screen.getByRole("button", { name: "帮我把一个模糊的选题，变成可以验证的研究问题" }));
    const input = screen.getByRole("textbox", { name: "发给小妍的问题" });
    expect(input).toHaveValue("帮我把一个模糊的选题，变成可以验证的研究问题");
    fireEvent.change(input, { target: { value: "  研究问题\n需要对照实验  " } });
    fireEvent.click(screen.getByRole("button", { name: "发送给小妍" }));
    expect(screen.getByTestId("destination")).toHaveTextContent('"homePrompt":"研究问题\\n需要对照实验"');
    expect(screen.getByTestId("destination")).toHaveTextContent('"path":"/chat"');
  });

  it("中文输入法确认和 Shift Enter 不触发发送", () => {
    renderWithRouter(<><Home /><Destination /></>);
    const input = screen.getByRole("textbox", { name: "发给小妍的问题" });
    fireEvent.change(input, { target: { value: "研究" } });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(screen.getByTestId("destination")).toHaveTextContent('"path":"/"');
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByTestId("destination")).toHaveTextContent('"path":"/chat"');
  });

  it("空状态提供开始入口，不制造进度指标", () => {
    renderWithRouter(<Home />);
    expect(screen.getByText("今天想弄清什么？")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "待处理提醒" })).not.toBeInTheDocument();
    expect(screen.queryByText("今日推进")).not.toBeInTheDocument();
  });
});
