import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "../helpers/render";
import { mockInvoke, resetInvokeMock, createMockExperiment, getInvokeMock } from "../mocks/tauri";
import Experiment from "../../pages/Experiment";

vi.mock("../../hooks/useDomainEventRefresh", () => ({
  useDomainEventRefresh: () => {},
}));

vi.mock("../../features/experiment/ExperimentCodeWorkspace", () => ({
  ExperimentCodeWorkspace: () => <div data-testid="code-workspace">代码工作区</div>,
}));

vi.mock("../../features/experiment/ExperimentSnapshotPanel", () => ({
  ExperimentSnapshotPanel: () => <div data-testid="snapshot-panel">快照面板</div>,
}));

describe("Experiment 页面", () => {
  beforeEach(() => {
    resetInvokeMock();
  });

  it("应渲染页面标题和描述", async () => {
    mockInvoke({ "experiment_list": { experiments: [] } });
    render(<Experiment />);
    expect(screen.getByText("实验记录")).toBeInTheDocument();
    expect(screen.getByText(/代码调试与快照封存一体化/)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("暂无实验记录")).toBeInTheDocument();
    });
  });

  it("无记录应显示空状态", async () => {
    mockInvoke({ "experiment_list": { experiments: [] } });
    render(<Experiment />);
    await waitFor(() => {
      expect(screen.getByText("暂无实验记录")).toBeInTheDocument();
    });
  });

  it("有记录时默认加载第一个并显示代码工作区", async () => {
    const exp = createMockExperiment();
    mockInvoke({ "experiment_list": { experiments: [exp] } });
    render(<Experiment />);
    await waitFor(() => {
      expect(screen.getByTestId("code-workspace")).toBeInTheDocument();
    });
  });

  it("点击快照 Tab 切换到快照面板", async () => {
    const exp = createMockExperiment();
    mockInvoke({ "experiment_list": { experiments: [exp] } });
    render(<Experiment />);
    await waitFor(() => {
      expect(screen.getByTestId("code-workspace")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("tab-snapshots"));
    await waitFor(() => {
      expect(screen.getByTestId("snapshot-panel")).toBeInTheDocument();
    });
  });

  it("传入 experimentId 时应调用 experiment_get", async () => {
    const exp = createMockExperiment();
    mockInvoke({ "experiment_get": exp });
    render(<Experiment experimentId="exp-1" />);
    await waitFor(() => {
      expect(screen.getByTestId("code-workspace")).toBeInTheDocument();
    });
    expect(getInvokeMock()).toHaveBeenCalledWith("experiment_get", { id: "exp-1" });
  });
});
