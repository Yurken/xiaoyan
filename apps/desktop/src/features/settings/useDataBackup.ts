import { useLayoutEffect, useRef, useState } from "react";
import { apiClient, formatErrorMessage } from "../../lib/client";

export type DataBackupModalState =
  | { mode: "export" }
  | { mode: "import"; fileData: string }
  | null;

interface UseDataBackupOptions {
  onImported?: () => Promise<void> | void;
}

interface BackupOperation {
  version: number;
  lifetime: { active: boolean };
}

export function useDataBackup({ onImported }: UseDataBackupOptions = {}) {
  const [session, setSession] = useState<{ version: number; modal: DataBackupModalState }>({
    version: 0,
    modal: null,
  });
  const { modal } = session;
  const [password, setPasswordValue] = useState("");
  const [confirm, setConfirmValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const version = useRef(0);
  const lifetime = useRef({ active: true });
  const operation = useRef<BackupOperation | null>(null);

  useLayoutEffect(() => {
    const activeLifetime = { active: true };
    lifetime.current = activeLifetime;
    return () => { activeLifetime.active = false; };
  }, []);

  const canEdit = () =>
    lifetime.current.active && version.current === session.version && !operation.current;

  const isCurrent = (request: BackupOperation) =>
    request.lifetime.active && lifetime.current === request.lifetime &&
    operation.current === request && version.current === request.version;

  const resetModal = (next: DataBackupModalState) => {
    version.current += 1;
    setSession({ version: version.current, modal: next });
    setPasswordValue("");
    setConfirmValue("");
    setError("");
  };

  const beginOperation = (): BackupOperation | null => {
    if (!canEdit()) return null;
    const request = { version: version.current, lifetime: lifetime.current };
    // Reserve synchronously, before any native dialog or React state update.
    operation.current = request;
    setBusy(true);
    setError("");
    return request;
  };

  const finishOperation = (request: BackupOperation) => {
    if (operation.current !== request) return;
    operation.current = null;
    if (lifetime.current.active) setBusy(false);
  };

  const setPassword = (value: string) => {
    if (!canEdit()) return;
    setPasswordValue(value);
    setError("");
  };

  const setConfirm = (value: string) => {
    if (!canEdit()) return;
    setConfirmValue(value);
    setError("");
  };

  const closeModal = () => {
    if (canEdit()) resetModal(null);
  };

  const openExportModal = () => {
    if (canEdit()) resetModal({ mode: "export" });
  };

  const openImportPicker = async () => {
    const request = beginOperation();
    if (!request) return;
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      if (!isCurrent(request)) return;
      const file = await open({
        filters: [{ name: "备份文件", extensions: ["rcbak"] }],
        multiple: false,
      });
      if (!file || !isCurrent(request)) return;

      const filePath = typeof file === "string" ? file : (file as { path: string }).path;
      const { readTextFile } = await import("@tauri-apps/plugin-fs");
      if (!isCurrent(request)) return;
      const fileData = await readTextFile(filePath);
      if (isCurrent(request)) resetModal({ mode: "import", fileData: fileData.trim() });
    } catch (nextError) {
      if (isCurrent(request)) setError(formatErrorMessage(nextError));
    } finally {
      finishOperation(request);
    }
  };

  const handleConfirm = async () => {
    if (!canEdit() || !modal) return;
    if (!password.trim()) {
      setError("密码不能为空。");
      return;
    }
    if (modal.mode === "export" && password !== confirm) {
      setError("两次密码不一致。");
      return;
    }

    const request = beginOperation();
    if (!request) return;
    try {
      if (modal.mode === "export") {
        const blob = await apiClient.settings.dataBackup.export(password);
        if (!isCurrent(request)) return;
        const { save } = await import("@tauri-apps/plugin-dialog");
        if (!isCurrent(request)) return;
        const savePath = await save({
          defaultPath: `xiaoyan-backup-${new Date().toISOString().slice(0, 10)}.rcbak`,
          filters: [{ name: "备份文件", extensions: ["rcbak"] }],
        });

        if (!isCurrent(request)) return;
        if (!savePath) {
          resetModal(null);
          return;
        }

        const { writeTextFile } = await import("@tauri-apps/plugin-fs");
        if (!isCurrent(request)) return;
        await writeTextFile(savePath, blob);
        if (isCurrent(request)) resetModal(null);
        void apiClient.memory.add({
          type: "auto",
          action: "data_backup.export",
          summary: "导出了加密数据备份",
        });
        return;
      }

      // An invoked restore is durable; leaving this view cannot cancel it.
      // Keep its completion callback, but discard feedback for an unmounted view.
      await apiClient.settings.dataBackup.import(modal.fileData, password);
      await onImported?.();
      if (isCurrent(request)) resetModal(null);
      void apiClient.memory.add({
        type: "auto",
        action: "data_backup.import",
        summary: "导入了加密数据备份",
      });
    } catch (nextError) {
      if (isCurrent(request)) setError(formatErrorMessage(nextError));
    } finally {
      finishOperation(request);
    }
  };

  return {
    modal,
    password,
    confirm,
    busy,
    error,
    setPassword,
    setConfirm,
    closeModal,
    openExportModal,
    openImportPicker,
    handleConfirm,
  };
}
