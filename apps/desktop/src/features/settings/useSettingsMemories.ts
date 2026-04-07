import { useState } from "react";
import type { UserMemory } from "../../lib/client";
import { apiClient } from "../../lib/client";

export function useSettingsMemories() {
  const [memories, setMemories] = useState<UserMemory[]>([]);
  const [loading, setLoading] = useState(false);
  const [clearingAuto, setClearingAuto] = useState(false);

  const enter = () => {
    setLoading(true);
    apiClient.memory.list().then((data) => {
      setMemories(data);
    }).catch(() => {
    }).finally(() => {
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
    loading,
    clearingAuto,
    enter,
    deleteMemory,
    clearAuto,
  };
}
