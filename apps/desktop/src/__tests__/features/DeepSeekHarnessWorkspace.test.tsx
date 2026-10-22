import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DeepSeekHarnessWorkspace from "../../features/deepseek-harness/DeepSeekHarnessWorkspace";
import { DEFAULT_DSH_CONFIG, type DshRuntimeSnapshot } from "../../features/deepseek-harness/shared";

const invokeMock = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...args: unknown[]) => invokeMock(...args) }));
let snapshot: DshRuntimeSnapshot;
const authenticatedUrl = "http://127.0.0.1:63244/?token=synthetic-launch-token";

beforeEach(() => {
  snapshot = {
    phase: "stopped", config: DEFAULT_DSH_CONFIG, url: null, error: null, logs: [],
    bundledAvailable: true, pathAvailable: false, pathExecutable: null,
    lockedVersion: "0.2.1-rc.2", lockedCommit: "synthetic-commit", nodeRequirement: ">=22.19.0",
    source: "https://github.com/deepseek-ai/deepseek-harness", dataHome: "/synthetic/dsh/home",
  };
  invokeMock.mockReset().mockImplementation(async (command: string) => {
    if (command === "dsh_runtime_status") return snapshot;
    if (command === "dsh_runtime_start") {
      snapshot = { ...snapshot, phase: "running", url: authenticatedUrl };
      return snapshot;
    }
    if (command === "dsh_runtime_stop") {
      snapshot = { ...snapshot, phase: "stopped", url: null };
      return snapshot;
    }
    if (command === "dsh_runtime_import_xiaoyan_api") return { model: "synthetic-model", route: "xiaoyan", protocol: "openai-completions", dataHome: snapshot.dataHome };
    if (command === "runtime_download_managed") { snapshot = { ...snapshot, bundledAvailable: true }; return { version: "0.2.1-rc.2" }; }
    throw new Error(`unexpected command: ${command}`);
  });
});

const starts = () => invokeMock.mock.calls.filter(([command]) => command === "dsh_runtime_start");

describe("DeepSeekHarnessWorkspace direct entry", () => {
  it("automatically starts DSH and preserves its authenticated URL without the legacy launch form", async () => {
    render(<DeepSeekHarnessWorkspace />);
    expect(await screen.findByTitle("DeepSeek Harness")).toHaveAttribute("src", authenticatedUrl);
    expect(starts()).toHaveLength(1);
    expect(screen.queryByRole("heading", { name: "启动 DSH" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("工作目录")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "配置小妍 API" })).toBeInTheDocument();
    expect(invokeMock).not.toHaveBeenCalledWith("dsh_runtime_import_xiaoyan_api");
  });

  it("keeps a manual stop stopped until the user starts it again", async () => {
    const user = userEvent.setup();
    render(<DeepSeekHarnessWorkspace />);
    await screen.findByTitle("DeepSeek Harness");
    await user.click(screen.getByRole("button", { name: "停止" }));
    expect(await screen.findByText("DSH 已停止")).toBeInTheDocument();
    expect(starts()).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "启动 DSH" }));
    await screen.findByTitle("DeepSeek Harness");
    expect(starts()).toHaveLength(2);
  });

  it("installs only when missing, then starts automatically", async () => {
    snapshot = { ...snapshot, bundledAvailable: false };
    const user = userEvent.setup();
    render(<DeepSeekHarnessWorkspace />);
    await screen.findByText("安装 DSH 后即可开始使用");
    expect(starts()).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "一键安装" }));
    await screen.findByTitle("DeepSeek Harness");
    expect(starts()).toHaveLength(1);
  });

  it("shows an explicit retry after startup fails without a restart loop", async () => {
    const ordinaryInvoke = invokeMock.getMockImplementation();
    let fail = true;
    invokeMock.mockImplementation(async (command: string) => {
      if (command === "dsh_runtime_start" && fail) { fail = false; throw new Error("synthetic startup failure"); }
      return ordinaryInvoke?.(command);
    });
    const user = userEvent.setup();
    render(<DeepSeekHarnessWorkspace />);
    expect(await screen.findByRole("alert")).toHaveTextContent("synthetic startup failure");
    expect(starts()).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "重试" }));
    await screen.findByTitle("DeepSeek Harness");
    expect(starts()).toHaveLength(2);
  });

  it("syncs the Xiaoyan API from the floating controls and restarts DSH", async () => {
    const user = userEvent.setup();
    render(<DeepSeekHarnessWorkspace />);
    await screen.findByTitle("DeepSeek Harness");
    await user.click(screen.getByRole("button", { name: "配置小妍 API" }));
    await user.click(screen.getByRole("button", { name: "同步并重启" }));
    expect(await screen.findByText("已配置 synthetic-model · xiaoyan")).toBeInTheDocument();
    await waitFor(() => expect(starts()).toHaveLength(2));
    const commands = invokeMock.mock.calls.map(([command]) => command);
    expect(commands.indexOf("dsh_runtime_stop")).toBeLessThan(commands.indexOf("dsh_runtime_import_xiaoyan_api"));
    expect(commands.lastIndexOf("dsh_runtime_start")).toBeGreaterThan(commands.indexOf("dsh_runtime_import_xiaoyan_api"));
  });
});
