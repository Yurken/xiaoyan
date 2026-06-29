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
    tools: [
      { id: "claude", label: "Claude Code", installed: true, binary_path: "/bin/claude", version: "1.0.0" },
      { id: "codex", label: "Codex", installed: true, binary_path: "/bin/codex", version: "1.0.0" },
      { id: "gemini", label: "Gemini CLI", installed: false, binary_path: null, version: null },
    ],
    toolsLoaded: true,
    anyToolInstalled: true,
    activeTool: "claude",
    setActiveTool: vi.fn(),
    activeModel: "sonnet",
    setActiveModel: vi.fn(),
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

  it("renders the Codex-like code workspace with selectable AI tools", () => {
    render(<ExperimentCodeWorkspace experimentId="exp-1" />);

    expect(screen.getByText("实验代码")).toBeInTheDocument();
    expect(screen.getByText("AI 工具")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Claude Code" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Codex" })).toBeInTheDocument();
    expect(screen.getByText("工作面板")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "终端 ⌘J" })).toBeInTheDocument();
    expect(screen.getByLabelText("终端状态")).toHaveTextContent("Claude Code");
  });
});
