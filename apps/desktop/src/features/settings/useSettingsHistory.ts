import { useCallback, useEffect, useRef, useState } from "react";
import type { AppSettings, SettingsHistoryEntry } from "@research-copilot/types";
import { apiClient, formatErrorMessage } from "../../lib/client";

interface UseSettingsHistoryOptions {
  form: AppSettings;
  onApplied: (settings: AppSettings) => void;
  onMarkedSaved?: () => void;
}

export function useSettingsHistory({
  form,
  onApplied,
  onMarkedSaved,
}: UseSettingsHistoryOptions) {
  const [entries, setEntries] = useState<SettingsHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [draftName, setDraftName] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [saving, setSaving] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const beginAction = () => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    return true;
  };

  const endAction = () => {
    busyRef.current = false;
    setBusy(false);
  };

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setLoadError("");

    try {
      const data = await apiClient.settings.history.list();
      setEntries(data);
      setSelectedId((current) => {
        if (current && data.some((item) => item.id === current)) {
          return current;
        }
        return data[0]?.id ?? "";
      });
    } catch (error) {
      setLoadError(formatErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const saveCurrent = async () => {
    if (!beginAction()) return;
    setSaving(true);
    setActionError("");
    setActionMessage("");

    try {
      const entry = await apiClient.settings.history.save(form, draftName.trim() || undefined);
      setEntries((current) => [entry, ...current]);
      setDraftName("");
      setSelectedId(entry.id);
      setActionMessage(`已保存“${entry.name}”，后面可以直接切换这份配置。`);
    } catch (error) {
      setActionError(formatErrorMessage(error));
    } finally {
      setSaving(false);
      endAction();
    }
  };

  const applyHistory = async (id: string) => {
    if (!id || !beginAction()) return;

    setApplyingId(id);
    setActionError("");
    setActionMessage("");

    try {
      const next = await apiClient.settings.history.apply(id);
      onApplied(next);
      onMarkedSaved?.();
      setSelectedId(id);
      const entry = entries.find((item) => item.id === id);
      setActionMessage(entry ? `已切换到“${entry.name}”。` : "已应用所选历史配置。");
    } catch (error) {
      setActionError(formatErrorMessage(error));
    } finally {
      setApplyingId(null);
      endAction();
    }
  };

  const deleteHistory = async (id: string) => {
    if (!beginAction()) return;
    setDeletingId(id);
    setActionError("");
    setActionMessage("");

    try {
      await apiClient.settings.history.delete(id);
      const nextEntries = entries.filter((item) => item.id !== id);
      setEntries(nextEntries);
      if (selectedId === id) {
        setSelectedId(nextEntries[0]?.id ?? "");
      }
      setActionMessage("已删除这条配置历史。");
    } catch (error) {
      setActionError(formatErrorMessage(error));
    } finally {
      setDeletingId(null);
      endAction();
    }
  };

  return {
    entries,
    loading,
    loadError,
    draftName,
    selectedId,
    saving,
    applyingId,
    deletingId,
    actionError,
    actionMessage,
    busy,
    setDraftName,
    setSelectedId,
    saveCurrent,
    applyHistory,
    deleteHistory,
    reload: loadHistory,
  };
}
