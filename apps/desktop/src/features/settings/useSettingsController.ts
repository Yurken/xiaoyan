import { useCallback, useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { safeListen } from "../../lib/tauriEvent";
import type { AppSettings, AppUpdateInfo } from "@research-copilot/types";
import { apiClient, formatErrorMessage } from "../../lib/client";
import { emitCompanionPreferenceChange, normalizeCompanionId } from "../companion/shared";
import type { DownloadProgress } from "../../lib/useAutoUpdate";

export type SaveState = "idle" | "saving" | "saved" | "error";
export type TestState = "idle" | "testing" | "ok" | "error";
export type UpdateState = "idle" | "checking" | "ready" | "latest" | "installing" | "disabled" | "error";

export function useSettingsController(defaultSettings: AppSettings) {
  const [form, setForm] = useState<AppSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [testState, setTestState] = useState<TestState>("idle");
  const [testMsg, setTestMsg] = useState("");
  const [updateState, setUpdateState] = useState<UpdateState>("idle");
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(null);
  const [updateMsg, setUpdateMsg] = useState("");
  const [appVersion, setAppVersion] = useState("");
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);

  const replaceForm = useCallback((next: Partial<AppSettings>) => {
    setForm({ ...defaultSettings, ...next });
  }, [defaultSettings]);

  const set = (key: keyof AppSettings) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const setMany = (keys: (keyof AppSettings)[]) => (value: string) =>
    setForm((current) => {
      const next = { ...current };
      keys.forEach((key) => {
        (next as Record<keyof AppSettings, string>)[key] = value;
      });
      return next;
    });

  const setManyFlat = (updates: Partial<Record<keyof AppSettings, string>>) =>
    setForm((current) => ({ ...current, ...updates }));

  const getSharedValue = (keys: (keyof AppSettings)[]) => {
    const values = keys
      .map((key) => (form[key] ?? "").trim())
      .filter(Boolean);
    if (values.length === 0) {
      return "";
    }
    return new Set(values).size === 1 ? values[0] : "";
  };

  const hasMixedValue = (keys: (keyof AppSettings)[]) => {
    const values = keys
      .map((key) => (form[key] ?? "").trim())
      .filter(Boolean);
    return new Set(values).size > 1;
  };

  const markSaved = (duration = 2500) => {
    setSaveState("saved");
    window.setTimeout(() => setSaveState("idle"), duration);
  };

  useEffect(() => {
    let cancelled = false;

    const loadSettings = async () => {
      setLoading(true);
      setLoadError("");

      try {
        const [data, version] = await Promise.all([apiClient.settings.get(), getVersion()]);
        if (!cancelled) {
          replaceForm(data);
          setAppVersion(version);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(formatErrorMessage(error));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadSettings();
    return () => {
      cancelled = true;
    };
  }, [replaceForm]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let mounted = true;
    void safeListen<DownloadProgress>("update:download-progress", (event) => {
      setDownloadProgress(event.payload);
    }).then((cleanup) => {
      if (!mounted) {
        cleanup();
        return;
      }
      unlisten = cleanup;
    });
    return () => {
      mounted = false;
      unlisten?.();
      unlisten = undefined;
    };
  }, []);

  const handleSaveSettings = async () => {
    setSaveState("saving");
    try {
      await apiClient.settings.update(form);
      emitCompanionPreferenceChange(normalizeCompanionId(form.xiaoyan_companion_id));
      markSaved();
    } catch (error) {
      setSaveState("error");
      window.setTimeout(() => setSaveState("idle"), 3000);
      console.error("save settings failed:", error);
    }
  };

  const handleTestConnection = async () => {
    setTestState("testing");
    setTestMsg("");
    try {
      const reply = await apiClient.settings.test(form);
      setTestState("ok");
      setTestMsg(reply.slice(0, 80));
      window.setTimeout(() => setTestState("idle"), 4000);
    } catch (error) {
      setTestState("error");
      setTestMsg(formatErrorMessage(error).slice(0, 120));
      window.setTimeout(() => setTestState("idle"), 5000);
    }
  };

  const handleCheckUpdate = async () => {
    setUpdateState("checking");
    setUpdateMsg("");
    setDownloadProgress(null);
    try {
      const info = await apiClient.updates.check();
      setUpdateInfo(info);
      if (!info.configured) {
        setUpdateState("disabled");
        setUpdateMsg("当前构建未配置升级源。开发环境通常会显示这个状态，正式发布版需要在 CI 中注入更新地址和公钥。");
        return;
      }
      if (info.available) {
        setUpdateState("ready");
        setUpdateMsg(`检测到新版本 ${info.version ?? ""}，可以直接下载并安装。`);
        return;
      }
      setUpdateState("latest");
      setUpdateMsg("当前已经是最新版本。");
    } catch (error) {
      setUpdateState("error");
      setUpdateMsg(formatErrorMessage(error));
    }
  };

  const handleInstallUpdate = async () => {
    setUpdateState("installing");
    setDownloadProgress(null);
    setUpdateMsg("正在下载并安装更新，完成后应用会自动重启。");
    try {
      await apiClient.updates.install();
      setUpdateMsg("更新已安装，应用即将重启。");
    } catch (error) {
      setUpdateState("error");
      setUpdateMsg(formatErrorMessage(error));
    }
  };

  return {
    form,
    setForm,
    replaceForm,
    set,
    setMany,
    setManyFlat,
    getSharedValue,
    hasMixedValue,
    loading,
    loadError,
    saveState,
    testState,
    testMsg,
    updateState,
    updateInfo,
    updateMsg,
    downloadProgress,
    appVersion,
    markSaved,
    handleSaveSettings,
    handleTestConnection,
    handleCheckUpdate,
    handleInstallUpdate,
  };
}
