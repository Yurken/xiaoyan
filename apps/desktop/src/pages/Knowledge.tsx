import { useEffect, useMemo } from "react";
import { clsx } from "clsx";
import { CapsuleTabs, Select } from "@research-copilot/ui";
import KnowledgeGraphWorkspace from "../features/knowledge/KnowledgeGraphWorkspace";
import { buildInterestSelectOptions, buildNoteClaimCountMap } from "../features/knowledge/shared";
import { useKnowledgeGraphWorkspace } from "../features/knowledge/useKnowledgeGraphWorkspace";
import NotesPanel from "../features/knowledge/NotesPanel";
import WikiWorkspace from "../features/wiki/WikiWorkspace";
import { useDomainEventRefresh } from "../hooks/useDomainEventRefresh";
import { usePersistentStringState } from "../hooks/usePersistentStringState";

type KnowledgeView = "graph" | "notes" | "wiki";
const KNOWLEDGE_VIEWS: readonly KnowledgeView[] = ["graph", "notes", "wiki"];
const KNOWLEDGE_VIEW_TABS = [
  { value: "graph", label: "知识图谱" },
  { value: "notes", label: "知识笔记" },
  { value: "wiki", label: "研究 Wiki" },
] as const;

export default function Knowledge({
  hideFolders = false,
  researchInterestId,
}: {
  hideFolders?: boolean;
  researchInterestId?: string;
}) {
  const [view, setView] = usePersistentStringState<KnowledgeView>(
    "rc:knowledge:view",
    "graph",
    KNOWLEDGE_VIEWS,
  );
  const graphController = useKnowledgeGraphWorkspace();
  const { setActiveInterestId } = graphController;
  useDomainEventRefresh("knowledge:note_created", () => { graphController.refresh(); });

  useEffect(() => {
    if (researchInterestId) {
      setActiveInterestId(researchInterestId);
    }
  }, [setActiveInterestId, researchInterestId]);
  const interestOptions = useMemo(
    () => buildInterestSelectOptions(graphController.snapshot?.interests ?? []),
    [graphController.snapshot?.interests],
  );
  const initialInterests = useMemo(
    () => {
      if (!graphController.snapshot) return undefined;
      return graphController.snapshot.interests.map((item) => ({
        id: item.id,
        topic: item.topic,
        folder_name: item.folderName ?? undefined,
        keywords: item.keywords,
        status: item.status,
        created_at: item.createdAt,
      }));
    },
    [graphController.snapshot],
  );
  const initialNotes = useMemo(
    () => {
      if (!graphController.snapshot) return undefined;
      return graphController.snapshot.notes.map((item) => ({
        id: item.id,
        title: item.title,
        content: item.content,
        source_type: item.sourceType,
        source_id: item.sourceId ?? undefined,
        tags: item.tags,
        research_interest_id: item.researchInterestId ?? undefined,
        created_at: item.createdAt,
        updated_at: item.updatedAt,
      }));
    },
    [graphController.snapshot],
  );
  const linkedNoteClaimCounts = useMemo(
    () => {
      if (!graphController.snapshot) return undefined;
      return buildNoteClaimCountMap(
        graphController.view?.visibleEvidenceLinks ?? graphController.snapshot.evidenceLinks,
      );
    },
    [graphController.snapshot, graphController.view?.visibleEvidenceLinks],
  );

  return (
    <div className={clsx("rc-app-page flex h-full min-w-0 flex-col", hideFolders && "rc-knowledge-focus-page")}>
      <div className="min-w-0 space-y-4">
        {/* {!hideFolders ? (
          <header>
            <h1 className="text-2xl font-semibold tracking-[-0.025em]" style={{ color: "var(--rc-text)" }}>知识库</h1>
            <p className="mt-1 text-sm" style={{ color: "var(--rc-text-muted)" }}>不只是记笔记：把材料沉淀为可追溯、可连接、可审阅的研究知识。</p>
          </header>
        ) : null} */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <CapsuleTabs
            options={KNOWLEDGE_VIEW_TABS}
            value={view}
            onChange={(nextView) => setView(nextView as KnowledgeView)}
          />

          {(view === "notes" || view === "wiki") && graphController.snapshot && !researchInterestId ? (
            <Select
              className="w-full lg:w-[260px]"
              prefix="聚焦："
              value={graphController.activeInterestId ?? ""}
              onChange={(value) => graphController.setActiveInterestId(value || null)}
              options={interestOptions}
              placeholder="全部研究主题"
            />
          ) : null}
        </div>
      </div>

      <div key={view} className="mt-3 min-w-0" style={{ animation: "rc-view-enter 0.28s ease-out" }}>
        {view === "graph" ? (
          <KnowledgeGraphWorkspace
            controller={graphController}
            hideFocusControls={Boolean(researchInterestId)}
          />
        ) : view === "notes" ? (
          <NotesPanel
            hideFolders={hideFolders}
            researchInterestId={researchInterestId ?? graphController.activeInterestId ?? undefined}
            initialNotes={initialNotes}
            initialInterests={initialInterests}
            linkedNoteClaimCounts={linkedNoteClaimCounts}
            onNotesChanged={() => graphController.refresh()}
          />
        ) : (
          <WikiWorkspace
            interestId={researchInterestId ?? graphController.activeInterestId ?? undefined}
          />
        )}
      </div>
    </div>
  );
}
