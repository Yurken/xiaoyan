import { StrictMode, createElement, useEffect, type PropsWithChildren } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWritingLatexInstall } from "../../../features/writing/useWritingLatexInstall";
import { LATEX_INSTALL_SUPPORT } from "../../../features/writing/shared";
import { getInvokeMock, resetInvokeMock } from "../../mocks/tauri";

type InstallOptions = Parameters<typeof useWritingLatexInstall>[0];

const installerCommand = "writing_open_mactex_installer";
const guideCommand = "writing_open_mactex_download_page";
const installerMessage = LATEX_INSTALL_SUPPORT.installerOpenedMessage ??
  "已打开 LaTeX 安装器，请完成安装后重新编译。";
const actions = [
  { action: "openLatexInstaller", command: installerCommand, message: installerMessage, clears: 1 },
  { action: "openLatexDownloadPage", command: guideCommand, message: LATEX_INSTALL_SUPPORT.installGuideOpenedMessage, clears: 0 },
] as const;

function options(draftId = "draft-a", overrides: Partial<InstallOptions> = {}): InstallOptions {
  return {
    draftId,
    onMessage: vi.fn(),
    onError: vi.fn(),
    clearStatus: vi.fn(),
    ...overrides,
  };
}

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}
type Gate = ReturnType<typeof deferred>;

function mockOpeners(installer: Gate[] = [], guide: Gate[] = []) {
  const queues = new Map<string, Gate[]>([
    [installerCommand, [...installer]],
    [guideCommand, [...guide]],
  ]);
  // Keep the real writingApi adapter and replace only the native invoke boundary.
  getInvokeMock().mockImplementation((command: string) => {
    const next = queues.get(command)?.shift();
    if (!next) throw new Error("Unexpected native opener: " + command);
    return next.promise;
  });
}

function start(action: () => Promise<void>) {
  let job!: Promise<void>;
  act(() => { job = action(); });
  return job;
}

async function finish(gate: Gate, job: Promise<void>, failure?: string) {
  await act(async () => {
    if (failure) gate.reject(new Error(failure));
    else gate.resolve();
    await job;
  });
}

function StrictWrapper({ children }: PropsWithChildren) {
  return createElement(StrictMode, null, children);
}

