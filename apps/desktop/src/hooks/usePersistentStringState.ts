import { useEffect, useState } from "react";

export function readPersistentValue(key: string): string | null {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writePersistentValue(key: string, value: string) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key, value);
  } catch {
    // localStorage can be unavailable in restricted contexts; the UI should still work.
  }
}

export function clearPersistentValue(key: string) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage failures; persistence is a convenience, not a hard dependency.
  }
}

export function usePersistentStringState<T extends string>(
  key: string,
  fallback: T,
  allowedValues: readonly T[],
) {
  const [value, setValue] = useState<T>(() => {
    const stored = readPersistentValue(key);
    return stored && allowedValues.includes(stored as T) ? (stored as T) : fallback;
  });

  useEffect(() => {
    writePersistentValue(key, value);
  }, [key, value]);

  return [value, setValue] as const;
}
