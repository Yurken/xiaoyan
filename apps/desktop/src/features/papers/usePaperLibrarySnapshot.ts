import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { Paper } from "@research-copilot/types";
import { apiClient, formatErrorMessage } from "../../lib/client";
import { readCachedPaperList, replaceCachedPaperList } from "../../lib/paperListCache";

/** 论文库与阅读页共享的、进程内常驻的论文列表快照。 */
export function usePaperLibrarySnapshot() {
  const initialSnapshot = useRef(readCachedPaperList());
  const [papers, setPapersState] = useState<Paper[]>(() => initialSnapshot.current ?? []);
  const [loading, setLoading] = useState(initialSnapshot.current === null);
  const [loadError, setLoadError] = useState("");

  const setPapers = useCallback<Dispatch<SetStateAction<Paper[]>>>((nextValue) => {
    setPapersState((previous) => {
      const next = typeof nextValue === "function" ? nextValue(previous) : nextValue;
      return replaceCachedPaperList(next);
    });
  }, []);

  useEffect(() => {
    const cached = readCachedPaperList();
    if (cached) {
      setPapersState(cached);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError("");
    apiClient.papers.list(0, 500)
      .then((data) => { if (!cancelled) setPapers(data); })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(formatErrorMessage(error));
          setPapersState([]);
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [setPapers]);

  return { papers, setPapers, loading, loadError, setLoadError };
}
