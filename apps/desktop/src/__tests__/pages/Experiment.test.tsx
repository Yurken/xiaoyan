import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "../helpers/render";
import { mockInvoke, resetInvokeMock, createMockExperiment, getInvokeMock } from "../mocks/tauri";
import Experiment from "../../pages/Experiment";

// Mock useDomainEventRefresh
vi.mock("../../hooks/useDomainEventRefresh", () => ({
  useDomainEventRefresh: () => {},
}));

// Mock ExperimentAttachmentPanel
vi.mock("../../features/experiment/ExperimentAttachmentPanel", () => ({
  ExperimentAttachmentPanel: () => <div data-testid="attachment-panel">附件面板</div>,
}));

describe("Experiment 页面", () => {
  beforeEach(() => {
    resetInvokeMock();
  });

  it("应渲染页面标题和描述", async () => {
    mockInvoke({
      "experiment_list": { experiments: [] },
      "submission_list": { submissions: [] },
    });
    render(<Experiment />);
    expect(screen.getByText("实验记录")).toBeInTheDocument();
    expect(screen.getByText(/记录实验配置与结果/)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("暂无记录，点击上方「新建」开始。")).toBeInTheDocument();
    });
  });

  it("加载中应显示加载动画", async () => {
    mockInvoke({
      "experiment_list": { experiments: [] },
      "submission_list": { submissions: [] },
    });
    render(<Experiment />);
    // The loading spinner should appear initially
    expect(screen.getByText("实验记录")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("暂无记录，点击上方「新建」开始。")).toBeInTheDocument();
    });
  });

  it("无记录应显示空状态提示", async () => {
    mockInvoke({
      "experiment_list": { experiments: [] },
      "submission_list": { submissions: [] },
    });
    render(<Experiment />);
    await waitFor(() => {
      expect(screen.getByText("暂无记录，点击上方「新建」开始。")).toBeInTheDocument();
    });
  });

  it("应显示新建记录按钮", async () => {
    mockInvoke({
      "experiment_list": { experiments: [] },
      "submission_list": { submissions: [] },
    });
    render(<Experiment />);
    await waitFor(() => {
      expect(screen.getByText("新建记录")).toBeInTheDocument();
    });
  });

  it("应显示未选择状态的提示", async () => {
    mockInvoke({
      "experiment_list": { experiments: [] },
      "submission_list": { submissions: [] },
    });
    render(<Experiment />);
    await waitFor(() => {
      expect(screen.getByText("从左侧选择记录，或新建一条")).toBeInTheDocument();
    });
  });

  it("有记录时应显示列表", async () => {
    const exp = createMockExperiment();
    mockInvoke({
      "experiment_list": { experiments: [exp] },
      "submission_list": { submissions: [] },
    });
    render(<Experiment />);
    await waitFor(() => {
      expect(screen.getByText("Test Experiment")).toBeInTheDocument();
    });
  });

  it("点击记录应选中并显示详情", async () => {
    const exp = createMockExperiment();
    mockInvoke({
      "experiment_list": { experiments: [exp] },
      "submission_list": { submissions: [] },
    });
    render(<Experiment />);
    await waitFor(() => {
      expect(screen.getByText("Test Experiment")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Test Experiment"));
    await waitFor(() => {
      expect(screen.getByDisplayValue("Test Experiment")).toBeInTheDocument();
      expect(screen.getByText("保存")).toBeInTheDocument();
    });
  });

  it("新建记录应调用创建 API", async () => {
    mockInvoke({
      "experiment_list": { experiments: [] },
      "submission_list": { submissions: [] },
      "experiment_create": { id: "new-exp-1" },
    });
    render(<Experiment />);
    await waitFor(() => {
      expect(screen.getByText("新建记录")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("新建记录"));
    await waitFor(() => {
      expect(getInvokeMock()).toHaveBeenCalledWith(
        "experiment_create",
        expect.objectContaining({ title: "新实验记录" }),
      );
    });
  });

  it("应显示关联投稿下拉", async () => {
    const exp = createMockExperiment();
    mockInvoke({
      "experiment_list": { experiments: [exp] },
      "submission_list": { submissions: [{ id: "sub-1", title: "Test Submission" }] },
    });
    render(<Experiment />);
    await waitFor(() => {
      expect(screen.getByText("Test Experiment")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Test Experiment"));
    await waitFor(() => {
      expect(screen.getByText("关联投稿（可选）")).toBeInTheDocument();
    });
  });

  it("选中记录应显示附件面板", async () => {
    const exp = createMockExperiment();
    mockInvoke({
      "experiment_list": { experiments: [exp] },
      "submission_list": { submissions: [] },
    });
    render(<Experiment />);
    await waitFor(() => {
      expect(screen.getByText("Test Experiment")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Test Experiment"));
    await waitFor(() => {
      expect(screen.getByTestId("attachment-panel")).toBeInTheDocument();
    });
  });
});
