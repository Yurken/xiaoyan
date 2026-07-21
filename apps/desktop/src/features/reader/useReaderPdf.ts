import { useEffect, useState } from "react";
import type { Paper } from "@research-copilot/types";
import { papersApi } from "../../lib/client";

/** 加载阅读页所需的论文详情与本地 PDF，副作用不进入页面组件。 */
export function useReaderPdf(paperId?: string) {
  const [paper, setPaper] = useState<Paper | null>(null);
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!paperId) {
      setPaper(null);
      setPdfData(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    setPdfData(null);
    setPaper(null);

    void (async () => {
      try {
        const detail = await papersApi.get(paperId);
        if (cancelled) return;
        setPaper(detail);
        if (!detail.file_path) {
          setLoadError("该论文没有本地 PDF 文件，无法批注阅读。");
          return;
        }
        const { readFile } = await import("@tauri-apps/plugin-fs");
        const bytes = await readFile(detail.file_path);
        if (!cancelled) setPdfData(bytes);
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "无法打开 PDF。");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [paperId]);

  return { paper, pdfData, loadError, loading };
}
