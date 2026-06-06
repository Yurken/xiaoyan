import { useState, useCallback } from "react";
import { apiClient, formatErrorMessage } from "../../lib/client";
import type { ActiveResearcherFinding } from "../../lib/client";

export function useActiveResearcher() {
  const [findings, setFindings] = useState<ActiveResearcherFinding[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [scannedInterests, setScannedInterests] = useState(0);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");

  const loadFindings = useCallback(async () => {
    try {
      const result = await apiClient.activeResearcher.findings(20);
      setFindings(result.findings);
      setUnreadCount(result.unread_count);
    } catch (err) {
      setError(formatErrorMessage(err));
    }
  }, []);

  const scan = useCallback(async (days?: number) => {
    setScanning(true);
    setError("");
    try {
      const result = await apiClient.activeResearcher.scan(days ?? 7, 10);
      setFindings(result.findings);
      setUnreadCount(result.unread_count);
      setScannedInterests(result.scanned_interests);
    } catch (err) {
      setError(formatErrorMessage(err));
    } finally {
      setScanning(false);
    }
  }, []);

  const markRead = useCallback(async (id?: string) => {
    try {
      await apiClient.activeResearcher.markRead(id);
      if (id) {
        setFindings((prev) => prev.map((f) => (f.id === id ? { ...f, is_read: true } : f)));
      } else {
        setFindings((prev) => prev.map((f) => ({ ...f, is_read: true })));
      }
      setUnreadCount(0);
    } catch {
      // silently fail
    }
  }, []);

  return { findings, unreadCount, scannedInterests, loading, scanning, error, loadFindings, scan, markRead };
}
