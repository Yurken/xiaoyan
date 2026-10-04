import { useCallback, useEffect, useMemo, useState } from "react";
import { apiClient, formatErrorMessage } from "../../lib/client";
import {
  WRITING_ACTIVE_DRAFT_KEY,
  type WritingCreateDraftOptions,
  type WritingDraft,
  type WritingDraftPatch,
  type WritingResearchInterestSummary,
  writingResearchInterestTitle,
  isMissingWritingRuntime,
  recoverWritingPendingDrafts,
  type WritingRecoverySummary,
} from "./shared";
import { enqueueWritingDraftOperation, useWritingDraftPersistence } from "./useWritingDraftPersistence";
import { createDraftFromTemplate } from "./draftFactory";
import {
  isLegacyMigrationPending,
  loadLocalDraftLibrary,
  markLegacyMigrationDone,
  migrateLegacyDrafts,
  readLegacyDraftsForMigration,
  type WritingDraftMigrationSummary,
} from "./legacyDraftLibrary";
import { getDefaultWritingTemplate, getWritingTemplate } from "./templates";

/**
 * 写作草稿库：SQLite 保存已确认资产，localStorage 存活跃 ID 与尚未落库稿件的恢复日志。
 * 非 Tauri 环境降级为旧 localStorage 读写；真实后端异常保持可见并允许重试。
 * 启动时检测旧 localStorage 草稿库并做一次性导入（成功后写迁移标记，不删旧数据）。
 */
