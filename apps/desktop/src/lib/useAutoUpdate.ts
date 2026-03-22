import { useCallback, useEffect, useRef, useState } from "react";
import { updatesApi } from "./client";
import type { AppUpdateInfo } from "@research-copilot/types";

const INTERVAL_MS = 30 * 60 * 1000;

export interface AutoUpdateState {
  updateInfo: AppUpdateInfo | null;
  installing: boolean;
  install: () => Promise<void>;
  dismiss: () => void;
}

export function useAutoUpdate(): AutoUpdateState {
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(null);
  const [installing, setInstalling] = useState(false);
  const [dismissed, setDismissed] = useState(false);
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
    try {
      await updatesApi.install();
    } catch {
      setInstalling(false);
    }
  }, []);

  const dismiss = useCallback(() => setDismissed(true), []);

  useEffect(() => {
    void check();
    const id = window.setInterval(() => void check(), INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [check]);

  return {
    updateInfo: dismissed ? null : updateInfo,
    installing,
    install,
    dismiss,
  };
}
