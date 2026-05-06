import { useCallback, useEffect, useState } from "react";
import type { MemoryObservation, UserMemory } from "../../lib/client";
import { apiClient, formatErrorMessage } from "../../lib/client";
import { useMemoryPrivacyGate } from "./useMemoryPrivacyGate";

export function useSettingsMemories() {
  const [memories, setMemories] = useState<UserMemory[]>([]);
  const [observations, setObservations] = useState<MemoryObservation[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [clearingAuto, setClearingAuto] = useState(false);
  const [entered, setEntered] = useState(false);
  const privacy = useMemoryPrivacyGate();

  const loadMemories = useCallback(() => {
    setLoading(true);
    setLoadError("");

    const detailsPassword = privacy.enabled ? privacy.accessPassword : undefined;
    const canLoadDetails = !privacy.loading && (!privacy.enabled || privacy.unlocked);
    void (async () => {
      const manualRecords = await apiClient.memory.listManualRecords();
      if (!canLoadDetails) {
        return { manualRecords, autoRecords: [] as UserMemory[], privateObservations: [] as MemoryObservation[] };
      }

      const [autoRecords, privateObservations] = await Promise.all([
        apiClient.memory.listAutoRecords({ password: detailsPassword }),
        apiClient.memory.listPrivateObservations({ password: detailsPassword }),
      ]);
      return { manualRecords, autoRecords, privateObservations };
    })()
      .then(({ manualRecords, autoRecords, privateObservations }) => {
        setMemories([...manualRecords, ...autoRecords]);
        setObservations(privateObservations);
      })
      .catch((error) => {
        setLoadError(formatErrorMessage(error));
        if (!canLoadDetails) {
          setMemories((current) => current.filter((memory) => memory.type === "manual"));
          setObservations([]);
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [privacy.accessPassword, privacy.enabled, privacy.loading, privacy.unlocked]);

  useEffect(() => {
    if (!entered) return;
    loadMemories();
  }, [entered, loadMemories]);

  const enter = () => {
    if (entered) {
      loadMemories();
      return;
    }
    setEntered(true);
  };

  const deleteMemory = (id: string) => {
    void apiClient.memory.delete(id).then(() => {
      setMemories((prev) => prev.filter((memory) => memory.id !== id));
    });
  };

  const clearAuto = () => {
    setClearingAuto(true);
    void apiClient.memory.clearAuto().then(() => {
      setMemories((prev) => prev.filter((memory) => memory.type !== "auto"));
    }).finally(() => {
      setClearingAuto(false);
    });
  };

  return {
    memories,
    observations,
    loading,
    loadError,
    clearingAuto,
    privacy,
    enter,
    deleteMemory,
    clearAuto,
  };
}
