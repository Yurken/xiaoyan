import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient, formatErrorMessage } from "../../lib/client";
import {
  WRITING_ACTIVE_DRAFT_KEY,
  WRITING_LIBRARY_STORAGE_KEY,
  WRITING_PENDING_DRAFTS_KEY,
  writingDraftContentSignature,
  type WritingDraft,
  type WritingSaveStatus,
  type WritingPendingDraft,
} from "./shared";
import { normalizePersistedDraft } from "./legacyDraftLibrary";

interface WritingDraftPersistenceOptions {
  drafts: WritingDraft[];
  activeDraftId: string;
  libraryReady: boolean;
}

// 页面切换会重建 hook；旧挂载的迟到写入仍须排在新页面写入之前。
let writingPersistenceQueue: Promise<unknown> = Promise.resolve();

export function enqueueWritingDraftOperation<T>(action: () => Promise<T>): Promise<T> {
  const task = writingPersistenceQueue.then(action);
  writingPersistenceQueue = task.catch(() => undefined);
  return task;
}

/** 草稿写入按顺序执行；只有落库成功才确认内容签名，失败后仍保留最新内存稿。 */
export function useWritingDraftPersistence({ drafts, activeDraftId, libraryReady }: WritingDraftPersistenceOptions) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [writerId] = useState(() => crypto.randomUUID());
  const [, refreshSavedState] = useState(0);
  const latestDraftsRef = useRef(drafts);
  latestDraftsRef.current = drafts;
  const modeRef = useRef<"backend" | "local" | null>(null);
  const savedSignaturesRef = useRef(new Map<string, string>());
  const persistedIdsRef = useRef(new Set<string>());
  const deletingIdsRef = useRef(new Set<string>());
  const savedLocalSignatureRef = useRef("");
  const mountedRef = useRef(true);

  const loadPendingDrafts = useCallback((): WritingPendingDraft[] => {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(WRITING_PENDING_DRAFTS_KEY) ?? "[]");
      if (!Array.isArray(parsed)) return [];
      return parsed.flatMap((entry: unknown) => {
        if (!entry || typeof entry !== "object" || !("draft" in entry)) return [];
        const draft = normalizePersistedDraft(entry.draft);
        const baseSignature = "baseSignature" in entry && typeof entry.baseSignature === "string" ? entry.baseSignature : undefined;
        const writerId = "writerId" in entry && typeof entry.writerId === "string" ? entry.writerId : undefined;
        return draft ? [{ draft, baseSignature, writerId }] : [];
      });
    } catch { return []; }
  }, []);

  const writePendingDrafts = useCallback((pending: WritingPendingDraft[]) => {
    try {
      if (pending.length) localStorage.setItem(WRITING_PENDING_DRAFTS_KEY, JSON.stringify(pending));
      else localStorage.removeItem(WRITING_PENDING_DRAFTS_KEY);
    } catch { /* 正文的最终保存结果仍由 SQLite 写入确认；日志不可用时保留内存稿。 */ }
  }, []);

  const preservePendingDrafts = useCallback(() => {
    if (modeRef.current !== "backend") return;
    const pending = loadPendingDrafts();
    for (const draft of latestDraftsRef.current) {
      if (deletingIdsRef.current.has(draft.id)) continue;
      const baseSignature = savedSignaturesRef.current.get(draft.id);
      const signature = writingDraftContentSignature(draft);
      const index = pending.findIndex((entry) => entry.draft.id === draft.id);
      const existing = pending[index];
      if (baseSignature === signature) {
        // 仅清除同一已确认内容；另一挂载记录的新编辑必须保留。
        if (existing && writingDraftContentSignature(existing.draft) === signature) pending.splice(index, 1);
      } else if (!existing || existing.writerId === writerId || Date.parse(existing.draft.updatedAt) < Date.parse(draft.updatedAt)) {
        const entry = { draft, baseSignature: existing?.baseSignature ?? baseSignature, writerId };
        if (existing) pending[index] = entry;
        else pending.push(entry);
      }
    }
    writePendingDrafts(pending);
  }, [loadPendingDrafts, writePendingDrafts, writerId]);

  const initializePersistence = useCallback((loadedDrafts: WritingDraft[], backendMode: boolean, recoveredDrafts = loadedDrafts) => {
    modeRef.current = backendMode ? "backend" : "local";
    savedSignaturesRef.current = new Map(loadedDrafts.map((draft) => [draft.id, writingDraftContentSignature(draft)]));
    persistedIdsRef.current = new Set(loadedDrafts.map((draft) => draft.id));
    if (backendMode) {
      // 冲突副本使用新 ID，此处将原日志替换为恢复后的未确认稿。
      writePendingDrafts(recoveredDrafts.flatMap((draft) => {
        const baseSignature = savedSignaturesRef.current.get(draft.id);
        return baseSignature === writingDraftContentSignature(draft) ? [] : [{ draft, baseSignature, writerId }];
      }));
    }
    setError("");
  }, [writePendingDrafts, writerId]);

  const acknowledgePendingDraft = useCallback((id: string, signature: string, previousSignature?: string) => {
    const pending = loadPendingDrafts().flatMap((entry) => {
      if (entry.draft.id !== id) return [entry];
      if (writingDraftContentSignature(entry.draft) === signature) return [];
      return [{ ...entry, baseSignature: entry.baseSignature === previousSignature ? signature : entry.baseSignature }];
    });
    writePendingDrafts(pending);
  }, [loadPendingDrafts, writePendingDrafts]);

  const saveDrafts = useCallback(() => enqueueWritingDraftOperation(async () => {
    if (!modeRef.current) return false;
    if (mountedRef.current) setSaving(true);
    try {
      let wrote = false;
      if (modeRef.current === "local") {
        const signature = JSON.stringify({ drafts: latestDraftsRef.current });
        if (savedLocalSignatureRef.current !== signature) {
          localStorage.setItem(WRITING_LIBRARY_STORAGE_KEY, signature);
          savedLocalSignatureRef.current = signature;
          wrote = true;
        }
      } else {
        // 请求进行期间可能继续编辑：先等待旧写入，再取最新稿，禁止并发旧请求覆盖新稿。
        while (true) {
          const draft = latestDraftsRef.current.find((item) => (
            !deletingIdsRef.current.has(item.id)
            && savedSignaturesRef.current.get(item.id) !== writingDraftContentSignature(item)
          ));
          if (!draft) break;
          const signature = writingDraftContentSignature(draft);
          const previousSignature = savedSignaturesRef.current.get(draft.id);
          if (persistedIdsRef.current.has(draft.id)) await apiClient.writing.updateDraft(draft);
          else await apiClient.writing.createDraft(draft);
          persistedIdsRef.current.add(draft.id);
          savedSignaturesRef.current.set(draft.id, signature);
          acknowledgePendingDraft(draft.id, signature, previousSignature);
          wrote = true;
        }
      }
      if (mountedRef.current) {
        setError("");
        if (wrote) setLastSavedAt(new Date());
        refreshSavedState((current) => current + 1);
      }
      return true;
    } catch (cause) {
      if (mountedRef.current) setError(formatErrorMessage(cause));
      return false;
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }), [acknowledgePendingDraft]);

  const removeDraft = useCallback((id: string) => {
    deletingIdsRef.current.add(id);
    return enqueueWritingDraftOperation(async () => {
      try {
        if (modeRef.current === "backend" && persistedIdsRef.current.has(id)) {
          await apiClient.writing.deleteDraft(id);
        }
        persistedIdsRef.current.delete(id);
        savedSignaturesRef.current.delete(id);
        if (modeRef.current === "backend") writePendingDrafts(loadPendingDrafts().filter((entry) => entry.draft.id !== id));
        return true;
      } catch (cause) {
        if (mountedRef.current) setError(formatErrorMessage(cause));
        return false;
      } finally {
        deletingIdsRef.current.delete(id);
      }
    });
  }, [loadPendingDrafts, writePendingDrafts]);

  useEffect(() => {
    if (!libraryReady) return;
    preservePendingDrafts();
    try { localStorage.setItem(WRITING_ACTIVE_DRAFT_KEY, activeDraftId); } catch { /* UI 偏好失败不影响正文。 */ }
    const timer = window.setTimeout(() => { void saveDrafts(); }, 350);
    return () => window.clearTimeout(timer);
  }, [activeDraftId, drafts, libraryReady, preservePendingDrafts, saveDrafts]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      preservePendingDrafts();
      // 页面切走时仍写出防抖窗口内的最新稿，避免仅取消计时器而丢失最后几次编辑。
      void saveDrafts();
    };
  }, [preservePendingDrafts, saveDrafts]);

  const dirty = modeRef.current === "local"
    ? savedLocalSignatureRef.current !== JSON.stringify({ drafts })
    : drafts.some((draft) => savedSignaturesRef.current.get(draft.id) !== writingDraftContentSignature(draft));
  const saveStatus: WritingSaveStatus = error ? "error" : saving ? "saving" : dirty ? "pending" : "saved";

  return { lastSavedAt, saveStatus, persistenceError: error, initializePersistence, retrySave: saveDrafts, removeDraft, loadPendingDrafts };
}
