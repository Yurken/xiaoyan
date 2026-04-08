import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { apiClient, formatErrorMessage } from "../../lib/client";
import { buildKnowledgeGraphView } from "./graphView";
import { type KnowledgeClaimStatus, type KnowledgeEvidenceRelationKind, type KnowledgeGraphSnapshot, type KnowledgeGraphSourceKind } from "./shared";

export interface KnowledgeGraphWorkspaceController {
  snapshot: KnowledgeGraphSnapshot | null;
  view: ReturnType<typeof buildKnowledgeGraphView> | null;
  loading: boolean;
  busy: boolean;
  error: string | null;
  activeInterestId: string | null;
  setActiveInterestId: Dispatch<SetStateAction<string | null>>;
  refresh: () => Promise<void>;
  createClaim: (data: {
    title: string;
    statement: string;
    researchInterestId?: string;
    status?: KnowledgeClaimStatus;
  }) => Promise<boolean>;
  deleteClaim: (id: string) => Promise<boolean>;
  createEvidence: (data: {
    claimId: string;
    sourceKind: KnowledgeGraphSourceKind;
    sourceId: string;
    relationKind?: KnowledgeEvidenceRelationKind;
    evidenceSummary?: string;
  }) => Promise<boolean>;
  deleteEvidence: (id: string) => Promise<boolean>;
  createCitation: (data: { citingPaperId: string; citedPaperId: string; context?: string }) => Promise<boolean>;
  deleteCitation: (id: string) => Promise<boolean>;
}

export function useKnowledgeGraphWorkspace(): KnowledgeGraphWorkspaceController {
  const [snapshot, setSnapshot] = useState<KnowledgeGraphSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeInterestId, setActiveInterestId] = useState<string | null>(null);

  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await apiClient.knowledge.graph.snapshot();
      setSnapshot(next);
    } catch (err) {
      setError(formatErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  useEffect(() => {
    if (!snapshot) return;
    if (activeInterestId && snapshot.interests.some((item) => item.id === activeInterestId)) return;
    setActiveInterestId(null);
  }, [activeInterestId, snapshot]);

  const mutateAndRefresh = useCallback(
    async (task: () => Promise<unknown>) => {
      setBusy(true);
      setError(null);
      try {
        await task();
        await loadSnapshot();
        return true;
      } catch (err) {
        setError(formatErrorMessage(err));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [loadSnapshot],
  );

  const createClaim = useCallback(
    (data: {
      title: string;
      statement: string;
      researchInterestId?: string;
      status?: KnowledgeClaimStatus;
    }) =>
      mutateAndRefresh(() => apiClient.knowledge.graph.createClaim(data)),
    [mutateAndRefresh],
  );

  const deleteClaim = useCallback(
    (id: string) => mutateAndRefresh(() => apiClient.knowledge.graph.deleteClaim(id)),
    [mutateAndRefresh],
  );

  const createEvidence = useCallback(
    (data: {
      claimId: string;
      sourceKind: KnowledgeGraphSourceKind;
      sourceId: string;
      relationKind?: KnowledgeEvidenceRelationKind;
      evidenceSummary?: string;
    }) =>
      mutateAndRefresh(() => apiClient.knowledge.graph.createEvidence(data)),
    [mutateAndRefresh],
  );

  const deleteEvidence = useCallback(
    (id: string) => mutateAndRefresh(() => apiClient.knowledge.graph.deleteEvidence(id)),
    [mutateAndRefresh],
  );

  const createCitation = useCallback(
    (data: { citingPaperId: string; citedPaperId: string; context?: string }) =>
      mutateAndRefresh(() => apiClient.knowledge.graph.createCitation(data)),
    [mutateAndRefresh],
  );

  const deleteCitation = useCallback(
    (id: string) => mutateAndRefresh(() => apiClient.knowledge.graph.deleteCitation(id)),
    [mutateAndRefresh],
  );

  const view = useMemo(
    () => (snapshot ? buildKnowledgeGraphView(snapshot, activeInterestId) : null),
    [activeInterestId, snapshot],
  );

  return {
    snapshot,
    view,
    loading,
    busy,
    error,
    activeInterestId,
    setActiveInterestId,
    refresh: loadSnapshot,
    createClaim,
    deleteClaim,
    createEvidence,
    deleteEvidence,
    createCitation,
    deleteCitation,
  };
}
