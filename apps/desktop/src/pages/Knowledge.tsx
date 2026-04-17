import { useMemo, useState } from "react";
import { Select } from "@research-copilot/ui";
import KnowledgeGraphWorkspace from "../features/knowledge/KnowledgeGraphWorkspace";
import { buildNoteClaimCountMap, interestDisplayName } from "../features/knowledge/shared";
import { useKnowledgeGraphWorkspace } from "../features/knowledge/useKnowledgeGraphWorkspace";
import NotesPanel from "../features/knowledge/NotesPanel";

type KnowledgeView = "graph" | "notes";

export default function Knowledge({ hideFolders = false }: { hideFolders?: boolean }) {
  const [view, setView] = useState<KnowledgeView>("graph");
  const graphController = useKnowledgeGraphWorkspace();
  const interestOptions = useMemo(
    () => [
      { value: "", label: "全部研究方向" },
      ...(graphController.snapshot?.interests ?? []).map((item) => ({
        value: item.id,
        label: interestDisplayName(item),
      })),
    ],
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
    [graphController.snapshot?.evidenceLinks, graphController.view?.visibleEvidenceLinks],
  );

  return (
    <div className="rc-app-page h-full flex flex-col" style={{ background: "var(--rc-surface)" }}>
      <div className="space-y-4">
        <div className="shrink-0">
          <h1 className="text-2xl font-bold text-ink-primary">知识库</h1>
          <p className="mt-1 text-sm text-ink-tertiary">
            不只是存笔记。把论文、观点、证据和实验组织成可追溯知识图谱，随时回答“这个结论从哪里来”。
          </p>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div
            className="inline-flex rounded-2xl border p-1"
            style={{ borderColor: "var(--rc-border)", background: "var(--rc-panel-bg-soft, rgba(255,255,255,0.52))" }}
          >
            {([
              { key: "graph", label: "知识图谱" },
              { key: "notes", label: "知识笔记" },
            ] as const).map((item) => {
              const active = view === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setView(item.key)}
                  className="rounded-xl px-4 py-2 text-sm font-medium transition-all duration-150"
                  style={active
                    ? {
                        background: "var(--rc-button-secondary-bg)",
                        boxShadow: "var(--rc-button-secondary-shadow)",
                        color: "var(--rc-text)",
                      }
                    : {
                        color: "var(--rc-text-muted)",
                      }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          {graphController.snapshot ? (
            <Select
              className="w-full lg:w-[260px]"
              prefix="聚焦："
              value={graphController.activeInterestId ?? ""}
              onChange={(value) => graphController.setActiveInterestId(value || null)}
              options={interestOptions}
              placeholder="全部研究方向"
            />
          ) : null}
        </div>
      </div>

      {view === "graph" ? (
        <KnowledgeGraphWorkspace controller={graphController} />
      ) : (
        <NotesPanel
          hideFolders={hideFolders}
          researchInterestId={graphController.activeInterestId ?? undefined}
          initialNotes={initialNotes}
          initialInterests={initialInterests}
          linkedNoteClaimCounts={linkedNoteClaimCounts}
          onNotesChanged={() => graphController.refresh()}
        />
      )}
    </div>
  );
}
