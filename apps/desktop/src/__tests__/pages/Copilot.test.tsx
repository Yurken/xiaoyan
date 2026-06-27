import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithRouter } from "../helpers/render";
import { getInvokeMock, resetInvokeMock } from "../mocks/tauri";
import Copilot from "../../pages/Copilot";

// 共享 setup 的 @tauri-apps/api/event mock 缺少 TauriEvent 导出，
// 而拖拽区 hook(useCopilotDropZone -> safeOnDragDrop) 在挂载时会引用它。
// 在测试文件内补齐该 mock，避免未处理的拒绝。
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
  once: vi.fn(),
  TauriEvent: {
    DRAG_ENTER: "tauri://drag-enter",
    DRAG_OVER: "tauri://drag-over",
    DRAG_DROP: "tauri://drag-drop",
    DRAG_LEAVE: "tauri://drag-leave",
  },
}));

// Copilot 页面挂载时各 hook 会通过 apiClient(底层 invoke) 拉取会话/兴趣/技能。
// 这里按命令返回正确形状的默认值，避免 hook 内 undefined.then 报错。
function mockCopilotInvoke() {
  getInvokeMock().mockImplementation(async (cmd: string) => {
    switch (cmd) {
      case "chat_list_sessions":
        return [];
      case "knowledge_list_interests":
        return [];
      case "skills_list":
        return [];
      default:
        return undefined;
    }
  });
}

// Mock copilot components
vi.mock("../../features/copilot/CopilotSessionSidebar", () => ({
  CopilotSessionSidebar: () => <div data-testid="session-sidebar">会话侧边栏</div>,
}));

vi.mock("../../features/copilot/CopilotChatArea", () => ({
  CopilotChatArea: () => <div data-testid="chat-area">对话区域</div>,
}));

vi.mock("../../features/copilot/CopilotComposer", () => ({
  default: () => <div data-testid="composer">消息输入</div>,
}));

vi.mock("../../features/copilot/CopilotOverviewSidebar", () => ({
  default: () => <div data-testid="overview-sidebar">概览</div>,
}));

vi.mock("../../features/copilot/SkillVariableFillModal", () => ({
  default: () => null,
}));

vi.mock("../../features/copilot/shared", () => ({
  parseCopilotMessageContent: (text: string) => text,
}));

describe("Copilot 页面", () => {
  beforeEach(() => {
    resetInvokeMock();
    mockCopilotInvoke();
    localStorage.clear();
  });

  it("应渲染对话界面", () => {
    renderWithRouter(<Copilot />);
    expect(screen.getByTestId("chat-area")).toBeInTheDocument();
  });

  it("应显示消息输入组件", () => {
    renderWithRouter(<Copilot />);
    expect(screen.getByTestId("composer")).toBeInTheDocument();
  });

  it("应显示会话侧边栏", () => {
    renderWithRouter(<Copilot />);
    expect(screen.getByTestId("session-sidebar")).toBeInTheDocument();
  });
});
