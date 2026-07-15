import { useCallback, useEffect, useRef, useState } from "react";
import { safeListen } from "./tauriEvent";
import { formatErrorMessage, updatesApi } from "./client";
import type { AppUpdateInfo } from "@research-copilot/types";
import type { DownloadProgress } from "./updateProgress";
import { readPersistentValue, writePersistentValue } from "../hooks/usePersistentStringState";
import {
  isUpdateVersionSkipped,
  normalizeUpdateVersion,
  SKIPPED_UPDATE_VERSION_STORAGE_KEY,
} from "../features/update/shared";

const INTERVAL_MS = 30 * 60 * 1000;

export type { DownloadProgress } from "./updateProgress";

export interface AutoUpdateState {
  updateInfo: AppUpdateInfo | null;
  installing: boolean;
  downloadProgress: DownloadProgress | null;
  installError: string;
  install: () => Promise<void>;
  dismiss: () => void;
  skipVersion: () => void;
}

export function useAutoUpdate(): AutoUpdateState {
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(null);
  const [installing, setInstalling] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [installError, setInstallError] = useState("");
  const checkingRef = useRef(false);

  const check = useCallback(async () => {
    if (checkingRef.current) return;
    checkingRef.current = true;
    try {
      const info = await updatesApi.check();
      if (info.configured && info.available) {
        const skippedVersion = readPersistentValue(SKIPPED_UPDATE_VERSION_STORAGE_KEY);
        if (isUpdateVersionSkipped(info.version, skippedVersion)) {
          setUpdateInfo(null);
          setInstallError("");
          return;
        }
        setUpdateInfo(info);
        setInstallError("");
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
    setInstallError("");
    try {
      await updatesApi.install();
    } catch (error) {
      setInstalling(false);
      setDownloadProgress(null);
      setInstallError(formatErrorMessage(error));
    }
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
    setInstallError("");
  }, []);

  const skipVersion = useCallback(() => {
    const version = normalizeUpdateVersion(updateInfo?.version);
    if (version) {
      writePersistentValue(SKIPPED_UPDATE_VERSION_STORAGE_KEY, version);
    }
    setDismissed(true);
    setInstallError("");
  }, [updateInfo?.version]);

  useEffect(() => {
    void check();
    const id = window.setInterval(() => void check(), INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [check]);

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

  return {
    updateInfo: dismissed ? null : updateInfo,
    installing,
    downloadProgress,
    installError,
    install,
    dismiss,
    skipVersion,
  };
}
