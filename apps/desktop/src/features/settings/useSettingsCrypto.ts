import { useEffect, useRef, useState } from "react";
import { apiClient, formatErrorMessage } from "../../lib/client";

export type CryptoModalState = { mode: "export" } | { mode: "import"; fileData: string } | null;

interface UseSettingsCryptoOptions {
  onImport: (data: string, password: string) => Promise<string[]>;
  onSaved: () => void;
}

export function useSettingsCrypto({ onImport, onSaved }: UseSettingsCryptoOptions) {
  const [modal, setModal] = useState<CryptoModalState>(null);
  const [password, setPasswordValue] = useState("");
  const [confirm, setConfirmValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const activeRequest = useRef<number | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; generation.current += 1; };
  }, []);

  const isCurrent = (request: number) => mounted.current && generation.current === request;

  const setPassword = (value: string) => {
    setPasswordValue(value);
    setError("");
  };

  const setConfirm = (value: string) => {
    setConfirmValue(value);
    setError("");
  };

  const resetModal = (next: CryptoModalState) => {
    generation.current += 1;
    activeRequest.current = null;
    setModal(next);
    setPasswordValue("");
    setConfirmValue("");
    setBusy(false);
    setError("");
  };

  const closeModal = () => resetModal(null);
  const openExportModal = () => resetModal({ mode: "export" });

  const openImportPicker = async () => {
    const request = ++generation.current;
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const file = await open({ filters: [{ name: "配置文件", extensions: ["rcconf"] }], multiple: false });
      if (!file || !isCurrent(request)) return;
      const filePath = typeof file === "string" ? file : (file as { path: string }).path;
      const { readTextFile } = await import("@tauri-apps/plugin-fs");
      const fileData = await readTextFile(filePath);
      if (isCurrent(request)) resetModal({ mode: "import", fileData: fileData.trim() });
    } catch (nextError) {
      if (isCurrent(request)) setError(formatErrorMessage(nextError));
    }
  };

  const handleConfirm = async () => {
    const request = generation.current;
    if (!modal || activeRequest.current === request) return;
    if (!password.trim()) {
      setError("密码不能为空。");
      return;
    }
    if (modal.mode === "export" && password !== confirm) {
      setError("两次密码不一致。");
      return;
    }

    activeRequest.current = request;
    setBusy(true);
    setError("");

    try {
      if (modal.mode === "export") {
        const blob = await apiClient.settings.export(password);
        if (!isCurrent(request)) return;
        const { save } = await import("@tauri-apps/plugin-dialog");
        const savePath = await save({
          defaultPath: "settings.rcconf",
          filters: [{ name: "配置文件", extensions: ["rcconf"] }],
        });
        if (!isCurrent(request)) return;
        if (!savePath) { closeModal(); return; }
        const { writeTextFile } = await import("@tauri-apps/plugin-fs");
        await writeTextFile(savePath, blob);
        if (!isCurrent(request)) return;
        closeModal();
        onSaved();
        void apiClient.memory.add({ type: "auto", action: "settings.export", summary: "导出了加密配置文件" });
        return;
      }

      // Confirmation starts a durable operation. Closing its UI only invalidates
      // UI feedback; the coordinated write/read/accept operation still completes.
      const importedKeys = await onImport(modal.fileData, password);
      if (isCurrent(request)) closeModal();
      void apiClient.memory.add({
        type: "auto",
        action: "settings.import",
        summary: `导入了 ${importedKeys.length} 项配置`,
      });
    } catch (nextError) {
      if (isCurrent(request)) setError(formatErrorMessage(nextError));
    } finally {
      if (isCurrent(request)) {
        activeRequest.current = null;
        setBusy(false);
      }
    }
  };

  return {
    modal, password, confirm, busy, error,
    setPassword, setConfirm, closeModal, openExportModal, openImportPicker, handleConfirm,
  };
}
