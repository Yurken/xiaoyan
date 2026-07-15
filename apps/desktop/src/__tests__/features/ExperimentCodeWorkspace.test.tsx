import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, within } from "../helpers/render";
import { ExperimentCodeWorkspace } from "../../features/experiment/ExperimentCodeWorkspace";

const { useCodeWorkspaceMock, skillsApiMock } = vi.hoisted(() => ({
  useCodeWorkspaceMock: vi.fn(),
  skillsApiMock: { list: vi.fn().mockResolvedValue([]) },
}));

vi.mock("../../features/code/useCodeWorkspace", () => ({
  useCodeWorkspace: useCodeWorkspaceMock,
}));

vi.mock("../../lib/client", async () => {
  const actual = await vi.importActual("../../lib/client");
  return { ...actual, skillsApi: skillsApiMock };
});

function createWorkspace(overrides: Record<string, unknown> = {}) {
  return {
    workingDir: "/Users/researcher/projects/xiaoyan",
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
        working_dir: "/Users/researcher/projects/xiaoyan",
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
    pickFromDrop: vi.fn(),
    currentModel: "deepseek-chat",
    modelOptions: [
      {
        id: "openai_compatible:deepseek-chat",
        provider: "openai_compatible",
        providerLabel: "OpenAI-Compatible",
        model: "deepseek-chat",
        label: "deepseek-chat",
      },
      {
        id: "anthropic:claude-3-5-haiku-20241022",
        provider: "anthropic",
        providerLabel: "Anthropic",
        model: "claude-3-5-haiku-20241022",
        label: "claude-3-5-haiku-20241022",
      },
    ],
    activeModelOptionId: "openai_compatible:deepseek-chat",
    changeModelOption: vi.fn(),
    treeOpen: true,
    setTreeOpen: vi.fn(),
    chatCollapsed: false,
    setChatCollapsed: vi.fn(),
    permissionRequests: [],
    resolvePermission: vi.fn(),
    contextPack: {
      stats: { files: 0, chars: 0, tokens: 0 },
      loading: false,
      injectContext: vi.fn(),
    },
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
    // 会话按工作目录（项目）分组显示
    const sidebar = screen.getByLabelText("会话");
    expect(within(sidebar).getByText("xiaoyan")).toBeInTheDocument();
    // 会话列表始终展开，不再显示折叠标题
    expect(screen.queryByText("会话列表")).not.toBeInTheDocument();

    // Right tools tabs
    expect(screen.getByText("文件")).toBeInTheDocument();
    expect(screen.getByText("审查")).toBeInTheDocument();
    expect(screen.getByText("Git")).toBeInTheDocument();
    expect(screen.queryByText("编辑器")).not.toBeInTheDocument();

    // Chat input
    expect(screen.getByPlaceholderText(/让小妍做点什么/)).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "deepseek-chat" })).toBeInTheDocument();
    expect(screen.queryByText("当前模型")).not.toBeInTheDocument();

    // 不再提供旧版工作面板与终端条
    expect(screen.queryByText("工作面板")).not.toBeInTheDocument();
    expect(screen.queryByText("终端 ⌘J")).not.toBeInTheDocument();
  });

  it("打开文件后在弹窗中编辑，而不占用右侧工具栏", () => {
    useCodeWorkspaceMock.mockReturnValue(createWorkspace({
      openFile: {
        path: "/Users/researcher/projects/xiaoyan/example.ts",
        name: "example.ts",
        content: "export const answer = 42;",
        originalContent: "export const answer = 42;",
        dirty: false,
      },
    }));

    render(<ExperimentCodeWorkspace experimentId="exp-1" />);

    expect(screen.getByRole("dialog", { name: "example.ts" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "example.ts 编辑器" })).toHaveValue("export const answer = 42;");
    expect(screen.queryByText("编辑器")).not.toBeInTheDocument();
  });

  it("可收起并重新展开左右侧边栏", async () => {
    render(<ExperimentCodeWorkspace experimentId="exp-1" />);

    const collapseLeft = screen.getByRole("button", { name: "收起会话栏" });
    const collapseRight = screen.getByRole("button", { name: "收起工具栏" });

    // 收起左侧
    await userEvent.click(collapseLeft);
    expect(screen.queryByLabelText("会话")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "展开会话栏" })).toBeInTheDocument();

    // 收起右侧
    await userEvent.click(collapseRight);
    expect(screen.queryByLabelText("工具")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "展开工具栏" })).toBeInTheDocument();

    // 重新展开
    await userEvent.click(screen.getByRole("button", { name: "展开会话栏" }));
    expect(screen.getByLabelText("会话")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "展开工具栏" }));
    expect(screen.getByLabelText("工具")).toBeInTheDocument();
  });
});
