import { useEffect, useState } from "react";
import { apiClient } from "../../lib/client";
import { DEFAULT_SETTINGS } from "../settings/pageConfig";
import { readPersistentValue, writePersistentValue } from "../../hooks/usePersistentStringState";
import { buildQuickStartSteps, computeQuickStartReadiness, type QuickStartStep } from "./quickStart";

const SEEN_STORAGE_KEY = "rc:onboarding:quick-start-seen";

/**
 * 首次打开应用时自动弹出「快速开始」引导。
 * 只在从未看过（localStorage 标记缺失）且应用未锁定时触发一次。
 */
export function useFirstRunQuickStart({ enabled }: { enabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [steps, setSteps] = useState<QuickStartStep[]>([]);

  useEffect(() => {
    if (!enabled) return;
    if (readPersistentValue(SEEN_STORAGE_KEY) === "true") return;

    let cancelled = false;
    void (async () => {
      let form = DEFAULT_SETTINGS;
      try {
        form = { ...DEFAULT_SETTINGS, ...(await apiClient.settings.get()) };
      } catch (err) {
        // 后端暂不可用时仍按默认配置展示引导，不阻塞首次打开。
        console.warn("Failed to load settings for quick start:", err);
      }
      if (cancelled) return;
      setSteps(buildQuickStartSteps(computeQuickStartReadiness(form)));
      setOpen(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const dismiss = () => {
    writePersistentValue(SEEN_STORAGE_KEY, "true");
    setOpen(false);
  };

  return { open, steps, dismiss };
}
