import { useEffect, useState } from "react";
import { apiClient } from "../../lib/client";
import { APP_LOCK_STATUS_CHANGE_EVENT, type AppLockStatusChangeDetail } from "./shared";
import { useInactivityLock } from "./useInactivityLock";

/**
 * 应用锁屏状态管理：初始化锁屏状态、监听设置变更、不活动自动锁定。
 */
export function useAppLock() {
  const [locked, setLocked] = useState(false);
  const [lockChecked, setLockChecked] = useState(false);
  const [lockTimeout, setLockTimeout] = useState(0);

  // 初始化锁屏状态
  useEffect(() => {
    apiClient.settings.appLock.status()
      .then((status) => {
        setLockTimeout(status.timeoutMinutes);
        if (status.enabled) setLocked(true);
      })
      .catch((err) => {
        console.warn("Failed to load app lock status:", err);
      })
      .finally(() => setLockChecked(true));
  }, []);

  useInactivityLock(lockTimeout, locked, () => setLocked(true));

  // 监听锁屏设置变更
  useEffect(() => {
    const handleStatusChange = (event: Event) => {
      const detail = (event as CustomEvent<AppLockStatusChangeDetail>).detail;
      setLockTimeout(detail.timeoutMinutes);
      if (!detail.enabled) {
        setLocked(false);
      }
    };

    window.addEventListener(APP_LOCK_STATUS_CHANGE_EVENT, handleStatusChange);
    return () => window.removeEventListener(APP_LOCK_STATUS_CHANGE_EVENT, handleStatusChange);
  }, []);

  return { locked, setLocked, lockChecked };
}
