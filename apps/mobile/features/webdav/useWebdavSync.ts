import { useState, useCallback } from "react";

export interface WebdavConfig {
  url: string;
  username: string;
  password: string;
}

export interface WebdavFile {
  name: string;
  size: number;
  lastModified: string;
}

function btoa(str: string): string {
  // Simple base64 encoding for React Native (no built-in btoa)
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let result = "";
  const bytes = new TextEncoder().encode(str);
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const triple = (b0 << 16) | (b1 << 8) | b2;
    result += chars[(triple >> 18) & 0x3f];
    result += chars[(triple >> 12) & 0x3f];
    result += i + 1 < bytes.length ? chars[(triple >> 6) & 0x3f] : "=";
    result += i + 2 < bytes.length ? chars[triple & 0x3f] : "=";
  }
  return result;
}

function webdavRequest(
  config: WebdavConfig,
  method: string,
  path: string,
  body?: string | ArrayBuffer,
): Promise<{ status: number; body: string; headers: Record<string, string> }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const baseUrl = config.url.replace(/\/+$/, "");
    xhr.open(method, `${baseUrl}${path}`, true);
    xhr.setRequestHeader(
      "Authorization",
      `Basic ${btoa(`${config.username}:${config.password}`)}`,
    );
    if (method === "PROPFIND") {
      xhr.setRequestHeader("Content-Type", "application/xml");
      xhr.setRequestHeader("Depth", "1");
    }
    xhr.timeout = 30000;

    xhr.onload = () => {
      const headers: Record<string, string> = {};
      xhr
        .getAllResponseHeaders()
        .split("\r\n")
        .forEach((line) => {
          const [k, v] = line.split(": ");
          if (k) headers[k.toLowerCase()] = v;
        });
      resolve({ status: xhr.status, body: xhr.responseText, headers });
    };
    xhr.onerror = () => reject(new Error("网络请求失败"));
    xhr.ontimeout = () => reject(new Error("请求超时"));
    xhr.send(body ?? null);
  });
}

export function useWebdavSync() {
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const testConnection = useCallback(async (config: WebdavConfig) => {
    setTesting(true);
    setError(null);
    try {
      await webdavRequest(config, "PROPFIND", "");
      setMessage("连接成功");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "连接失败");
      return false;
    } finally {
      setTesting(false);
    }
  }, []);

  const listBackups = useCallback(async (config: WebdavConfig): Promise<WebdavFile[]> => {
    try {
      const body = `<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:">
  <D:prop>
    <D:displayname/>
    <D:getcontentlength/>
    <D:getlastmodified/>
    <D:resourcetype/>
  </D:prop>
</D:propfind>`;
      const resp = await webdavRequest(config, "PROPFIND", "", body);
      if (resp.status >= 300) return [];

      // Simple XML parse
      const files: WebdavFile[] = [];
      const responses = resp.body.split("<D:response");
      for (let i = 1; i < responses.length; i++) {
        const r = responses[i];
        if (r.includes("<D:collection/>")) continue;
        const href = extractXml(r, "D:href");
        const name = extractXml(r, "D:displayname") || href.split("/").pop() || href;
        const size = parseInt(extractXml(r, "D:getcontentlength") || "0", 10);
        const lastModified = extractXml(r, "D:getlastmodified") || "";
        if (size > 0) {
          files.push({ name, size, lastModified });
        }
      }
      return files;
    } catch {
      return [];
    }
  }, []);

  const uploadBackup = useCallback(
    async (config: WebdavConfig, data: string, filename: string) => {
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
    },
    [],
  );

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

function extractXml(xml: string, tag: string): string {
  const start = xml.indexOf(`<${tag}>`);
  if (start === -1) return "";
  const end = xml.indexOf(`</${tag}>`, start);
  if (end === -1) return "";
  return xml.slice(start + tag.length + 2, end).trim();
}
