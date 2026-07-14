import { useCallback, useEffect } from "react";
import { readPersistentValue, usePersistentState } from "../../hooks/usePersistentStringState";

const WORKING_DIRECTORIES_KEY = "rc:experiment:code:working-dirs";

function readLegacyDirectory(key: string): string | null | undefined {
  const raw = readPersistentValue(key);
  if (raw === null) return undefined;
  try {
    const value = JSON.parse(raw) as unknown;
    return typeof value === "string" || value === null ? value : undefined;
  } catch {
    return raw || undefined;
  }
}

export function useExperimentWorkingDirectory(
  experimentId: string | null,
  defaultWorkingDir: string | null,
) {
  const [directories, setDirectories] = usePersistentState<Record<string, string | null>>(
    WORKING_DIRECTORIES_KEY,
    {},
  );

  const hasStoredDirectory = experimentId
    ? Object.prototype.hasOwnProperty.call(directories, experimentId)
    : false;
  const workingDir = experimentId && hasStoredDirectory
    ? directories[experimentId] ?? null
    : defaultWorkingDir;

  useEffect(() => {
    if (!experimentId || hasStoredDirectory) return;
    const legacy = readLegacyDirectory(`rc:experiment:${experimentId}:code:working-dir`)
      ?? readLegacyDirectory("rc:experiment:code:working-dir")
      ?? defaultWorkingDir;
    if (legacy !== undefined) {
      setDirectories((current) => ({ ...current, [experimentId]: legacy ?? null }));
    }
  }, [defaultWorkingDir, experimentId, hasStoredDirectory, setDirectories]);

  const setWorkingDir = useCallback((directory: string | null) => {
    if (!experimentId) return;
    setDirectories((current) => ({ ...current, [experimentId]: directory }));
  }, [experimentId, setDirectories]);

  return [workingDir, setWorkingDir] as const;
}
