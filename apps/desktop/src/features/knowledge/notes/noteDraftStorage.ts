import { isNoteDraft, type StoredNoteDraft } from "./shared";

// Failed writes survive navigation in this window, but never count as durable saves.
const volatileDrafts = new Map<string, StoredNoteDraft | null>();
const cleanupSources = new Map<string, string>();

export function getNoteDraftCleanupKey(key: string): string | null {
  const sourceKey = cleanupSources.get(key) ?? key;
  return volatileDrafts.has(sourceKey) && volatileDrafts.get(sourceKey) === null ? sourceKey : null;
}

export function linkNoteDraftCleanup(targetKey: string, sourceKey: string) {
  cleanupSources.set(targetKey, sourceKey);
}

export function readNoteDraft(key: string): { draft: StoredNoteDraft | null; persisted: boolean; cleanupPending?: boolean } {
  const fallback = volatileDrafts.get(key);
  if (volatileDrafts.has(key)) return { draft: fallback ?? null, persisted: false, cleanupPending: fallback === null };
  try {
    const raw = window.localStorage.getItem(key);
    const value: unknown = raw ? JSON.parse(raw) : null;
    return { draft: isNoteDraft(value) ? value : null, persisted: true };
  } catch {
    return { draft: null, persisted: false };
  }
}

export function writeNoteDraft(key: string, draft: StoredNoteDraft): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(draft));
    volatileDrafts.delete(key);
    return true;
  } catch {
    volatileDrafts.set(key, draft);
    return false;
  }
}

export function ownsNoteDraft(key: string, token: string): boolean {
  return readNoteDraft(key).draft?.token === token;
}

export function removeNoteDraft(key: string, token?: string): boolean {
  const pendingRemoval = volatileDrafts.has(key) && volatileDrafts.get(key) === null;
  if (token && !pendingRemoval && !ownsNoteDraft(key, token)) return true;
  try {
    window.localStorage.removeItem(key);
    volatileDrafts.delete(key);
    for (const [target, source] of cleanupSources) {
      if (source === key) cleanupSources.delete(target);
    }
    return true;
  } catch {
    // Suppress the abandoned draft for this window even when disk cleanup fails.
    volatileDrafts.set(key, null);
    return false;
  }
}
