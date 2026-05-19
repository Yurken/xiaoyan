import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { useSearchParams } from "react-router-dom";
import type { Paper } from "@research-copilot/types";

interface UsePaperDetailRouteOptions {
  papers: Paper[];
  detailPaperId: string | null;
  setDetailPaperId: Dispatch<SetStateAction<string | null>>;
}

export function usePaperDetailRoute({
  papers,
  detailPaperId,
  setDetailPaperId,
}: UsePaperDetailRouteOptions) {
  const [searchParams, setSearchParams] = useSearchParams();
  const routePaperId = searchParams.get("paper");
  const userClosedRef = useRef(false);

  useEffect(() => {
    if (userClosedRef.current) {
      userClosedRef.current = false;
      return;
    }
    if (!routePaperId || detailPaperId === routePaperId) return;
    if (papers.some((paper) => paper.id === routePaperId)) {
      setDetailPaperId(routePaperId);
    }
  }, [detailPaperId, papers, routePaperId, setDetailPaperId]);

  const openPaperDetail = useCallback(
    (paperId: string) => {
      setDetailPaperId(paperId);
      const next = new URLSearchParams(searchParams);
      next.set("paper", paperId);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setDetailPaperId, setSearchParams],
  );

  const closePaperDetail = useCallback(() => {
    userClosedRef.current = true;
    setDetailPaperId(null);
    if (!routePaperId) return;

    const next = new URLSearchParams(searchParams);
    next.delete("paper");
    setSearchParams(next, { replace: true });
  }, [routePaperId, searchParams, setDetailPaperId, setSearchParams]);

  return { closePaperDetail, openPaperDetail };
}
