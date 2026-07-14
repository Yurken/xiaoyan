import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  WikiCompileRun,
  WikiCompileSummary,
  WikiIssue,
  WikiPage,
  WikiPageDetail,
  WikiPageStatus,
  WikiPageType,
} from "./shared";
import { apiClient, formatErrorMessage } from "../../lib/client";

interface WikiPagePatch {
  title?: string;
  summary?: string;
  content?: string;
  status?: WikiPageStatus;
  page_type?: WikiPageType;
  change_summary?: string;
}

export function useWikiWorkspace(interestId?: string) {
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [detail, setDetail] = useState<WikiPageDetail | null>(null);
  const [issues, setIssues] = useState<WikiIssue[]>([]);
  const [runs, setRuns] = useState<WikiCompileRun[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | WikiPageStatus>("");
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [saving, setSaving] = useState(false);
  const [linting, setLinting] = useState(false);
  const [error, setError] = useState("");
  const [lastCompile, setLastCompile] = useState<WikiCompileSummary | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 280);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setSelectedPageId(null);
    setDetail(null);
    setLastCompile(null);
  }, [interestId]);

  const loadIndex = useCallback(async () => {
    if (!interestId) {
      setPages([]);
      setIssues([]);
      setRuns([]);
      setSelectedPageId(null);
      setDetail(null);
      return;
    }
    setLoading(true);
    try {
      const [nextPages, nextIssues, nextRuns] = await Promise.all([
        apiClient.wiki.listPages(interestId, debouncedSearch || undefined, statusFilter || undefined),
        apiClient.wiki.listIssues(interestId),
        apiClient.wiki.listCompileRuns(interestId),
      ]);
      setPages(nextPages);
      setIssues(nextIssues);
      setRuns(nextRuns);
      setSelectedPageId((current) => {
        if (current && nextPages.some((page) => page.id === current)) return current;
        return nextPages[0]?.id ?? null;
      });
      setError("");
    } catch (nextError) {
      setError(formatErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, interestId, statusFilter]);

  useEffect(() => {
    void loadIndex();
  }, [loadIndex]);

  useEffect(() => {
    if (!selectedPageId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    apiClient.wiki.getPage(selectedPageId)
      .then((nextDetail) => {
        if (!cancelled) {
          setDetail(nextDetail);
          setDetailLoading(false);
        }
      })
      .catch((nextError) => {
        if (!cancelled) {
          setError(formatErrorMessage(nextError));
          setDetailLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [selectedPageId]);

  const compile = useCallback(async (force = false) => {
    if (!interestId) return null;
    setCompiling(true);
    setError("");
    try {
      const summary = await apiClient.wiki.compileInterest(interestId, force);
      setLastCompile(summary);
      await loadIndex();
      return summary;
    } catch (nextError) {
      setError(formatErrorMessage(nextError));
      return null;
    } finally {
      setCompiling(false);
    }
  }, [interestId, loadIndex]);

  const updatePage = useCallback(async (patch: WikiPagePatch) => {
    if (!selectedPageId) return null;
    setSaving(true);
    setError("");
    try {
      const nextDetail = await apiClient.wiki.updatePage(selectedPageId, patch);
      setDetail(nextDetail);
      setPages((current) => current.map((page) => (
        page.id === nextDetail.id ? { ...page, ...nextDetail } : page
      )));
      if (interestId) {
        setIssues(await apiClient.wiki.listIssues(interestId));
      }
      return nextDetail;
    } catch (nextError) {
      setError(formatErrorMessage(nextError));
      return null;
    } finally {
      setSaving(false);
    }
  }, [interestId, selectedPageId]);

  const lint = useCallback(async () => {
    if (!interestId) return;
    setLinting(true);
    setError("");
    try {
      await apiClient.wiki.lintInterest(interestId);
      setIssues(await apiClient.wiki.listIssues(interestId));
    } catch (nextError) {
      setError(formatErrorMessage(nextError));
    } finally {
      setLinting(false);
    }
  }, [interestId]);

  const selectSlug = useCallback((slug: string) => {
    const page = pages.find((item) => item.slug === slug);
    if (page) setSelectedPageId(page.id);
  }, [pages]);

  const counts = useMemo(() => ({
    total: pages.length,
    draft: pages.filter((page) => page.status === "draft").length,
    reviewed: pages.filter((page) => page.status === "reviewed").length,
  }), [pages]);

  return {
    pages,
    detail,
    issues,
    runs,
    selectedPageId,
    setSelectedPageId,
    selectSlug,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    loading,
    detailLoading,
    compiling,
    saving,
    linting,
    error,
    lastCompile,
    counts,
    compile,
    updatePage,
    lint,
  };
}