export function useWritingDraftLibrary() {
  const [drafts, setDrafts] = useState<WritingDraft[]>([]);
  const [activeDraftId, setActiveDraftId] = useState("");
  const [libraryReady, setLibraryReady] = useState(false);
  const [libraryError, setLibraryError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [migrationSummary, setMigrationSummary] = useState<WritingDraftMigrationSummary | null>(null);
  const [recoverySummary, setRecoverySummary] = useState<WritingRecoverySummary>({ restored: 0, conflicts: 0 });
  const [interests, setInterests] = useState<WritingResearchInterestSummary[]>([]);
  const [loadingInterests, setLoadingInterests] = useState(true);
  const [interestError, setInterestError] = useState("");
  const persistence = useWritingDraftPersistence({ drafts, activeDraftId, libraryReady });
  const { initializePersistence, removeDraft, loadPendingDrafts } = persistence;

  const fallbackDraft = useMemo(() => createDraftFromTemplate(getDefaultWritingTemplate()), []);
  const activeDraft = drafts.find((draft) => draft.id === activeDraftId) ?? drafts[0] ?? fallbackDraft;

  useEffect(() => {
    let cancelled = false;

    const applyLibrary = (nextDrafts: WritingDraft[], nextActiveDraftId: string, backendMode: boolean, persistedDrafts = nextDrafts) => {
      initializePersistence(persistedDrafts, backendMode, nextDrafts);
      setDrafts(nextDrafts);
      setActiveDraftId(nextActiveDraftId);
      setLibraryReady(true);
      setLibraryError("");
    };

    const bootstrap = async () => {
      try {
        let list = await apiClient.writing.listDrafts();
        if (cancelled) return;

        // 一次性迁移：旧 localStorage 草稿库导入后端（保留原 id 与时间戳）。
        if (isLegacyMigrationPending()) {
          const legacyDrafts = readLegacyDraftsForMigration();
          const summary = await migrateLegacyDrafts({
            drafts: legacyDrafts,
            existingIds: new Set(list.map((draft) => draft.id)),
            importDraft: async (draft) => {
              await apiClient.writing.createDraft(draft);
            },
          });
          if (summary.failed === 0) {
            markLegacyMigrationDone(summary);
          } else {
            // 失败条目下次启动重试（同 id 已导入的会被跳过）。
            console.warn("[writing] 旧草稿迁移存在失败条目：", summary.errors);
          }
          if (!cancelled) setMigrationSummary(summary);
          if (summary.imported > 0) {
            list = await apiClient.writing.listDrafts();
          }
        }

        let recovered = recoverWritingPendingDrafts(list, loadPendingDrafts());
        if (recovered.drafts.length === 0) {
          const draft = createDraftFromTemplate(getDefaultWritingTemplate());
          await apiClient.writing.createDraft(draft);
          list = [draft];
          recovered = recoverWritingPendingDrafts(list, []);
        }

        if (cancelled) return;
        setRecoverySummary(recovered.summary);
        let savedActiveId = "";
        try { savedActiveId = localStorage.getItem(WRITING_ACTIVE_DRAFT_KEY) || ""; } catch { /* UI 偏好可缺失。 */ }
        applyLibrary(
          recovered.drafts,
          recovered.recoveredDraftId || (recovered.drafts.some((draft) => draft.id === savedActiveId) ? savedActiveId : recovered.drafts[0].id),
          true,
          list,
        );
      } catch (error) {
        if (cancelled) return;
        if (!isMissingWritingRuntime(error)) {
          setLibraryError(formatErrorMessage(error));
          return;
        }
        // 降级：沿用旧 localStorage 数据源（含 Web / 测试环境）。
        const loaded = loadLocalDraftLibrary();
        applyLibrary(loaded.drafts, loaded.activeDraftId, false);
      }
    };

    // 切页前的 create/update/delete 尚未完成时先等待确认，再读库恢复，避免重复创建同一 ID。
    void enqueueWritingDraftOperation(bootstrap);
    return () => {
      cancelled = true;
    };
  }, [initializePersistence, loadAttempt, loadPendingDrafts]);

  useEffect(() => {
    let cancelled = false;
    setLoadingInterests(true);

    apiClient.knowledge.listInterests()
      .then((data) => {
        if (cancelled) return;
        setInterests(data.map(({ id, topic, folder_name }) => ({ id, topic, folder_name })));
        setInterestError("");
      })
      .catch((error) => {
        if (cancelled) return;
        setInterestError(isMissingWritingRuntime(error) ? "" : formatErrorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setLoadingInterests(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const updateActiveDraft = useCallback((patch: WritingDraftPatch) => {
    setDrafts((currentDrafts) => currentDrafts.map((draft) => (
      draft.id === activeDraftId
        ? { ...draft, ...normalizeDraftPatch(patch), updatedAt: new Date().toISOString() }
        : draft
    )));
  }, [activeDraftId]);

  const createDraft = useCallback((options: WritingCreateDraftOptions = {}) => {
    const targetInterestId = options.researchInterestId || undefined;
    const targetTemplate = options.templateId ? getWritingTemplate(options.templateId) : getDefaultWritingTemplate();
    const targetInterest = interests.find((interest) => interest.id === targetInterestId);
    const siblingCount = drafts.filter((draft) => (draft.researchInterestId ?? "") === (targetInterestId ?? "")).length;
    const projectName = targetInterest
      ? `${writingResearchInterestTitle(targetInterest)} · 文稿 ${siblingCount + 1}`
      : `未归档文稿 ${siblingCount + 1}`;
    const draft = createDraftFromTemplate(targetTemplate, {
      projectName,
      researchInterestId: targetInterestId,
      templateId: targetTemplate.id,
    });

    setDrafts((currentDrafts) => [draft, ...currentDrafts]);
    setActiveDraftId(draft.id);
    return draft;
  }, [drafts, interests]);

  const deleteDraft = useCallback((id: string) => {
    if (drafts.length <= 1) return false;
    const deletedDraft = drafts.find((draft) => draft.id === id);
    if (!deletedDraft) return false;
    const nextDrafts = drafts.filter((draft) => draft.id !== id);

    setDrafts(nextDrafts);
    if (id === activeDraftId) {
      setActiveDraftId(nextDrafts[0].id);
    }
    void removeDraft(id).then((removed) => {
      if (!removed) {
        setDrafts((currentDrafts) => currentDrafts.some((draft) => draft.id === id)
          ? currentDrafts : [...currentDrafts, deletedDraft]);
        if (id === activeDraftId) {
          setActiveDraftId((currentId) => currentId === nextDrafts[0].id ? id : currentId);
        }
      }
    });
    return true;
  }, [activeDraftId, drafts, removeDraft]);

  return {
    drafts,
    activeDraft,
    activeDraftId,
    interests,
    loadingInterests,
    interestError,
    libraryReady,
    libraryError: libraryError || persistence.persistenceError,
    migrationSummary,
    recoverySummary,
    lastSavedAt: persistence.lastSavedAt,
    saveStatus: persistence.saveStatus,
    retrySave: persistence.retrySave,
    retryLoad: () => { setLibraryError(""); setLoadAttempt((current) => current + 1); },
    setActiveDraftId,
    updateActiveDraft,
    createDraft,
    deleteDraft,
  };
}

function normalizeDraftPatch(patch: WritingDraftPatch): WritingDraftPatch {
  if (!("researchInterestId" in patch)) return patch;
  return { ...patch, researchInterestId: patch.researchInterestId || undefined };
}
