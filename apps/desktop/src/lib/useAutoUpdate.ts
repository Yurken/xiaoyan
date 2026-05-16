import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { updatesApi } from "./client";
import type { AppUpdateInfo } from "@research-copilot/types";

const INTERVAL_MS = 30 * 60 * 1000;

export interface DownloadProgress {
  status: "started" | "progress" | "finished";
  downloaded: number;
  total: number | null;
}

export interface AutoUpdateState {
  updateInfo: AppUpdateInfo | null;
  installing: boolean;
  downloadProgress: DownloadProgress | null;
  install: () => Promise<void>;
  dismiss: () => void;
}

export function useAutoUpdate(): AutoUpdateState {
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(null);
  const [installing, setInstalling] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const checkingRef = useRef(false);

  const check = useCallback(async () => {
    if (checkingRef.current) return;
    checkingRef.current = true;
    try {
      const info = await updatesApi.check();
      if (info.configured && info.available) {
        setUpdateInfo(info);
        setDismissed(false);
      }
    } catch {
      // silently ignore background check failures
    } finally {
      checkingRef.current = false;
    }
  }, []);

  const install = useCallback(async () => {
    setInstalling(true);
    setDownloadProgress(null);
    try {
      await updatesApi.install();
    } catch {
      setInstalling(false);
      setDownloadProgress(null);
    }
  }, []);

  const dismiss = useCallback(() => setDismissed(true), []);

  useEffect(() => {
    void check();
    const id = window.setInterval(() => void check(), INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [check]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void listen<DownloadProgress>("update:download-progress", (event) => {
      setDownloadProgress(event.payload);
    }).then((cleanup) => {
      unlisten = cleanup;
    });
    return () => {
      unlisten?.();
    };
  }, []);

  return {
    updateInfo: dismissed ? null : updateInfo,
    installing,
    downloadProgress,
    install,
    dismiss,
  };
}
