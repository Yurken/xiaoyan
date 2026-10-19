import { useLayoutEffect, useRef, useState } from "react";
import { apiClient, formatErrorMessage } from "../../lib/client";

export type DataBackupModalState =
  | { mode: "export" }
  | { mode: "import"; fileData: string }
  | null;

interface UseDataBackupOptions {
  onImport?: (data: string, password: string, onReadback: () => Promise<void>) => Promise<void>;
  onImported?: () => Promise<void> | void;
  blocked?: boolean;
}

interface BackupOperation {
  version: number;
  lifetime: { active: boolean };
}

export function useDataBackup({ onImport, onImported, blocked = false }: UseDataBackupOptions = {}) {
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
  const blockedRef = useRef(blocked);
  blockedRef.current = blocked;

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
    if (!canEdit() || blockedRef.current) return null;
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
    if (canEdit() && !blockedRef.current) resetModal({ mode: "export" });
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
    if (!canEdit() || blockedRef.current || !modal) return;
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

      // The controller reserves settings persistence synchronously. Its readback
      // callback also runs after a read-only recovery, when this request is no
      // longer busy; modal identity must therefore not depend on the busy token.
      const onReadback = async () => {
        if (request.lifetime.active && lifetime.current === request.lifetime && version.current === request.version) {
          resetModal(null);
        }
        try {
          await onImported?.();
        } catch (refreshError) {
          console.warn("备份设置已重新读取，但刷新相关界面失败", refreshError);
        }
      };
      if (onImport) {
        await onImport(modal.fileData, password, onReadback);
      } else {
        await apiClient.settings.dataBackup.import(modal.fileData, password);
        await onReadback();
      }
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
