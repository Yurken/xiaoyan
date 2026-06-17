import { useCallback, useState } from "react";
import { codeApi } from "../../lib/client";
import type { DirEntry } from "./shared";

export function useCodeFileSystem() {
  const [entries, setEntries] = useState<DirEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const listDir = useCallback(async (path: string) => {
    setLoading(true);
    setError("");
    try {
      const result = await codeApi.listDir(path);
      setEntries(result.entries);
      return result.entries;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const readFile = useCallback(async (path: string) => {
    try {
      const result = await codeApi.readFile(path);
      return result.content;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      return null;
    }
  }, []);

  const writeFile = useCallback(async (path: string, content: string) => {
    try {
      await codeApi.writeFile(path, content);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      return false;
    }
  }, []);

  return {
    entries,
    loading,
    error,
    listDir,
    readFile,
    writeFile,
  };
}
