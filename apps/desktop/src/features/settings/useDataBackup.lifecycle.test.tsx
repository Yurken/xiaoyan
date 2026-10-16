import { StrictMode, type PropsWithChildren } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDataBackup } from "./useDataBackup";

const { exportBackup, importBackup, addMemory, open, save, readTextFile, writeTextFile } = vi.hoisted(() => ({
  exportBackup: vi.fn(),
  importBackup: vi.fn(),
  addMemory: vi.fn(),
  open: vi.fn(),
  save: vi.fn(),
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
}));

vi.mock("../../lib/client", () => ({
  apiClient: {
    settings: { dataBackup: { export: exportBackup, import: importBackup } },
    memory: { add: addMemory },
  },
  formatErrorMessage: (error: unknown) => error instanceof Error ? error.message : String(error),
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open, save }));
vi.mock("@tauri-apps/plugin-fs", () => ({ readTextFile, writeTextFile }));

const source = "/synthetic/input.rcbak";
const destination = "/synthetic/output.rcbak";
const fileData = "synthetic-encrypted-backup";
const password = "synthetic-original-password";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function renderBackup(onImported?: () => Promise<void> | void) {
  return renderHook(() => useDataBackup({ onImported }));
}
type Hook = ReturnType<typeof renderBackup>;

function start(action: () => Promise<void>) {
  let operation!: Promise<void>;
  act(() => { operation = action(); });
  return operation;
}

function prepareExport(hook: Hook) {
  act(() => { hook.result.current.openExportModal(); });
  act(() => {
    hook.result.current.setPassword(password);
    hook.result.current.setConfirm(password);
  });
}

async function prepareImport(hook: Hook) {
  await act(async () => { await hook.result.current.openImportPicker(); });
  act(() => { hook.result.current.setPassword(password); });
}

function expectLocked(hook: Hook) {
  const current = hook.result.current;
  const snapshot = {
    modal: current.modal,
    password: current.password,
    confirm: current.confirm,
    error: current.error,
  };
  expect(current.busy).toBe(true);
  act(() => {
    current.openExportModal();
    void current.openImportPicker();
    current.closeModal();
    current.setPassword("ignored-password");
    current.setConfirm("ignored-confirmation");
    void current.handleConfirm();
  });
  expect(hook.result.current.busy).toBe(true);
  expect({
    modal: hook.result.current.modal,
    password: hook.result.current.password,
    confirm: hook.result.current.confirm,
    error: hook.result.current.error,
  }).toEqual(snapshot);
}

