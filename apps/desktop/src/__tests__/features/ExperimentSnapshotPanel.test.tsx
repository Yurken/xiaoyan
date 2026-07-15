import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExperimentSnapshot } from "@research-copilot/types";
import { ExperimentSnapshotPanel } from "../../features/experiment/ExperimentSnapshotPanel";
import { getInvokeMock, resetInvokeMock } from "../mocks/tauri";
import { render, screen, waitFor, within } from "../helpers/render";
import { userEvent } from "@testing-library/user-event";

function makeSnapshot(overrides: Partial<ExperimentSnapshot> = {}): ExperimentSnapshot {
  return {
    id: "snapshot-1",
    experimentId: "experiment-1",
    title: "基线结果",
    configSnapshot: { learningRate: 0.001 },
    resultSnapshot: "accuracy=0.91",
    notesSnapshot: "baseline",
    codeSessionId: null,
    toolId: null,
    model: null,
    workingDir: null,
    envSnapshot: {},
    createdAt: "2026-07-14T08:00:00",
    ...overrides,
  };
}

describe("ExperimentSnapshotPanel", () => {
  beforeEach(() => {
    resetInvokeMock();
  });

  it("创建快照时保存标题与当前 Git 状态", async () => {
    const created = makeSnapshot({
      title: "学习率调优后",
      workingDir: "/tmp/project",
      envSnapshot: { git: { branch: "main", head: "abc123" } },
    });
    getInvokeMock().mockImplementation(async (command: string) => {
      if (command === "experiment_list_snapshots") return { snapshots: [] };
      if (command === "code_git_snapshot") {
        return {
          is_repo: true,
          branch: "main",
          head: "abc123",
          upstream: "origin/main",
          ahead: 0,
          behind: 0,
          files: [{ path: "src/a.ts", index_status: " ", worktree_status: "M", staged: false, unstaged: true, untracked: false }],
          staged_diff: "",
          unstaged_diff: "diff --git a/src/a.ts b/src/a.ts",
          recent_commits: ["abc123 baseline"],
        };
      }
      if (command === "experiment_create_snapshot") return created;
      throw new Error(`Unmocked invoke: ${command}`);
    });
    const onNotify = vi.fn();
    const user = userEvent.setup();

    render(
      <ExperimentSnapshotPanel
        experimentId="experiment-1"
        experimentTitle="BERT 微调"
        activeSession={null}
        workingDir="/tmp/project"
        onError={vi.fn()}
        onNotify={onNotify}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "创建第一个快照" }));
    const titleInput = screen.getByRole("textbox", { name: "快照标题" });
    await user.clear(titleInput);
    await user.type(titleInput, "学习率调优后");
    await user.click(within(screen.getByRole("dialog", { name: "创建实验快照" })).getByRole("button", { name: "创建快照" }));

    await waitFor(() => {
      expect(getInvokeMock()).toHaveBeenCalledWith(
        "experiment_create_snapshot",
        expect.objectContaining({
          experimentId: "experiment-1",
          title: "学习率调优后",
          workingDir: "/tmp/project",
          envSnapshot: expect.objectContaining({
            workingDirectory: "/tmp/project",
            git: expect.objectContaining({ branch: "main", head: "abc123" }),
          }),
        }),
      );
    });
    expect(await screen.findByText("学习率调优后")).toBeInTheDocument();
    expect(onNotify).toHaveBeenCalledWith("快照已创建");
  });

  it("恢复前明确说明自动备份，并在成功后刷新列表", async () => {
    const snapshot = makeSnapshot();
    let listCalls = 0;
    getInvokeMock().mockImplementation(async (command: string) => {
      if (command === "experiment_list_snapshots") {
        listCalls += 1;
        return { snapshots: [snapshot] };
      }
      if (command === "experiment_restore_snapshot") {
        return {
          experimentId: "experiment-1",
          restoredAt: "2026-07-14T09:00:00",
          backupSnapshotId: "backup-1",
        };
      }
      throw new Error(`Unmocked invoke: ${command}`);
    });
    const onRestored = vi.fn();
    const onNotify = vi.fn();
    const user = userEvent.setup();

    render(
      <ExperimentSnapshotPanel
        experimentId="experiment-1"
        experimentTitle="BERT 微调"
        activeSession={null}
        workingDir={null}
        onError={vi.fn()}
        onNotify={onNotify}
        onRestored={onRestored}
      />,
    );

    await user.click(await screen.findByTitle("恢复实验记录"));
    expect(screen.getByText(/系统会先自动创建一份恢复前备份/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "恢复记录" }));

    await waitFor(() => expect(onRestored).toHaveBeenCalledTimes(1));
    expect(listCalls).toBe(2);
    expect(onNotify).toHaveBeenCalledWith("实验记录已恢复，并已自动备份恢复前内容");
  });

  it("可重命名已保存快照且不重新创建快照", async () => {
    const snapshot = makeSnapshot();
    getInvokeMock().mockImplementation(async (command: string) => {
      if (command === "experiment_list_snapshots") return { snapshots: [snapshot] };
      if (command === "experiment_rename_snapshot") return undefined;
      throw new Error(`Unmocked invoke: ${command}`);
    });
    const user = userEvent.setup();

    render(
      <ExperimentSnapshotPanel
        experimentId="experiment-1"
        experimentTitle="BERT 微调"
        activeSession={null}
        workingDir={null}
        onError={vi.fn()}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "重命名快照：基线结果" }));
    const input = screen.getByRole("textbox", { name: "快照名称" });
    await user.clear(input);
    await user.type(input, "最佳基线");
    await user.click(screen.getByRole("button", { name: "保存名称" }));

    await waitFor(() => expect(getInvokeMock()).toHaveBeenCalledWith(
      "experiment_rename_snapshot",
      { snapshotId: "snapshot-1", title: "最佳基线" },
    ));
    expect(await screen.findByText("最佳基线")).toBeInTheDocument();
    expect(getInvokeMock()).not.toHaveBeenCalledWith("experiment_create_snapshot", expect.anything());
  });

  it("批量选择两个快照后可直接进入对比", async () => {
    const snapshots = [
      makeSnapshot({ id: "snapshot-new", title: "新结果" }),
      makeSnapshot({ id: "snapshot-old", title: "旧结果", resultSnapshot: "accuracy=0.80" }),
    ];
    getInvokeMock().mockImplementation(async (command: string) => {
      if (command === "experiment_list_snapshots") return { snapshots };
      throw new Error(`Unmocked invoke: ${command}`);
    });
    const user = userEvent.setup();

    render(
      <ExperimentSnapshotPanel
        experimentId="experiment-1"
        experimentTitle="BERT 微调"
        activeSession={null}
        workingDir={null}
        onError={vi.fn()}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "选择" }));
    await user.click(screen.getByRole("button", { name: "选择快照：新结果" }));
    await user.click(screen.getByRole("button", { name: "选择快照：旧结果" }));
    await user.click(screen.getByRole("button", { name: "对比" }));

    expect(await screen.findByText("快照对比")).toBeInTheDocument();
    expect(screen.getByText("新结果")).toBeInTheDocument();
    expect(screen.getByText("旧结果")).toBeInTheDocument();
  });
});
