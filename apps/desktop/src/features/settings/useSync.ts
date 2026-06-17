import { useCallback, useEffect, useState } from "react";
import { apiClient, type SyncStatus } from "../../lib/client";
import { safeListen } from "../../lib/tauriEvent";

/**
 * 无冲突自动同步的状态与操作。
 *
 * 凭据由后端存入系统钥匙串；后台已在启动 / 聚焦 / 定时自动同步，
 * 这里只负责读取配置、展示状态、提供「配置 / 立即同步 / 停用」入口。
 */
export function useSync() {
  const [status, setStatus] = useState<SyncStatus>({
    configured: false,
    running: false,
    last_sync_at: null,
    last_error: null,
    last_message: null,
  });
  const [url, setUrl] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [cfg, st] = await Promise.all([
        apiClient.settings.sync.getConfig(),
        apiClient.settings.sync.status(),
      ]);
      setUrl(cfg.url);
      setUsername(cfg.username);
      setStatus(st);
    } catch (e) {
      setError(e instanceof Error ? e.message : "读取同步状态失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    // 后端在每次同步前后推送状态
    const unlisten = safeListen<SyncStatus>("sync://status", (event) => {
      setStatus(event.payload);
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [refresh]);

  const configure = useCallback(
    async (password: string) => {
      setBusy(true);
      setError("");
      try {
        await apiClient.settings.sync.configure(url.trim(), username.trim(), password);
        await refresh();
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "配置失败");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [url, username, refresh],
  );

  const syncNow = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      await apiClient.settings.sync.now();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "同步失败");
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const disable = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      await apiClient.settings.sync.disable();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "停用失败");
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  return {
    status,
    url,
    setUrl,
    username,
    setUsername,
    loading,
    busy,
    error,
    setError,
    configure,
    syncNow,
    disable,
    refresh,
  };
}
