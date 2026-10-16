import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDataBackup } from "./useDataBackup";

const { exportBackup, addMemory, save, writeTextFile } = vi.hoisted(() => ({
  exportBackup: vi.fn(),
  addMemory: vi.fn(),
  save: vi.fn(),
  writeTextFile: vi.fn(),
}));

vi.mock("../../lib/client", () => ({
  apiClient: {
    settings: { dataBackup: { export: exportBackup } },
    memory: { add: addMemory },
  },
  formatErrorMessage: (error: unknown) => error instanceof Error ? error.message : String(error),
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({ save }));
vi.mock("@tauri-apps/plugin-fs", () => ({ writeTextFile }));

const password = "synthetic-backup-password";
const destination = "/synthetic/backup.rcbak";
const encryptedBackup = "synthetic-encrypted-backup";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function openExport() {
  const hook = renderHook(() => useDataBackup());
  act(() => { hook.result.current.openExportModal(); });
  act(() => {
    hook.result.current.setPassword(password);
    hook.result.current.setConfirm(password);
  });
  return hook;
}

function beginConfirm(hook: ReturnType<typeof openExport>) {
  let confirmation!: Promise<void>;
  act(() => { confirmation = hook.result.current.handleConfirm(); });
  return confirmation;
}

describe("useDataBackup export", () => {
  beforeEach(() => {
    exportBackup.mockReset().mockResolvedValue(encryptedBackup);
    save.mockReset().mockResolvedValue(destination);
    writeTextFile.mockReset().mockResolvedValue(undefined);
    addMemory.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("已关联文件读取失败时暴露错误并保留弹窗，修复后可在同一弹窗重试", async () => {
    const message = "无法读取已关联文献文件：/synthetic/missing-paper.pdf";
    exportBackup.mockRejectedValueOnce(message);
    const hook = openExport();
    await act(async () => { await hook.result.current.handleConfirm(); });

    expect(hook.result.current.error).toBe(message);
    expect(hook.result.current.modal).toEqual({ mode: "export" });
    expect(hook.result.current.busy).toBe(false);
    expect(hook.result.current.password).toBe(password);
    expect(hook.result.current.confirm).toBe(password);
    expect(save).not.toHaveBeenCalled();
    expect(writeTextFile).not.toHaveBeenCalled();
    expect(addMemory).not.toHaveBeenCalled();

    const write = deferred<void>();
    writeTextFile.mockReturnValueOnce(write.promise);
    const retry = beginConfirm(hook);
    expect(hook.result.current.error).toBe("");
    expect(hook.result.current.busy).toBe(true);
    await waitFor(() => { expect(writeTextFile).toHaveBeenCalledWith(destination, encryptedBackup); });
    expect(hook.result.current.modal).toEqual({ mode: "export" });
    expect(addMemory).not.toHaveBeenCalled();

    await act(async () => { write.resolve(undefined); await retry; });
    expect(exportBackup).toHaveBeenCalledTimes(2);
    expect(exportBackup).toHaveBeenNthCalledWith(1, password);
    expect(exportBackup).toHaveBeenNthCalledWith(2, password);
    expect(hook.result.current.modal).toBeNull();
    expect(hook.result.current.busy).toBe(false);
    expect(hook.result.current.error).toBe("");
    expect(addMemory).toHaveBeenCalledTimes(1);
    expect(addMemory).toHaveBeenCalledWith({
      type: "auto",
      action: "data_backup.export",
      summary: "导出了加密数据备份",
    });
  });

  it("备份生成尚未完成时保持 busy，不提前打开保存窗口、写文件或记录成功", async () => {
    const exported = deferred<string>();
    exportBackup.mockReturnValueOnce(exported.promise);
    const hook = openExport();
    const confirmation = beginConfirm(hook);

    expect(exportBackup).toHaveBeenCalledWith(password);
    expect(hook.result.current.busy).toBe(true);
    expect(hook.result.current.modal).toEqual({ mode: "export" });
    expect(save).not.toHaveBeenCalled();
    expect(writeTextFile).not.toHaveBeenCalled();
    expect(addMemory).not.toHaveBeenCalled();

    await act(async () => { exported.resolve(encryptedBackup); await confirmation; });
    expect(save).toHaveBeenCalledWith({
      defaultPath: expect.stringMatching(/^xiaoyan-backup-\d{4}-\d{2}-\d{2}\.rcbak$/),
      filters: [{ name: "备份文件", extensions: ["rcbak"] }],
    });
    expect(writeTextFile).toHaveBeenCalledWith(destination, encryptedBackup);
    expect(addMemory).toHaveBeenCalledTimes(1);
    expect(hook.result.current.modal).toBeNull();
    expect(hook.result.current.busy).toBe(false);
  });

  it("取消保存只关闭弹窗，不写文件也不记录导出成功", async () => {
    save.mockResolvedValueOnce(null);
    const hook = openExport();
    await act(async () => { await hook.result.current.handleConfirm(); });

    expect(exportBackup).toHaveBeenCalledWith(password);
    expect(save).toHaveBeenCalledTimes(1);
    expect(writeTextFile).not.toHaveBeenCalled();
    expect(addMemory).not.toHaveBeenCalled();
    expect(hook.result.current.modal).toBeNull();
    expect(hook.result.current.busy).toBe(false);
    expect(hook.result.current.error).toBe("");
  });

  it("写入失败保留错误和弹窗，不记录成功，并允许重新选择路径后重试", async () => {
    writeTextFile.mockRejectedValueOnce(new Error("磁盘已满"));
    const hook = openExport();
    await act(async () => { await hook.result.current.handleConfirm(); });

    expect(hook.result.current.error).toBe("磁盘已满");
    expect(hook.result.current.modal).toEqual({ mode: "export" });
    expect(hook.result.current.busy).toBe(false);
    expect(addMemory).not.toHaveBeenCalled();

    const retryDestination = "/synthetic/retry-backup.rcbak";
    save.mockResolvedValueOnce(retryDestination);
    await act(async () => { await hook.result.current.handleConfirm(); });

    expect(save).toHaveBeenCalledTimes(2);
    expect(writeTextFile).toHaveBeenNthCalledWith(1, destination, encryptedBackup);
    expect(writeTextFile).toHaveBeenNthCalledWith(2, retryDestination, encryptedBackup);
    expect(addMemory).toHaveBeenCalledTimes(1);
    expect(hook.result.current.modal).toBeNull();
    expect(hook.result.current.busy).toBe(false);
    expect(hook.result.current.error).toBe("");
  });
});
