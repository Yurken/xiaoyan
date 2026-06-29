import { useEffect, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { appDataDir } from "@tauri-apps/api/path";

const ASSET_URL_PATTERN = /xynoteasset:\/\/([^/\s]+)\/([^)\s]+)/g;

export function useResolvedNoteContent(content: string): string {
  const [baseDir, setBaseDir] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    appDataDir()
      .then((dir) => {
        if (!cancelled) setBaseDir(dir);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!baseDir) return content;

  return content.replace(ASSET_URL_PATTERN, (_, noteId: string, fileName: string) => {
    const storedPath = `${baseDir}/notes_assets/${noteId}/${fileName}`;
    return convertFileSrc(storedPath);
  });
}
