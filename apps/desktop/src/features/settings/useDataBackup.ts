import { useState } from "react";
import { apiClient, formatErrorMessage } from "../../lib/client";

export type DataBackupModalState =
  | { mode: "export" }
  | { mode: "import"; fileData: string }
  | null;

export function useDataBackup() {
  const [modal, setModal] = useState<DataBackupModalState>(null);
  const [password, setPasswordValue] = useState("");
  const [confirm, setConfirmValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const setPassword = (value: string) => {
    setPasswordValue(value);
    setError("");
  };

  const setConfirm = (value: string) => {
    setConfirmValue(value);
    setError("");
  };

  const closeModal = () => {
    setModal(null);
    setPasswordValue("");
    setConfirmValue("");
    setBusy(false);
    setError("");
  };

  const openExportModal = () => {
    setModal({ mode: "export" });
    setPasswordValue("");
    setConfirmValue("");
    setBusy(false);
    setError("");
  };

  const openImportPicker = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const file = await open({
        filters: [{ name: "备份文件", extensions: ["rcbak"] }],
        multiple: false,
      });
      if (!file) return;

      const filePath = typeof file === "string" ? file : (file as { path: string }).path;
      const { readTextFile } = await import("@tauri-apps/plugin-fs");
      const fileData = await readTextFile(filePath);

      setModal({ mode: "import", fileData: fileData.trim() });
      setPasswordValue("");
      setConfirmValue("");
      setBusy(false);
      setError("");
    } catch (nextError) {
      setError(formatErrorMessage(nextError));
    }
  };

  const handleConfirm = async () => {
    if (!modal) return;
    if (!password.trim()) {
      setError("密码不能为空。");
      return;
    }
    if (modal.mode === "export" && password !== confirm) {
      setError("两次密码不一致。");
      return;
    }

    setBusy(true);
    setError("");

    try {
      if (modal.mode === "export") {
        const blob = await apiClient.settings.dataBackup.export(password);
        const { save } = await import("@tauri-apps/plugin-dialog");
        const savePath = await save({
          defaultPath: `xiaoyan-backup-${new Date().toISOString().slice(0, 10)}.rcbak`,
          filters: [{ name: "备份文件", extensions: ["rcbak"] }],
        });

        if (!savePath) {
          closeModal();
          return;
        }

        const { writeTextFile } = await import("@tauri-apps/plugin-fs");
        await writeTextFile(savePath, blob);
        closeModal();
        void apiClient.memory.add({
          type: "auto",
          action: "data_backup.export",
          summary: "导出了加密全量数据备份",
        });
        return;
      }

      await apiClient.settings.dataBackup.import(modal.fileData, password);
      closeModal();
      void apiClient.memory.add({
        type: "auto",
        action: "data_backup.import",
        summary: "导入了加密全量数据备份",
      });
    } catch (nextError) {
      setError(formatErrorMessage(nextError));
    } finally {
      setBusy(false);
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
