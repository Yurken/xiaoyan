import { useCallback, useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";
import type { WebdavConfig } from "../webdav/client";
import { pullSync } from "./engine";
import { metaGet, metaSet } from "./localStore";
import type { SyncSummary } from "./types";

const CONFIG_KEY = "xiaoyan.webdav.config";
const LAST_SYNCED_META = "last_synced_at";

const EMPTY: WebdavConfig = { url: "", username: "", password: "" };

export function useSync() {
  const [config, setConfig] = useState<WebdavConfig>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [summary, setSummary] = useState<SyncSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const raw = await SecureStore.getItemAsync(CONFIG_KEY);
        if (raw) setConfig({ ...EMPTY, ...(JSON.parse(raw) as Partial<WebdavConfig>) });
      } catch {
        // 忽略读取失败，使用空配置
      }
      setLastSyncedAt(await metaGet(LAST_SYNCED_META));
      setLoaded(true);
    })();
  }, []);

  const setField = useCallback((field: keyof WebdavConfig, value: string) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  }, []);

  const persist = useCallback(async (next: WebdavConfig) => {
    await SecureStore.setItemAsync(CONFIG_KEY, JSON.stringify(next));
  }, []);

  const runSync = useCallback(async (): Promise<boolean> => {
    if (syncing) return false;
    const target: WebdavConfig = {
      url: config.url.trim(),
      username: config.username.trim(),
      password: config.password,
    };
    if (!target.url || !target.password) {
      setError("请先填写 WebDAV 地址与密码");
      return false;
    }
    setSyncing(true);
    setError(null);
    setSummary(null);
    try {
      await persist(target);
      const result = await pullSync(target, target.password);
      setSummary(result);
      const now = new Date().toISOString();
      await metaSet(LAST_SYNCED_META, now);
      setLastSyncedAt(now);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "同步失败");
      return false;
    } finally {
      setSyncing(false);
    }
  }, [config, persist, syncing]);

  return { config, setField, loaded, syncing, summary, error, lastSyncedAt, runSync };
}