describe("useWritingLatexInstall", () => {
  beforeEach(() => { resetInvokeMock(); });
  afterEach(() => {
    cleanup();
    resetInvokeMock();
  });

  it.each(actions)("$action 在同 tick 与等待期间只调用一次，成功后可以再次打开", async ({
    action, command, message, clears,
  }) => {
    const firstGate = deferred();
    const nextGate = deferred();
    mockOpeners(action === "openLatexInstaller" ? [firstGate, nextGate] : [],
      action === "openLatexDownloadPage" ? [firstGate, nextGate] : []);
    const input = options();
    const { result } = renderHook(useWritingLatexInstall, { initialProps: input });
    const open = result.current[action];
    let first!: Promise<void>;
    let duplicate!: Promise<void>;
    act(() => {
      first = open();
      duplicate = open();
    });

    expect(getInvokeMock()).toHaveBeenCalledTimes(1);
    expect(getInvokeMock()).toHaveBeenCalledWith(command);
    expect(input.clearStatus).toHaveBeenCalledTimes(clears);
    expect(input.onMessage).not.toHaveBeenCalled();
    expect(result.current.latexInstallerStatus).toBe(action === "openLatexInstaller" ? "opening" : "idle");
    await act(async () => { await result.current[action](); });
    expect(getInvokeMock()).toHaveBeenCalledTimes(1);

    await act(async () => { firstGate.resolve(); await Promise.all([first, duplicate]); });
    expect(result.current.latexInstallerStatus).toBe("idle");
    expect(input.onMessage).toHaveBeenCalledTimes(1);
    expect(input.onMessage).toHaveBeenCalledWith(message);
    expect(input.onError).not.toHaveBeenCalled();

    const next = start(result.current[action]);
    expect(getInvokeMock()).toHaveBeenCalledTimes(2);
    await finish(nextGate, next);
    expect(input.onMessage).toHaveBeenCalledTimes(2);
    expect(input.clearStatus).toHaveBeenCalledTimes(clears * 2);
  });

  it.each(actions)("$action 原生失败后释放自己的锁，并允许重试成功", async ({
    action, message, clears,
  }) => {
    const failed = deferred();
    const retry = deferred();
    mockOpeners(action === "openLatexInstaller" ? [failed, retry] : [],
      action === "openLatexDownloadPage" ? [failed, retry] : []);
    const input = options();
    const { result } = renderHook(useWritingLatexInstall, { initialProps: input });
    const first = start(result.current[action]);
    await finish(failed, first, "Synthetic opener failure");

    expect(input.onError).toHaveBeenCalledWith("Synthetic opener failure");
    expect(input.onMessage).not.toHaveBeenCalled();
    expect(result.current.latexInstallerStatus).toBe("idle");
    const second = start(result.current[action]);
    await finish(retry, second);
    expect(getInvokeMock()).toHaveBeenCalledTimes(2);
    expect(input.onError).toHaveBeenCalledTimes(1);
    expect(input.onMessage).toHaveBeenCalledWith(message);
    expect(input.clearStatus).toHaveBeenCalledTimes(clears * 2);
  });

  it.each([
    { action: "openLatexInstaller", rejected: false },
    { action: "openLatexInstaller", rejected: true },
    { action: "openLatexDownloadPage", rejected: false },
    { action: "openLatexDownloadPage", rejected: true },
  ] as const)(
    "$action 切换文稿后保留请求锁但丢弃旧反馈（失败：$rejected）",
    async ({ action, rejected }) => {
      const oldGate = deferred();
      const currentGate = deferred();
      mockOpeners(action === "openLatexInstaller" ? [oldGate, currentGate] : [],
        action === "openLatexDownloadPage" ? [oldGate, currentGate] : []);
      const oldInput = options();
      const currentInput = options("draft-b");
      const { result, rerender } = renderHook(useWritingLatexInstall, { initialProps: oldInput });
      const oldJob = start(result.current[action]);
      rerender(currentInput);

      expect(result.current.latexInstallerStatus).toBe(action === "openLatexInstaller" ? "opening" : "idle");
      await act(async () => { await result.current[action](); });
      expect(getInvokeMock()).toHaveBeenCalledTimes(1);
      await finish(oldGate, oldJob, rejected ? "Late old draft failure" : undefined);
      expect(result.current.latexInstallerStatus).toBe("idle");
      for (const input of [oldInput, currentInput]) {
        expect(input.onMessage).not.toHaveBeenCalled();
        expect(input.onError).not.toHaveBeenCalled();
      }

      const currentJob = start(result.current[action]);
      await finish(currentGate, currentJob);
      expect(getInvokeMock()).toHaveBeenCalledTimes(2);
      expect(currentInput.onMessage).toHaveBeenCalledTimes(1);
      expect(oldInput.onMessage).not.toHaveBeenCalled();
    },
  );

  it("A→B→A 不能恢复旧安装或指南反馈，返回后的新请求仍可完成", async () => {
    const installer = deferred();
    const guide = deferred();
    const nextInstaller = deferred();
    mockOpeners([installer, nextInstaller], [guide]);
    const firstA = options("draft-a");
    const secondA = options("draft-a");
    const { result, rerender } = renderHook(useWritingLatexInstall, { initialProps: firstA });
    const installing = start(result.current.openLatexInstaller);
    const reading = start(result.current.openLatexDownloadPage);
    rerender(options("draft-b"));
    rerender(secondA);
    expect(result.current.latexInstallerStatus).toBe("opening");
    await act(async () => {
      await result.current.openLatexInstaller();
      await result.current.openLatexDownloadPage();
    });
    expect(getInvokeMock()).toHaveBeenCalledTimes(2);

    await act(async () => {
      installer.reject(new Error("Late first A installer error"));
      guide.resolve();
      await Promise.all([installing, reading]);
    });
    expect(result.current.latexInstallerStatus).toBe("idle");
    for (const input of [firstA, secondA]) {
      expect(input.onMessage).not.toHaveBeenCalled();
      expect(input.onError).not.toHaveBeenCalled();
    }
    const next = start(result.current.openLatexInstaller);
    await finish(nextInstaller, next);
    expect(secondA.onMessage).toHaveBeenCalledWith(installerMessage);
  });

  it("新文稿提交后保留的旧动作闭包不能再调用原生接口或清除提示", async () => {
    const installer = deferred();
    mockOpeners([installer]);
    const oldInput = options();
    const currentInput = options("draft-b");
    const { result, rerender } = renderHook(useWritingLatexInstall, { initialProps: oldInput });
    const stale = result.current;
    rerender(currentInput);
    await act(async () => {
      await stale.openLatexInstaller();
      await stale.openLatexDownloadPage();
    });
    expect(getInvokeMock()).not.toHaveBeenCalled();
    expect(oldInput.clearStatus).not.toHaveBeenCalled();
    expect(result.current.latexInstallerStatus).toBe("idle");

    const job = start(result.current.openLatexInstaller);
    await finish(installer, job);
    expect(currentInput.clearStatus).toHaveBeenCalledTimes(1);
    expect(currentInput.onMessage).toHaveBeenCalledWith(installerMessage);
  });

  it("卸载后迟到的成功或失败不反馈，保留的两个入口也不能再发出请求", async () => {
    const installer = deferred();
    const guide = deferred();
    mockOpeners([installer], [guide]);
    const input = options();
    const { result, unmount } = renderHook(useWritingLatexInstall, { initialProps: input });
    const stale = result.current;
    const installing = start(stale.openLatexInstaller);
    const reading = start(stale.openLatexDownloadPage);
    unmount();
    await act(async () => {
      await stale.openLatexInstaller();
      await stale.openLatexDownloadPage();
      installer.reject(new Error("Late unmounted failure"));
      guide.resolve();
      await Promise.all([installing, reading]);
    });
    // Check again after both locks have cleared: the lifetime guard itself must reject.
    await act(async () => {
      await stale.openLatexInstaller();
      await stale.openLatexDownloadPage();
    });
    expect(getInvokeMock()).toHaveBeenCalledTimes(2);
    expect(input.clearStatus).toHaveBeenCalledTimes(1);
    expect(input.onMessage).not.toHaveBeenCalled();
    expect(input.onError).not.toHaveBeenCalled();
  });

  it("clearStatus 同步抛错时报告错误且不打开原生接口，释放锁后可重试", async () => {
    const installer = deferred();
    mockOpeners([installer]);
    const clearStatus = vi.fn().mockImplementationOnce(() => { throw new Error("Synthetic clear failure"); });
    const input = options("draft-a", { clearStatus });
    const { result } = renderHook(useWritingLatexInstall, { initialProps: input });

    await act(async () => { await result.current.openLatexInstaller(); });
    expect(getInvokeMock()).not.toHaveBeenCalled();
    expect(input.onError).toHaveBeenCalledWith("Synthetic clear failure");
    expect(input.onMessage).not.toHaveBeenCalled();
    expect(result.current.latexInstallerStatus).toBe("idle");
    const retry = start(result.current.openLatexInstaller);
    await finish(installer, retry);
    expect(clearStatus).toHaveBeenCalledTimes(2);
    expect(getInvokeMock()).toHaveBeenCalledTimes(1);
    expect(input.onMessage).toHaveBeenCalledWith(installerMessage);
  });

  it("clearStatus 同步卸载页面时不会继续调用原生安装入口", async () => {
    let leave!: () => void;
    const input = options("draft-a", { clearStatus: vi.fn(() => { leave(); }) });
    const { result, unmount } = renderHook(useWritingLatexInstall, { initialProps: input });
    leave = unmount;
    const open = result.current.openLatexInstaller;
    await act(async () => { await open(); });

    expect(input.clearStatus).toHaveBeenCalledTimes(1);
    expect(getInvokeMock()).not.toHaveBeenCalled();
    expect(input.onMessage).not.toHaveBeenCalled();
    expect(input.onError).not.toHaveBeenCalled();
    await act(async () => { await open(); });
    expect(input.clearStatus).toHaveBeenCalledTimes(1);
    expect(getInvokeMock()).not.toHaveBeenCalled();
  });

  it("安装器和指南各自防重，完成一个请求不会释放另一个请求的锁", async () => {
    const installer = deferred();
    const firstGuide = deferred();
    const nextGuide = deferred();
    mockOpeners([installer], [firstGuide, nextGuide]);
    const input = options();
    const { result } = renderHook(useWritingLatexInstall, { initialProps: input });
    const installing = start(result.current.openLatexInstaller);
    const reading = start(result.current.openLatexDownloadPage);
    expect(getInvokeMock()).toHaveBeenCalledTimes(2);
    expect(input.clearStatus).toHaveBeenCalledTimes(1);
    expect(result.current.latexInstallerStatus).toBe("opening");

    await finish(firstGuide, reading);
    expect(result.current.latexInstallerStatus).toBe("opening");
    const nextReading = start(result.current.openLatexDownloadPage);
    await act(async () => { await result.current.openLatexInstaller(); });
    expect(getInvokeMock()).toHaveBeenCalledTimes(3);
    await finish(installer, installing);
    expect(result.current.latexInstallerStatus).toBe("idle");
    await act(async () => { await result.current.openLatexDownloadPage(); });
    expect(getInvokeMock()).toHaveBeenCalledTimes(3);
    await finish(nextGuide, nextReading);
    expect(input.clearStatus).toHaveBeenCalledTimes(1);
    expect(input.onMessage).toHaveBeenNthCalledWith(1, LATEX_INSTALL_SUPPORT.installGuideOpenedMessage);
    expect(input.onMessage).toHaveBeenNthCalledWith(2, installerMessage);
    expect(input.onMessage).toHaveBeenNthCalledWith(3, LATEX_INSTALL_SUPPORT.installGuideOpenedMessage);
  });

  it("StrictMode effect 重放保留已发出请求的锁，旧 lifetime 不反馈且之后仍可操作", async () => {
    const original = deferred();
    const retry = deferred();
    mockOpeners([original, retry]);
    const input = options();
    const effectJobs: Promise<void>[] = [];
    const { result } = renderHook(() => {
      const installer = useWritingLatexInstall(input);
      useEffect(() => {
        effectJobs.push(installer.openLatexInstaller());
      }, [installer.openLatexInstaller]);
      return installer;
    }, { wrapper: StrictWrapper });

    expect(effectJobs).toHaveLength(2);
    expect(getInvokeMock()).toHaveBeenCalledTimes(1);
    expect(input.clearStatus).toHaveBeenCalledTimes(1);
    expect(result.current.latexInstallerStatus).toBe("opening");
    await act(async () => { original.resolve(); await Promise.all(effectJobs); });
    expect(result.current.latexInstallerStatus).toBe("idle");
    expect(input.onMessage).not.toHaveBeenCalled();
    expect(input.onError).not.toHaveBeenCalled();

    const next = start(result.current.openLatexInstaller);
    await finish(retry, next);
    expect(getInvokeMock()).toHaveBeenCalledTimes(2);
    expect(input.onMessage).toHaveBeenCalledWith(installerMessage);
  });
});
