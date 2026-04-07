import { useState } from "react";
import type { AppSettings } from "@research-copilot/types";
import { apiClient, formatErrorMessage } from "../../lib/client";

export type CryptoModalState = { mode: "export" } | { mode: "import"; fileData: string } | null;

interface UseSettingsCryptoOptions {
  onImported: (settings: AppSettings) => void;
  onSaved: () => void;
}

export function useSettingsCrypto({ onImported, onSaved }: UseSettingsCryptoOptions) {
  const [modal, setModal] = useState<CryptoModalState>(null);
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
      const file = await open({ filters: [{ name: "配置文件", extensions: ["rcconf"] }], multiple: false });
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
        const blob = await apiClient.settings.export(password);
        const { save } = await import("@tauri-apps/plugin-dialog");
        const savePath = await save({
          defaultPath: "settings.rcconf",
          filters: [{ name: "配置文件", extensions: ["rcconf"] }],
        });

        if (!savePath) {
          closeModal();
          return;
        }

        const { writeTextFile } = await import("@tauri-apps/plugin-fs");
        await writeTextFile(savePath, blob);
        closeModal();
        onSaved();
        void apiClient.memory.add({ type: "auto", action: "settings.export", summary: "导出了加密配置文件" });
        return;
      }

      const importedKeys = await apiClient.settings.import(modal.fileData, password);
      const fresh = await apiClient.settings.get();
      onImported(fresh);
      closeModal();
      onSaved();
      void apiClient.memory.add({
        type: "auto",
        action: "settings.import",
        summary: `导入了 ${importedKeys.length} 项配置`,
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
