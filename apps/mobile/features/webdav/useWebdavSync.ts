import { useState, useCallback } from "react";
import { propfindFiles, webdavRequest, type WebdavConfig, type WebdavFile } from "./client";

export type { WebdavConfig, WebdavFile } from "./client";

export function useWebdavSync() {
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const testConnection = useCallback(async (config: WebdavConfig) => {
    setTesting(true);
    setError(null);
    try {
      await webdavRequest(config, "PROPFIND", "/");
      setMessage("连接成功");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "连接失败");
      return false;
    } finally {
      setTesting(false);
    }
  }, []);

  const listBackups = useCallback(
    (config: WebdavConfig): Promise<WebdavFile[]> => propfindFiles(config, "").catch(() => []),
    [],
  );

  const uploadBackup = useCallback(async (config: WebdavConfig, data: string, filename: string) => {
    setSyncing(true);
    setError(null);
    try {
      await webdavRequest(config, "PUT", `/${filename}`, data);
      setMessage(`已上传: ${filename}`);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "上传失败");
      return false;
    } finally {
      setSyncing(false);
    }
  }, []);

  const downloadBackup = useCallback(async (config: WebdavConfig, filename: string) => {
    try {
      const resp = await webdavRequest(config, "GET", `/${filename}`);
      return resp.body;
    } catch (e) {
      setError(e instanceof Error ? e.message : "下载失败");
      return null;
    }
  }, []);

  return {
    testing, syncing, error, message,
    setError, setMessage,
    testConnection, listBackups, uploadBackup, downloadBackup,
  };
}
