import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "../helpers/render";
import { ExperimentCodeWorkspace } from "../../features/experiment/ExperimentCodeWorkspace";

const { useCodeWorkspaceMock } = vi.hoisted(() => ({
  useCodeWorkspaceMock: vi.fn(),
}));

vi.mock("../../features/code/useCodeWorkspace", () => ({
  useCodeWorkspace: useCodeWorkspaceMock,
}));

function createWorkspace(overrides: Record<string, unknown> = {}) {
  return {
    workingDir: "/Users/sen/hit/xiaoyan",
    setWorkingDir: vi.fn(),
    chooseWorkingDir: vi.fn(),
    openFile: null,
    openFileByPath: vi.fn(),
    updateFileContent: vi.fn(),
    saveOpenFile: vi.fn(),
    closeOpenFile: vi.fn(),
    fs: {
      entries: [],
      loading: false,
      listDir: vi.fn(),
      readFile: vi.fn(),
      writeFile: vi.fn(),
    },
    sessions: [
      {
        id: "session-1",
        experiment_id: "exp-1",
        title: "复现实验脚本",
        messages: [],
        working_dir: "/Users/sen/hit/xiaoyan",
        tool_id: "claude",
        model: "sonnet",
        created_at: "2026-06-29T00:00:00.000Z",
        updated_at: "2026-06-29T00:00:00.000Z",
      },
    ],
    selected: null,
    selectedId: "session-1",
    selectSession: vi.fn(),
    chatLoading: false,
    sending: false,
    streamingContent: "",
    input: "",
    setInput: vi.fn(),
    toast: "",
    handleCreateSession: vi.fn(),
    handleDeleteSession: vi.fn(),
    handleSend: vi.fn(),
    currentModel: "deepseek-chat",
    modelOptions: [
      {
        id: "openai_compatible:deepseek-chat",
        provider: "openai_compatible",
        providerLabel: "OpenAI-Compatible",
        model: "deepseek-chat",
        label: "OpenAI-Compatible · deepseek-chat",
      },
      {
        id: "anthropic:claude-3-5-haiku-20241022",
        provider: "anthropic",
        providerLabel: "Anthropic",
        model: "claude-3-5-haiku-20241022",
        label: "Anthropic · claude-3-5-haiku-20241022",
      },
    ],
    activeModelOptionId: "openai_compatible:deepseek-chat",
    changeModelOption: vi.fn(),
    treeOpen: true,
    setTreeOpen: vi.fn(),
    chatCollapsed: false,
    setChatCollapsed: vi.fn(),
    ...overrides,
  };
}

describe("ExperimentCodeWorkspace", () => {
  beforeEach(() => {
    useCodeWorkspaceMock.mockReturnValue(createWorkspace());
  });

  it("renders the OpenCode-style three-column code workspace", () => {
    render(<ExperimentCodeWorkspace experimentId="exp-1" />);

    // 顶部 header 已移除，工作目录选择器已上提到 Experiment 页面头部
    expect(screen.queryByText("小妍代码")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "选择工作目录" })).not.toBeInTheDocument();

    // Left sidebar
    expect(screen.getByText("新建会话")).toBeInTheDocument();
    expect(screen.getByText("复现实验脚本")).toBeInTheDocument();
    // 会话列表始终展开，不再显示折叠标题
    expect(screen.queryByText("会话列表")).not.toBeInTheDocument();

    // Right tools tabs
    expect(screen.getByText("文件")).toBeInTheDocument();
    expect(screen.getByText("编辑器")).toBeInTheDocument();
    expect(screen.getByText("审查")).toBeInTheDocument();
    expect(screen.getByText("Git")).toBeInTheDocument();

    // Chat input
    expect(screen.getByPlaceholderText(/随便问点什么/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "添加文件" })).toBeInTheDocument();
    expect(screen.getByLabelText("切换模型")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "OpenAI-Compatible · deepseek-chat" })).toBeInTheDocument();
    expect(screen.queryByText("当前模型")).not.toBeInTheDocument();

    // 不再提供旧版工作面板与终端条
    expect(screen.queryByText("工作面板")).not.toBeInTheDocument();
    expect(screen.queryByText("终端 ⌘J")).not.toBeInTheDocument();
  });
});
