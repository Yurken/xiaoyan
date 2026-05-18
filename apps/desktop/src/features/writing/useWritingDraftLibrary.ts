import { useCallback, useEffect, useMemo, useState } from "react";
import { apiClient, formatErrorMessage } from "../../lib/client";
import {
  DEFAULT_PROJECT_NAME,
  WRITING_ACTIVE_DRAFT_KEY,
  WRITING_LIBRARY_STORAGE_KEY,
  WRITING_STORAGE_KEY,
  type LatexTemplate,
  type WritingCreateDraftOptions,
  type WritingDraft,
  type WritingImageAsset,
  type WritingResearchInterestSummary,
  type WritingTemplateId,
  writingResearchInterestTitle,
} from "./shared";
import { getDefaultWritingTemplate, getWritingTemplate } from "./templates";

interface PersistedWritingState {
  projectName?: string;
  templateId?: WritingTemplateId;
  mainTex?: string;
  bibtex?: string;
  notes?: string;
}

interface PersistedWritingLibrary {
  drafts?: unknown[];
}

type WritingDraftPatch = Partial<
  Pick<WritingDraft, "projectName" | "researchInterestId" | "templateId" | "mainTex" | "bibtex" | "notes" | "imageAssets">
>;

interface LoadedDraftLibrary {
  drafts: WritingDraft[];
  activeDraftId: string;
}

export function useWritingDraftLibrary() {
  const initialLibrary = useMemo(loadDraftLibrary, []);
  const [drafts, setDrafts] = useState<WritingDraft[]>(initialLibrary.drafts);
  const [activeDraftId, setActiveDraftId] = useState(initialLibrary.activeDraftId);
  const [interests, setInterests] = useState<WritingResearchInterestSummary[]>([]);
  const [loadingInterests, setLoadingInterests] = useState(true);
  const [interestError, setInterestError] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const activeDraft = useMemo(
    () => drafts.find((draft) => draft.id === activeDraftId) ?? drafts[0],
    [activeDraftId, drafts],
  );

  useEffect(() => {
    if (activeDraft) return;
    const draft = createDraftFromTemplate(getDefaultWritingTemplate());
    setDrafts([draft]);
    setActiveDraftId(draft.id);
  }, [activeDraft]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      localStorage.setItem(WRITING_LIBRARY_STORAGE_KEY, JSON.stringify({ drafts }));
      localStorage.setItem(WRITING_ACTIVE_DRAFT_KEY, activeDraftId);
      setLastSavedAt(new Date());
    }, 350);
    return () => window.clearTimeout(timer);
  }, [activeDraftId, drafts]);

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
        setInterestError(isMissingTauriRuntime(error) ? "" : formatErrorMessage(error));
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
    const nextDrafts = drafts.filter((draft) => draft.id !== id);
    if (nextDrafts.length === drafts.length) return false;

    setDrafts(nextDrafts);
    if (id === activeDraftId) {
      setActiveDraftId(nextDrafts[0].id);
    }
    return true;
  }, [activeDraftId, drafts]);

  return {
    drafts,
    activeDraft,
    activeDraftId,
    interests,
    loadingInterests,
    interestError,
    lastSavedAt,
    setActiveDraftId,
    updateActiveDraft,
    createDraft,
    deleteDraft,
  };
}

function loadDraftLibrary(): LoadedDraftLibrary {
  const fallbackDraft = createDraftFromTemplate(getDefaultWritingTemplate());

  try {
    const raw = localStorage.getItem(WRITING_LIBRARY_STORAGE_KEY);
    const activeDraftId = localStorage.getItem(WRITING_ACTIVE_DRAFT_KEY) || "";
    if (raw) {
      const parsed = JSON.parse(raw) as PersistedWritingLibrary | unknown[];
      const source = Array.isArray(parsed) ? parsed : parsed.drafts;
      const drafts = Array.isArray(source)
        ? source.map(normalizePersistedDraft).filter((draft): draft is WritingDraft => Boolean(draft))
        : [];
      if (drafts.length > 0) {
        return {
          drafts,
          activeDraftId: drafts.some((draft) => draft.id === activeDraftId) ? activeDraftId : drafts[0].id,
        };
      }
    }

    const migratedDraft = loadLegacyDraft();
    if (migratedDraft) {
      return { drafts: [migratedDraft], activeDraftId: migratedDraft.id };
    }
  } catch {
    return { drafts: [fallbackDraft], activeDraftId: fallbackDraft.id };
  }

  return { drafts: [fallbackDraft], activeDraftId: fallbackDraft.id };
}

