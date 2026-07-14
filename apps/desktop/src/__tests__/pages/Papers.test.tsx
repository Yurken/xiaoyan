import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithRouter } from "../helpers/render";
import { mockInvoke, resetInvokeMock } from "../mocks/tauri";
import Papers from "../../pages/Papers";

// Mock tauri 拖拽事件桥接（全局 setup 未提供 TauriEvent 导出）
vi.mock("../../lib/tauriEvent", () => ({
  safeOnDragDrop: vi.fn(async () => () => {}),
  safeListen: vi.fn(async () => () => {}),
}));

// Mock usePapersList hook
vi.mock("../../features/papers/usePapersList", () => ({
  usePapersList: () => ({
    papers: [],
    setPapers: vi.fn(),
    interests: [],
    loading: false,
    uploading: false,
    batchProgress: null,
    loadError: "",
    setLoadError: vi.fn(),
    deletingPaperId: null,
    savingEdit: false,
    selectedInterestId: "",
    setSelectedInterestId: vi.fn(),
    deletingGroupId: null,
    sortKeys: {},
    getSortKey: vi.fn(() => "created_at"),
    setSortKey: vi.fn(),
    keywordFilters: {},
    setKeywordFilter: vi.fn(),
    titleFilters: {},
    setTitleFilter: vi.fn(),
    paperGroups: [],
    ungroupedPapers: [],
    folderForest: [],
    handleUpload: vi.fn(),
    importPaths: vi.fn(),
    handleAnalyze: vi.fn(),
    handleReproduce: vi.fn(),
    handleReparse: vi.fn(),
    handleUpdatePaper: vi.fn(),
    handleDeletePaper: vi.fn(),
    handleMergePapers: vi.fn(),
    handleDeleteInterestGroup: vi.fn(),
    handleReorderPaper: vi.fn(),
    handleCreateFolder: vi.fn(),
    handleMoveFolder: vi.fn(),
  }),
}));

// usePaperTaskProgress 返回的派生数据被页面解构使用


// Mock usePaperDetailRoute
vi.mock("../../features/papers/usePaperDetailRoute", () => ({
  usePaperDetailRoute: () => ({
    paper: null,
    loading: false,
  }),
}));

// Mock usePaperTaskProgress
vi.mock("../../features/papers/usePaperTaskProgress", () => ({
  usePaperTaskProgress: () => ({
    taskProgressByPaperId: {},
    markPaperTaskStarted: vi.fn(),
    markPaperTaskFailed: vi.fn(),
  }),
}));

// Mock paper components
vi.mock("../../features/papers/PapersListPanel", () => ({
  PapersListPanel: () => <div data-testid="papers-list-panel">论文列表</div>,
}));

vi.mock("../../features/papers/PaperDetailModal", () => ({
  default: () => <div data-testid="paper-detail-modal">论文详情</div>,
}));

vi.mock("../../features/papers/MergeDuplicatesDialog", () => ({
  default: () => <div data-testid="merge-dialog">合并重复</div>,
}));

vi.mock("../../features/papers/CorpusPanel", () => ({
  default: () => <div data-testid="corpus-panel">语料库</div>,
}));

vi.mock("../../features/papers/PaperFolderSection", () => ({
  default: () => <div data-testid="folder-section">文件夹</div>,
}));

vi.mock("../../features/papers/duplicatePapers", () => ({
  findDuplicateGroups: () => [],
}));

vi.mock("../../features/papers/interestTree", () => ({
  buildFolderSelectOptions: () => [],
}));

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

describe("Papers 页面", () => {
  beforeEach(() => {
    resetInvokeMock();
    // 页面挂载时会读取导入识别开关配置
    mockInvoke({
      "settings_get": {},
    });
  });

  it("应显示论文库页签", () => {
    renderWithRouter(<Papers />);
    expect(screen.getByRole("button", { name: "论文库" })).toBeInTheDocument();
  });

  it("应显示论文列表面板", () => {
    renderWithRouter(<Papers />);
    expect(screen.getByTestId("papers-list-panel")).toBeInTheDocument();
  });

  it("应显示导入按钮", () => {
    renderWithRouter(<Papers />);
    expect(screen.getByText("导入 PDF")).toBeInTheDocument();
  });
});
