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

  it("renders the Xiaoyan-native code workspace without tool switcher", () => {
    render(<ExperimentCodeWorkspace experimentId="exp-1" />);

    expect(screen.getByText("实验代码")).toBeInTheDocument();
    expect(screen.getAllByText("AI 助手").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("小妍代码助手").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("工作面板")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "终端 ⌘J" })).toBeInTheDocument();
    expect(screen.getByLabelText("终端状态")).toHaveTextContent("小妍代码助手");
    // 不再提供本地 AI 工具切换下拉框。
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });
});
