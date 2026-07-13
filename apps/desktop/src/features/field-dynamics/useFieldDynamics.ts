import { useCallback, useEffect, useRef, useState } from "react";
import type { ResearchFieldBriefing, ResearchInterest } from "@research-copilot/types";
import { apiClient, formatErrorMessage } from "../../lib/client";
import { useDomainEventRefresh } from "../../hooks/useDomainEventRefresh";

type ScanningListener = (scanning: boolean) => void;

const scanningState = {
  scanning: false,
  listeners: new Set<ScanningListener>(),
  set(value: boolean) {
    this.scanning = value;
    this.listeners.forEach((listener) => listener(value));
  },
  subscribe(listener: ScanningListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  },
};

export function useFieldDynamics() {
  const [briefings, setBriefings] = useState<ResearchFieldBriefing[]>([]);
  const [history, setHistory] = useState<ResearchFieldBriefing[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(scanningState.scanning);
  const [interestId, setInterestId] = useState("");
  const [importingPaper, setImportingPaper] = useState<{
    briefingId: string;
    externalId: string;
  } | null>(null);
  const [importErrors, setImportErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [interests, setInterests] = useState<ResearchInterest[]>([]);
  const mountedRef = useRef(true);
  const loadRequestRef = useRef(0);
  const historyRequestRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    const unsubscribe = scanningState.subscribe(setScanning);
    return () => {
      mountedRef.current = false;
      unsubscribe();
    };
  }, []);

  const loadInterests = useCallback(async () => {
    try {
      const result = await apiClient.knowledge.listInterests();
      if (mountedRef.current) setInterests(result);
    } catch {
      // Non-critical
    }
  }, []);

  const loadBriefings = useCallback(async () => {
    const requestId = ++loadRequestRef.current;
    setLoading(true);
    setError("");
    try {
      const result = await apiClient.fieldDynamics.list(interestId || undefined);
      if (!mountedRef.current || requestId !== loadRequestRef.current) return;
      setBriefings(result.briefings);
      setUnreadCount(result.unread_count);
    } catch (err) {
      if (mountedRef.current && requestId === loadRequestRef.current) {
        setError(formatErrorMessage(err));
      }
    } finally {
      if (mountedRef.current && requestId === loadRequestRef.current) setLoading(false);
    }
  }, [interestId]);

  const [historyLoading, setHistoryLoading] = useState(true);
  const loadHistory = useCallback(async () => {
    const requestId = ++historyRequestRef.current;
    setHistoryLoading(true);
    try {
      const result = await apiClient.fieldDynamics.history(interestId || undefined, 24);
      if (mountedRef.current && requestId === historyRequestRef.current) {
        setHistory(result.briefings);
      }
    } catch {
      // The current briefing remains useful even when history is unavailable.
    } finally {
      if (mountedRef.current && requestId === historyRequestRef.current) setHistoryLoading(false);
    }
  }, [interestId]);

  const scan = useCallback(async () => {
    if (scanningState.scanning) return;
    scanningState.set(true);
    setError("");
    try {
      const result = await apiClient.fieldDynamics.scan(7, 10);
      if (mountedRef.current) {
        setBriefings(result.briefings);
        setUnreadCount(result.unread_count);
        setNotice(`已更新 ${result.scanned_interests} 个研究兴趣的简报`);
        void loadHistory();
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(formatErrorMessage(err));
      }
    } finally {
      scanningState.set(false);
    }
  }, [loadHistory]);

  const markRead = useCallback(
    async (id?: string) => {
      try {
        await apiClient.fieldDynamics.markRead(id);
        if (id) {
          setBriefings((current) =>
            current.map((briefing) =>
              briefing.id === id ? { ...briefing, is_read: true } : briefing,
            ),
          );
          setUnreadCount((count) => Math.max(0, count - 1));
        } else {
          setBriefings((current) => current.map((briefing) => ({ ...briefing, is_read: true })));
          setUnreadCount(0);
        }
      } catch (err) {
        setError(formatErrorMessage(err));
      }
    },
    [],
  );

  const importPaper = useCallback(
    async (briefingId: string, externalId: string, source: string, title: string) => {
      const errorKey = `${briefingId}:${externalId}`;
      setImportingPaper({ briefingId, externalId });
      setImportErrors((current) => {
        if (!current[errorKey]) return current;
        const next = { ...current };
        delete next[errorKey];
        return next;
      });

      try {
        const result = await apiClient.fieldDynamics.importPaper(
          briefingId,
          externalId,
          source,
        );
        setNotice(`已导入《${result.title || title}》`);
      } catch (err) {
        setImportErrors((current) => ({
          ...current,
          [errorKey]: formatErrorMessage(err),
        }));
      } finally {
        setImportingPaper(null);
      }
    },
    [],
  );

  useEffect(() => {
    void loadInterests();
  }, [loadInterests]);

  useEffect(() => {
    void loadBriefings();
  }, [loadBriefings]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const refreshFromBackgroundScan = useCallback(() => {
    if (!scanningState.scanning) {
      void loadBriefings();
      void loadHistory();
    }
  }, [loadBriefings, loadHistory]);

  useDomainEventRefresh("field-dynamics:scan-complete", refreshFromBackgroundScan);

  return {
    briefings,
    history,
    unreadCount,
    loading,
    historyLoading,
    scanning,
    interestId,
    setInterestId,
    importingPaper,
    importErrors,
    notice,
    setNotice,
    error,
    interests,
    loadBriefings,
    loadHistory,
    scan,
    markRead,
    importPaper,
  };
}
