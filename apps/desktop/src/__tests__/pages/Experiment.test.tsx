import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "../helpers/render";
import { mockInvoke, resetInvokeMock, createMockExperiment, getInvokeMock } from "../mocks/tauri";
import Experiment from "../../pages/Experiment";

vi.mock("../../hooks/useDomainEventRefresh", () => ({
  useDomainEventRefresh: () => {},
}));

vi.mock("../../features/experiment/ExperimentCodeWorkspace", () => ({
  ExperimentCodeWorkspace: ({ experimentId }: { experimentId: string }) => <div data-testid="code-workspace">代码工作区 {experimentId}</div>,
}));

vi.mock("../../features/experiment/ExperimentSnapshotPanel", () => ({
  ExperimentSnapshotPanel: ({ experimentId }: { experimentId: string }) => <div data-testid="snapshot-panel">快照面板 {experimentId}</div>,
}));

vi.mock("../../features/experiment/ExperimentRecordPanel", () => ({
  ExperimentRecordPanel: ({ onActiveExperimentChange }: { onActiveExperimentChange: (experiment: {
    id: string; title: string; config: Record<string, unknown>; result: string; notes: string;
    linkedSubmissionId: null; defaultWorkingDir: null; createdAt: string; updatedAt: string;
  }) => void }) => (
    <button type="button" data-testid="choose-experiment-2" onClick={() => onActiveExperimentChange({
      id: "exp-2", title: "Second Experiment", config: {}, result: "", notes: "",
      linkedSubmissionId: null, defaultWorkingDir: null,
      createdAt: "2026-07-14T08:00:00", updatedAt: "2026-07-14T08:00:00",
    })}>
      选择第二个实验
    </button>
  ),
}));

describe("Experiment 页面", () => {
  beforeEach(() => {
    resetInvokeMock();
  });

  it("应渲染空状态", async () => {
    mockInvoke({ "experiment_list": { experiments: [] } });
    render(<Experiment />);
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

  it("记录页切换实验后，代码与快照使用同一条实验记录", async () => {
    const exp = createMockExperiment();
    mockInvoke({ "experiment_list": { experiments: [exp] } });
    render(<Experiment />);
    await screen.findByTestId("code-workspace");

    fireEvent.click(screen.getByTestId("tab-records"));
    fireEvent.click(await screen.findByTestId("choose-experiment-2"));
    fireEvent.click(screen.getByTestId("tab-snapshots"));

    expect(await screen.findByTestId("snapshot-panel")).toHaveTextContent("exp-2");
    expect(screen.getByText("Second Experiment")).toBeInTheDocument();
  });
});
