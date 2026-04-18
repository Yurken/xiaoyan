import { useState } from "react";
import type { MemoryObservation, UserMemory } from "../../lib/client";
import { apiClient } from "../../lib/client";

export function useSettingsMemories() {
  const [memories, setMemories] = useState<UserMemory[]>([]);
  const [observations, setObservations] = useState<MemoryObservation[]>([]);
  const [loading, setLoading] = useState(false);
  const [clearingAuto, setClearingAuto] = useState(false);

  const enter = () => {
    setLoading(true);
    void Promise.allSettled([
      apiClient.memory.list(),
      apiClient.memory.listObservations(),
    ])
      .then(([memoryResult, observationResult]) => {
        if (memoryResult.status === "fulfilled") {
          setMemories(memoryResult.value);
        }
        if (observationResult.status === "fulfilled") {
          setObservations(observationResult.value);
        }
      })
      .finally(() => {
        setLoading(false);
      });
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
    clearingAuto,
    enter,
    deleteMemory,
    clearAuto,
  };
}
