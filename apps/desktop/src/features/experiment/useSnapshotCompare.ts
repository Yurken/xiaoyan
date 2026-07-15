import { useEffect, useMemo, useState } from "react";
import type { ExperimentSnapshot } from "@research-copilot/types";
import {
  compareSnapshots,
  exportSnapshotAsJson,
  type CompareDimension,
  type SnapshotDiffResult,
} from "./shared";

interface UseSnapshotCompareOptions {
  snapshots: ExperimentSnapshot[];
}

export function useSnapshotCompare({ snapshots }: UseSnapshotCompareOptions) {
  const [compareLeftId, setCompareLeftId] = useState<string | null>(null);
  const [compareRightId, setCompareRightId] = useState<string | null>(null);
  const [activeDimension, setActiveDimension] = useState<CompareDimension>("config");

  const leftSnapshot = useMemo(
    () => snapshots.find((s) => s.id === compareLeftId) ?? null,
    [snapshots, compareLeftId],
  );
  const rightSnapshot = useMemo(
    () => snapshots.find((s) => s.id === compareRightId) ?? null,
    [snapshots, compareRightId],
  );

  const diffResult: SnapshotDiffResult | null = useMemo(() => {
    if (!leftSnapshot || !rightSnapshot) return null;
    return compareSnapshots(leftSnapshot, rightSnapshot);
  }, [leftSnapshot, rightSnapshot]);

  const isComparing = compareLeftId !== null && compareRightId !== null;

  useEffect(() => {
    const leftExists = compareLeftId !== null && snapshots.some((snapshot) => snapshot.id === compareLeftId);
    const rightExists = compareRightId !== null && snapshots.some((snapshot) => snapshot.id === compareRightId);
    if (compareLeftId && !leftExists) {
      setCompareLeftId(rightExists ? compareRightId : null);
      setCompareRightId(null);
    } else if (compareRightId && !rightExists) {
      setCompareRightId(null);
    }
  }, [compareLeftId, compareRightId, snapshots]);

  function startCompare(leftId: string, rightId: string) {
    if (leftId === rightId) return;
    setCompareLeftId(leftId);
    setCompareRightId(rightId);
    setActiveDimension("config");
  }

  function toggleCompare(id: string) {
    if (compareLeftId === null) {
      setCompareLeftId(id);
    } else if (compareRightId === null && id !== compareLeftId) {
      setCompareRightId(id);
    } else if (id === compareLeftId) {
      setCompareLeftId(null);
      // If right is set but left is deselected, shift right → left
      if (compareRightId !== null) {
        setCompareLeftId(compareRightId);
        setCompareRightId(null);
      }
    } else if (id === compareRightId) {
      setCompareRightId(null);
    } else {
      // Replace the older selection
      setCompareRightId(id);
    }
  }

  function clearCompare() {
    setCompareLeftId(null);
    setCompareRightId(null);
    setActiveDimension("config");
  }

  function exportLeft() {
    if (!leftSnapshot) return;
    const json = exportSnapshotAsJson(leftSnapshot);
    triggerDownload(json, `${leftSnapshot.title || "snapshot"}.json`);
  }

  function exportRight() {
    if (!rightSnapshot) return;
    const json = exportSnapshotAsJson(rightSnapshot);
    triggerDownload(json, `${rightSnapshot.title || "snapshot"}.json`);
  }

  return {
    compareLeftId,
    compareRightId,
    leftSnapshot,
    rightSnapshot,
    diffResult,
    isComparing,
    activeDimension,
    setActiveDimension,
    startCompare,
    toggleCompare,
    clearCompare,
    exportLeft,
    exportRight,
  };
}

function triggerDownload(content: string, filename: string) {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