describe("useDataBackup lifecycle", () => {
  beforeEach(() => {
    exportBackup.mockReset().mockResolvedValue(fileData);
    importBackup.mockReset().mockResolvedValue(undefined);
    addMemory.mockReset().mockResolvedValue(undefined);
    open.mockReset().mockResolvedValue(source);
    save.mockReset().mockResolvedValue(destination);
    readTextFile.mockReset().mockResolvedValue("  " + fileData + "\n");
    writeTextFile.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("选择器及读取期间持续占锁，同 tick 的重复入口与关闭、改密码均无效", async () => {
    const picked = deferred<string | null>();
    const read = deferred<string>();
    open.mockReturnValue(picked.promise);
    readTextFile.mockReturnValue(read.promise);
    const hook = renderBackup();
    const pick = hook.result.current.openImportPicker;
    let first!: Promise<void>;
    let duplicate!: Promise<void>;
    act(() => {
      first = pick();
      duplicate = pick();
    });

    // busy must start before the first dynamic native module import settles.
    expect(hook.result.current.busy).toBe(true);
    expect(open).not.toHaveBeenCalled();
    expectLocked(hook);
    await waitFor(() => { expect(open).toHaveBeenCalledTimes(1); });
    expect(readTextFile).not.toHaveBeenCalled();

    await act(async () => { picked.resolve(source); });
    await waitFor(() => { expect(readTextFile).toHaveBeenCalledWith(source); });
    expect(hook.result.current.modal).toBeNull();
    expectLocked(hook);
    expect(readTextFile).toHaveBeenCalledTimes(1);

    await act(async () => {
      read.resolve("  " + fileData + "\n");
      await Promise.all([first, duplicate]);
    });
    expect(open).toHaveBeenCalledTimes(1);
    expect(readTextFile).toHaveBeenCalledTimes(1);
    expect(hook.result.current.modal).toEqual({ mode: "import", fileData });
    expect(hook.result.current.password).toBe("");
    expect(hook.result.current.confirm).toBe("");
    expect(hook.result.current.busy).toBe(false);
    expect(exportBackup).not.toHaveBeenCalled();
    expect(importBackup).not.toHaveBeenCalled();
  });

  it("同 tick 只提交一次，export、保存选择和写入全程锁定原始密码与弹窗", async () => {
    const exported = deferred<string>();
    const saved = deferred<string | null>();
    const written = deferred<void>();
    exportBackup.mockReturnValue(exported.promise);
    save.mockReturnValue(saved.promise);
    writeTextFile.mockReturnValue(written.promise);
    const hook = renderBackup();
    prepareExport(hook);
    const confirm = hook.result.current.handleConfirm;
    let first!: Promise<void>;
    let duplicate!: Promise<void>;
    act(() => {
      first = confirm();
      duplicate = confirm();
    });
    expect(exportBackup).toHaveBeenCalledTimes(1);
    expect(exportBackup).toHaveBeenCalledWith(password);
    expectLocked(hook);
    expect(save).not.toHaveBeenCalled();

    await act(async () => { exported.resolve(fileData); });
    await waitFor(() => { expect(save).toHaveBeenCalledTimes(1); });
    expectLocked(hook);
    expect(writeTextFile).not.toHaveBeenCalled();

    await act(async () => { saved.resolve(destination); });
    await waitFor(() => { expect(writeTextFile).toHaveBeenCalledWith(destination, fileData); });
    expectLocked(hook);
    expect(addMemory).not.toHaveBeenCalled();

    await act(async () => {
      written.resolve(undefined);
      await Promise.all([first, duplicate]);
    });
    expect(exportBackup).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(writeTextFile).toHaveBeenCalledTimes(1);
    expect(open).not.toHaveBeenCalled();
    expect(hook.result.current.busy).toBe(false);
    expect(hook.result.current.modal).toBeNull();
    expect(addMemory).toHaveBeenCalledTimes(1);
  });

  it("import 与 onImported 刷新尚未结束时都保持锁，期间不能重复导入或改密码", async () => {
    const imported = deferred<void>();
    const refreshed = deferred<void>();
    importBackup.mockReturnValue(imported.promise);
    const onImported = vi.fn(() => refreshed.promise);
    const hook = renderBackup(onImported);
    await prepareImport(hook);
    const confirm = hook.result.current.handleConfirm;
    let first!: Promise<void>;
    let duplicate!: Promise<void>;
    act(() => {
      first = confirm();
      duplicate = confirm();
    });
    expect(importBackup).toHaveBeenCalledTimes(1);
    expect(importBackup).toHaveBeenCalledWith(fileData, password);
    expect(onImported).not.toHaveBeenCalled();
    expectLocked(hook);

    await act(async () => { imported.resolve(undefined); });
    await waitFor(() => { expect(onImported).toHaveBeenCalledTimes(1); });
    expectLocked(hook);
    expect(addMemory).not.toHaveBeenCalled();
    await act(async () => {
      refreshed.resolve(undefined);
      await Promise.all([first, duplicate]);
    });

    expect(importBackup).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledTimes(1);
    expect(hook.result.current.modal).toBeNull();
    expect(hook.result.current.busy).toBe(false);
    expect(addMemory).toHaveBeenCalledWith({
      type: "auto", action: "data_backup.import", summary: "导入了加密数据备份",
    });
  });

  it("idle 关闭重开后，旧窗口的提交、输入和关闭回调均不能改变新窗口", async () => {
    const hook = renderBackup();
    prepareExport(hook);
    const old = hook.result.current;
    act(() => { old.closeModal(); });
    act(() => { hook.result.current.openExportModal(); });
    act(() => {
      hook.result.current.setPassword("new-password");
      hook.result.current.setConfirm("new-mismatch");
    });
    await act(async () => { await hook.result.current.handleConfirm(); });
    const currentError = hook.result.current.error;
    expect(currentError).not.toBe("");

    await act(async () => {
      old.setPassword("stale-password");
      old.setConfirm("stale-password");
      old.closeModal();
      old.openExportModal();
      await old.openImportPicker();
      await old.handleConfirm();
    });
    expect(hook.result.current.modal).toEqual({ mode: "export" });
    expect(hook.result.current.password).toBe("new-password");
    expect(hook.result.current.confirm).toBe("new-mismatch");
    expect(hook.result.current.error).toBe(currentError);
    expect(hook.result.current.busy).toBe(false);
    expect(exportBackup).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();

    act(() => { hook.result.current.setConfirm("new-password"); });
    await act(async () => { await hook.result.current.handleConfirm(); });
    expect(exportBackup).toHaveBeenCalledWith("new-password");
    expect(hook.result.current.modal).toBeNull();
  });

  it.each(["cancel", "picker-error", "read-error"] as const)(
    "%s 后释放锁，无弹窗时也保留读取错误，并允许重新选择",
    async (failure) => {
      if (failure === "cancel") open.mockResolvedValueOnce(null);
      if (failure === "picker-error") open.mockRejectedValueOnce(new Error("选择器不可用"));
      if (failure === "read-error") readTextFile.mockRejectedValueOnce(new Error("备份读取失败"));
      const hook = renderBackup();
      await act(async () => { await hook.result.current.openImportPicker(); });

      expect(hook.result.current.busy).toBe(false);
      expect(hook.result.current.modal).toBeNull();
      expect(hook.result.current.error).toBe(
        failure === "cancel" ? "" : failure === "picker-error" ? "选择器不可用" : "备份读取失败",
      );
      expect(importBackup).not.toHaveBeenCalled();
      expect(addMemory).not.toHaveBeenCalled();
      await act(async () => { await hook.result.current.openImportPicker(); });
      expect(open).toHaveBeenCalledTimes(2);
      expect(hook.result.current.modal).toEqual({ mode: "import", fileData });
      expect(hook.result.current.busy).toBe(false);
      expect(hook.result.current.error).toBe("");
    },
  );

  it("导入拒绝后释放锁并保留可重试窗口，成功才调用刷新", async () => {
    importBackup.mockRejectedValueOnce(new Error("备份密码错误"));
    const onImported = vi.fn().mockResolvedValue(undefined);
    const hook = renderBackup(onImported);
    await prepareImport(hook);
    await act(async () => { await hook.result.current.handleConfirm(); });
    expect(hook.result.current.error).toBe("备份密码错误");
    expect(hook.result.current.busy).toBe(false);
    expect(hook.result.current.modal).toEqual({ mode: "import", fileData });
    expect(onImported).not.toHaveBeenCalled();

    act(() => { hook.result.current.setPassword("corrected-password"); });
    await act(async () => { await hook.result.current.handleConfirm(); });
    expect(importBackup).toHaveBeenNthCalledWith(2, fileData, "corrected-password");
    expect(onImported).toHaveBeenCalledTimes(1);
    expect(hook.result.current.error).toBe("");
    expect(hook.result.current.modal).toBeNull();
  });

  it.each(["picker", "read"] as const)(
    "%s 等待期间卸载后，迟到结果不能继续读取或弹出导入窗口",
    async (phase) => {
      const picked = deferred<string | null>();
      const read = deferred<string>();
      open.mockReturnValue(picked.promise);
      readTextFile.mockReturnValue(read.promise);
      const hook = renderBackup();
      const operation = start(hook.result.current.openImportPicker);
      await waitFor(() => { expect(open).toHaveBeenCalledTimes(1); });
      if (phase === "read") {
        await act(async () => { picked.resolve(source); });
        await waitFor(() => { expect(readTextFile).toHaveBeenCalledTimes(1); });
      }
      const lastRender = hook.result.current;
      hook.unmount();
      await act(async () => {
        if (phase === "picker") picked.resolve(source);
        else read.resolve(fileData);
        await operation;
      });

      expect(readTextFile).toHaveBeenCalledTimes(phase === "picker" ? 0 : 1);
      expect(hook.result.current).toBe(lastRender);
      expect(lastRender.modal).toBeNull();
      expect(importBackup).not.toHaveBeenCalled();
      expect(addMemory).not.toHaveBeenCalled();
    },
  );

  it.each(["export", "save"] as const)(
    "%s 等待期间卸载后，不再打开下一原生入口或写出备份",
    async (phase) => {
      const exported = deferred<string>();
      const saved = deferred<string | null>();
      exportBackup.mockReturnValue(exported.promise);
      save.mockReturnValue(saved.promise);
      const hook = renderBackup();
      prepareExport(hook);
      const operation = start(hook.result.current.handleConfirm);
      if (phase === "save") {
        await act(async () => { exported.resolve(fileData); });
        await waitFor(() => { expect(save).toHaveBeenCalledTimes(1); });
      }
      hook.unmount();
      await act(async () => {
        if (phase === "export") exported.resolve(fileData);
        else saved.resolve(destination);
        await operation;
      });

      expect(save).toHaveBeenCalledTimes(phase === "export" ? 0 : 1);
      expect(writeTextFile).not.toHaveBeenCalled();
      expect(addMemory).not.toHaveBeenCalled();
    },
  );

  it("已经启动的持久导入在卸载后仍完成并调用 onImported", async () => {
    const imported = deferred<void>();
    const refreshed = deferred<void>();
    importBackup.mockReturnValue(imported.promise);
    const onImported = vi.fn(() => refreshed.promise);
    const hook = renderBackup(onImported);
    await prepareImport(hook);
    const operation = start(hook.result.current.handleConfirm);
    expect(importBackup).toHaveBeenCalledWith(fileData, password);
    const lastRender = hook.result.current;
    hook.unmount();

    await act(async () => { imported.resolve(undefined); });
    await waitFor(() => { expect(onImported).toHaveBeenCalledTimes(1); });
    await act(async () => { refreshed.resolve(undefined); await operation; });
    expect(importBackup).toHaveBeenCalledTimes(1);
    expect(hook.result.current).toBe(lastRender);
    expect(save).not.toHaveBeenCalled();
    expect(writeTextFile).not.toHaveBeenCalled();
  });

  it("StrictMode 的 setup/cleanup 重放后仍能选择文件并提交", async () => {
    function Wrapper({ children }: PropsWithChildren) {
      return <StrictMode>{children}</StrictMode>;
    }
    const onImported = vi.fn().mockResolvedValue(undefined);
    const hook = renderHook(() => useDataBackup({ onImported }), { wrapper: Wrapper });
    await prepareImport(hook);
    await act(async () => { await hook.result.current.handleConfirm(); });
    expect(open).toHaveBeenCalledTimes(1);
    expect(importBackup).toHaveBeenCalledWith(fileData, password);
    expect(onImported).toHaveBeenCalledTimes(1);
    expect(hook.result.current.busy).toBe(false);
    expect(hook.result.current.modal).toBeNull();
  });
});
