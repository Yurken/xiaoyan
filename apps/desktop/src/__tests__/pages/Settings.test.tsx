import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "../helpers/render";
import { resetInvokeMock } from "../mocks/tauri";
import { DEFAULT_SETTINGS } from "../../features/settings/pageConfig";
import Settings from "../../pages/Settings";

// Settings.tsx 内联渲染胶囊导航并直接消费 SETTINGS_SECTIONS，因此 pageConfig 不做
// mock，让真实的分区元数据（标签/key/默认 guided）参与渲染；下面只 mock 重型
// section 组件与依赖后端的 feature hook，避免触发真实网络/Tauri 调用。

vi.mock("../../features/settings/useSettingsController", () => ({
  useSettingsController: () => ({
    form: DEFAULT_SETTINGS,
    setForm: vi.fn(),
    replaceForm: vi.fn(),
    set: () => vi.fn(),
    setMany: () => vi.fn(),
    setManyFlat: vi.fn(),
    getSharedValue: () => "",
    hasMixedValue: () => false,
    loading: false,
    loadError: "",
    saveState: "idle",
    testState: "idle",
    testMsg: "",
    updateState: "idle",
    updateInfo: null,
    updateMsg: "",
    downloadProgress: null,
    appVersion: "1.0.0",
    markSaved: vi.fn(),
    handleSaveSettings: vi.fn(),
    handleTestConnection: vi.fn(),
    handleCheckUpdate: vi.fn(),
    handleInstallUpdate: vi.fn(),
  }),
}));

vi.mock("../../features/settings/useSettingsCrypto", () => ({
  useSettingsCrypto: () => ({
    modal: null,
    password: "",
    confirm: "",
    busy: false,
    error: "",
    setPassword: vi.fn(),
    setConfirm: vi.fn(),
    closeModal: vi.fn(),
    openExportModal: vi.fn(),
    openImportPicker: vi.fn(),
    handleConfirm: vi.fn(),
  }),
}));

vi.mock("../../features/settings/useSettingsHistory", () => ({
  useSettingsHistory: () => ({
    entries: [],
    loading: false,
    loadError: "",
    draftName: "",
    selectedId: "",
    saving: false,
    applyingId: null,
    updatingId: null,
    deletingId: null,
    actionError: "",
    actionMessage: "",
    busy: false,
    setDraftName: vi.fn(),
    setSelectedId: vi.fn(),
    saveCurrent: vi.fn(),
    applyHistory: vi.fn(),
    updateHistory: vi.fn(),
    deleteHistory: vi.fn(),
    reload: vi.fn(),
  }),
}));

vi.mock("../../features/settings/useSettingsMemories", () => ({
  useSettingsMemories: () => ({
    memories: [],
    observations: [],
    loading: false,
    loadError: "",
    clearingAuto: false,
    privacy: { enabled: false, loading: false, unlocked: true, accessPassword: "" },
    enter: vi.fn(),
    deleteMemory: vi.fn(),
    clearAuto: vi.fn(),
  }),
}));

vi.mock("../../features/settings/useLayoutSettingsController", () => ({
  useLayoutSettingsController: () => ({
    currentTheme: "light",
    pendingLayout: "landscape",
    changeLayout: vi.fn(),
    changeTheme: vi.fn(),
  }),
}));

vi.mock("../../features/settings/useDataBackup", () => ({
  useDataBackup: () => ({
    modal: null,
    password: "",
    confirm: "",
    busy: false,
    error: "",
    setPassword: vi.fn(),
    setConfirm: vi.fn(),
    closeModal: vi.fn(),
    openExportModal: vi.fn(),
    openImportPicker: vi.fn(),
    handleConfirm: vi.fn(),
  }),
}));

// 各分区内容组件（默认导出）替换为占位，隔离其内部副作用。
vi.mock("../../features/settings/TaskSetupSection", () => ({
  default: () => <div data-testid="task-setup">引导配置</div>,
}));
vi.mock("../../features/settings/AssistantSettingsSection", () => ({
  default: () => <div data-testid="assistant-settings">助手设置</div>,
}));
vi.mock("../../features/settings/LayoutSettingsSection", () => ({
  default: () => <div data-testid="layout-settings">布局设置</div>,
}));
vi.mock("../../features/settings/SkillsSection", () => ({
  default: () => <div data-testid="skills-section">技能管理</div>,
}));
vi.mock("../../features/settings/MemorySection", () => ({
  default: () => <div data-testid="memory-section">记忆管理</div>,
}));
vi.mock("../../features/settings/AboutSection", () => ({
  default: () => <div data-testid="about-section">关于</div>,
}));
vi.mock("../../features/settings/SettingsHistorySection", () => ({
  default: () => <div data-testid="history-section">配置历史</div>,
}));
vi.mock("../../features/settings/SettingsChangelogCard", () => ({
  default: () => <div data-testid="changelog-card">更新日志</div>,
  formatUpdateDate: () => "",
  getChangelogReleaseDate: () => "",
}));
vi.mock("../../features/settings/FeedbackSection", () => ({
  default: () => <div data-testid="feedback-section">反馈</div>,
}));
vi.mock("../../features/settings/CryptoConfigModal", () => ({
  default: () => <div data-testid="crypto-modal" />,
}));
vi.mock("../../features/settings/ConfigHistoryManageModal", () => ({
  default: () => <div data-testid="config-manage-modal" />,
}));

describe("Settings 页面", () => {
  beforeEach(() => {
    resetInvokeMock();
    localStorage.clear();
  });

  it("应渲染设置页面（默认显示引导分区）", async () => {
    render(<Settings />);
    await waitFor(() => {
      expect(screen.getByTestId("task-setup")).toBeInTheDocument();
    });
  });

  it("应显示导航栏所有分区标签", () => {
    render(<Settings />);
    expect(screen.getByText("快速开始")).toBeInTheDocument();
    expect(screen.getByText("小妍")).toBeInTheDocument();
    expect(screen.getByText("界面布局")).toBeInTheDocument();
    expect(screen.getByText("数据与配置")).toBeInTheDocument();
    expect(screen.getByText("升级与日志")).toBeInTheDocument();
  });

  it("点击「小妍」分区应切换到助手设置内容", async () => {
    render(<Settings />);
    fireEvent.click(screen.getByText("小妍"));
    await waitFor(() => {
      expect(screen.getByTestId("assistant-settings")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("task-setup")).not.toBeInTheDocument();
  });

  it("点击「升级与日志」分区应切换到关于内容", async () => {
    render(<Settings />);
    fireEvent.click(screen.getByText("升级与日志"));
    await waitFor(() => {
      expect(screen.getByTestId("about-section")).toBeInTheDocument();
    });
  });
});