function loadLegacyDraft(): WritingDraft | null {
  try {
    const raw = localStorage.getItem(WRITING_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedWritingState;
    const template = parsed.templateId ? getWritingTemplate(parsed.templateId) : getDefaultWritingTemplate();
    return createDraftFromTemplate(template, {
      projectName: parsed.projectName || DEFAULT_PROJECT_NAME,
      templateId: template.id,
      mainTex: parsed.mainTex || template.mainTex,
      bibtex: parsed.bibtex ?? template.bibtex,
      notes: parsed.notes ?? "",
    });
  } catch {
    return null;
  }
}

function normalizePersistedDraft(value: unknown): WritingDraft | null {
  if (!isRecord(value)) return null;
  const templateId = isWritingTemplateId(value.templateId) ? value.templateId : getDefaultWritingTemplate().id;
  const template = getWritingTemplate(templateId);
  const id = stringValue(value.id) || createDraftId();
  const projectName = stringValue(value.projectName) || DEFAULT_PROJECT_NAME;
  const researchInterestId = stringValue(value.researchInterestId) || undefined;
  const createdAt = stringValue(value.createdAt) || new Date().toISOString();
  const updatedAt = stringValue(value.updatedAt) || createdAt;

  return {
    id,
    projectName,
    researchInterestId,
    templateId,
    mainTex: typeof value.mainTex === "string" ? value.mainTex : template.mainTex,
    bibtex: typeof value.bibtex === "string" ? value.bibtex : template.bibtex,
    notes: typeof value.notes === "string" ? value.notes : "",
    imageAssets: normalizePersistedImageAssets(value.imageAssets),
    createdAt,
    updatedAt,
  };
}

function createDraftFromTemplate(
  template: LatexTemplate,
  overrides: WritingDraftPatch & Partial<Pick<WritingDraft, "createdAt" | "updatedAt">> = {},
): WritingDraft {
  const now = new Date().toISOString();
  return {
    id: createDraftId(),
    projectName: overrides.projectName || DEFAULT_PROJECT_NAME,
    researchInterestId: overrides.researchInterestId || undefined,
    templateId: overrides.templateId ?? template.id,
    mainTex: overrides.mainTex ?? template.mainTex,
    bibtex: overrides.bibtex ?? template.bibtex,
    notes: overrides.notes ?? "",
    imageAssets: overrides.imageAssets ?? [],
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

function normalizeDraftPatch(patch: WritingDraftPatch): WritingDraftPatch {
  if (!("researchInterestId" in patch)) return patch;
  return { ...patch, researchInterestId: patch.researchInterestId || undefined };
}

function createDraftId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isWritingTemplateId(value: unknown): value is WritingTemplateId {
  return value === "journal" || value === "conference" || value === "thesis-note";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizePersistedImageAssets(value: unknown): WritingImageAsset[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(normalizePersistedImageAsset)
    .filter((asset): asset is WritingImageAsset => Boolean(asset));
}

function normalizePersistedImageAsset(value: unknown): WritingImageAsset | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id);
  const fileName = stringValue(value.fileName);
  const projectPath = stringValue(value.projectPath);
  const storedPath = stringValue(value.storedPath);
  const createdAt = stringValue(value.createdAt) || new Date().toISOString();

  if (!id || !fileName || !projectPath || !storedPath) return null;
  return { id, fileName, projectPath, storedPath, createdAt };
}

function isMissingTauriRuntime(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.includes("reading 'invoke'") || message.includes("__TAURI_INTERNALS__");
}
