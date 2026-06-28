import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "../helpers/render";
import { mockInvoke, resetInvokeMock } from "../mocks/tauri";
import Writing from "../../pages/Writing";

// Mock writing hooks
vi.mock("../../features/writing/useWritingWorkspace", () => ({
  useWritingWorkspace: () => ({
    documents: [],
    currentDoc: null,
    loading: false,
    compiling: false,
    compileResult: null,
    outline: [],
    diagnostics: [],
    statistics: null,
    compile: vi.fn(),
    save: vi.fn(),
    createDoc: vi.fn(),
    deleteDoc: vi.fn(),
    switchDoc: vi.fn(),
    exportDoc: vi.fn(),
  }),
}));

vi.mock("../../features/writing/useWritingAssistant", () => ({
  useWritingAssistant: () => ({
    suggestions: [],
    loading: false,
    requestSuggestion: vi.fn(),
    applySuggestion: vi.fn(),
  }),
}));

vi.mock("../../features/writing/useWritingCompiler", () => ({
  useWritingCompiler: () => ({
    compiling: false,
    result: null,
    compile: vi.fn(),
  }),
}));

vi.mock("../../features/writing/useWritingDraftLibrary", () => ({
  useWritingDraftLibrary: () => ({
    drafts: [],
    loading: false,
    refresh: vi.fn(),
  }),
}));

// Mock writing components
vi.mock("../../features/writing/WritingWorkspace", () => ({
  default: () => <div data-testid="writing-workspace">写作工作区</div>,
}));

vi.mock("../../features/writing/WritingSidebar", () => ({
  default: () => <div data-testid="writing-sidebar">写作侧边栏</div>,
}));

vi.mock("../../features/writing/WritingEditorPanel", () => ({
  default: () => <div data-testid="writing-editor">编辑器</div>,
}));

vi.mock("../../features/writing/WritingPreviewPanel", () => ({
  default: () => <div data-testid="writing-preview">预览</div>,
}));

vi.mock("../../features/writing/WritingAssistantPanel", () => ({
  default: () => <div data-testid="writing-assistant">AI 助手</div>,
}));

describe("Writing 页面", () => {
  beforeEach(() => {
    resetInvokeMock();
  });

  it("应渲染写作页面", async () => {
    mockInvoke({
      "list_writing_documents": { documents: [] },
    });
    render(<Writing />);
    await waitFor(() => {
      expect(screen.getByText(/写作/)).toBeInTheDocument();
    });
  });

  it("应显示写作工作区", async () => {
    mockInvoke({
      "list_writing_documents": { documents: [] },
    });
    render(<Writing />);
    await waitFor(() => {
      expect(screen.getByTestId("writing-workspace")).toBeInTheDocument();
    });
  });
});
