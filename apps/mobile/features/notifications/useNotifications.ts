import { useCallback, useEffect, useRef, useState } from "react";
import {
  getNotificationPermissionStatus,
  requestNotificationPermission,
  sendLocalTestNotification,
  type NotificationPermissionStatus,
} from "./service";

function toUserFacingError(_error: unknown, fallback: string): string {
  return fallback;
}

export function useNotifications() {
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermissionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    void (async () => {
      try {
        const status = await getNotificationPermissionStatus();
        if (!mountedRef.current) return;
        setPermissionStatus(status);
        setMessage(null);
      } catch (error) {
        if (!mountedRef.current) return;
        setMessage(toUserFacingError(error, "无法读取通知权限，请稍后重试"));
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const enable = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setMessage(null);
    try {
      const status = await requestNotificationPermission();
      if (!mountedRef.current) return;
      setPermissionStatus(status);
      if (status !== "granted") {
        setMessage("通知权限未开启，可在系统设置中允许通知");
      }
    } catch (error) {
      if (!mountedRef.current) return;
      setMessage(toUserFacingError(error, "无法请求通知权限，请稍后重试"));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [loading]);

  const sendTest = useCallback(async () => {
    if (loading) return;
    if (permissionStatus !== "granted") {
      setMessage("当前未授权通知，无法发送测试通知");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const sent = await sendLocalTestNotification();
      if (!mountedRef.current) return;
      if (!sent) {
        setMessage("当前未授权通知，无法发送测试通知");
        return;
      }
      setMessage("已发送测试通知");
    } catch (error) {
      if (!mountedRef.current) return;
      setMessage(toUserFacingError(error, "发送测试通知失败，请稍后重试"));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [loading, permissionStatus]);

  return { permissionStatus, loading, message, enable, sendTest };
}
