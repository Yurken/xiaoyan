import {
  CLAIM_STATUS_META,
  RELATION_META,
  interestDisplayName,
  truncateText,
  type KnowledgeGraphClaim,
  type KnowledgeGraphEvidenceLink,
  type KnowledgeGraphSnapshot,
  type KnowledgeGraphSourceKind,
  type KnowledgeGraphEdgeKind,
} from "./shared";
import { buildKnowledgeGraphCanvasLayout, type KnowledgeGraphCanvasNode, type KnowledgeGraphLayoutInputNode } from "./knowledgeGraphLayout";

export interface KnowledgeGraphCanvasEdge {
  id: string;
  from: string;
  to: string;
  kind: KnowledgeGraphEdgeKind;
  label?: string;
}

export interface KnowledgeGraphProvenanceItem {
  link: KnowledgeGraphEvidenceLink;
  sourceKind: KnowledgeGraphSourceKind;
  title: string;
  subtitle?: string;
  detail?: string;
}

export interface KnowledgeGraphClaimBundle {
  claim: KnowledgeGraphClaim;
  provenance: KnowledgeGraphProvenanceItem[];
  counts: Record<KnowledgeGraphSourceKind, number>;
}

export interface KnowledgeGraphTimelineEntry {
  id: string;
  year: number;
  date: string;
  kind: "interest" | "paper" | "claim" | "experiment";
  title: string;
  detail: string;
}

function toYear(date: string) {
  const yearMatch = date.match(/^(\d{4})/);
  if (yearMatch) return Number(yearMatch[1]);
  const parsed = new Date(date);
  return Number.isFinite(parsed.getTime()) ? parsed.getFullYear() : 0;
}

export function buildKnowledgeGraphView(
  snapshot: KnowledgeGraphSnapshot,
  activeInterestId: string | null,
) {
  const paperMap = new Map(snapshot.papers.map((item) => [item.id, item]));
  const noteMap = new Map(snapshot.notes.map((item) => [item.id, item]));
  const experimentMap = new Map(snapshot.experiments.map((item) => [item.id, item]));

  const visibleClaims = snapshot.claims.filter((item) =>
    activeInterestId ? item.researchInterestId === activeInterestId : true,
  );
  const visibleClaimIds = new Set(visibleClaims.map((item) => item.id));
  const visibleEvidenceLinks = snapshot.evidenceLinks.filter((item) => visibleClaimIds.has(item.claimId));

  const relevantPaperIds = new Set<string>();
  const relevantNoteIds = new Set<string>();
  const relevantExperimentIds = new Set<string>();

  visibleEvidenceLinks.forEach((item) => {
    if (item.sourceKind === "paper") relevantPaperIds.add(item.sourceId);
    if (item.sourceKind === "note") relevantNoteIds.add(item.sourceId);
    if (item.sourceKind === "experiment") relevantExperimentIds.add(item.sourceId);
  });

  const visiblePapers = snapshot.papers.filter((item) => {
    if (activeInterestId && item.researchInterestId === activeInterestId) return true;
    return relevantPaperIds.has(item.id);
  });
  const visibleNotes = snapshot.notes.filter((item) => {
    if (activeInterestId && item.researchInterestId === activeInterestId) return true;
    return relevantNoteIds.has(item.id);
  });
  const visibleExperiments = snapshot.experiments.filter((item) => {
    if (!activeInterestId) return relevantExperimentIds.size === 0 ? true : relevantExperimentIds.has(item.id);
    return relevantExperimentIds.has(item.id);
  });

  visiblePapers.forEach((item) => relevantPaperIds.add(item.id));
  visibleNotes.forEach((item) => relevantNoteIds.add(item.id));
  visibleExperiments.forEach((item) => relevantExperimentIds.add(item.id));

  const visibleInterests = activeInterestId
    ? snapshot.interests.filter((item) => item.id === activeInterestId)
    : snapshot.interests;

  const visibleCitations = snapshot.citations.filter(
    (item) => relevantPaperIds.has(item.citingPaperId) && relevantPaperIds.has(item.citedPaperId),
  );

  const nodeOrder = {
    interest: visibleInterests.map((item) => ({
      id: `interest:${item.id}`,
      entityId: item.id,
      lane: "interest" as const,
      kind: "interest" as const,
      title: interestDisplayName(item),
      subtitle: item.keywords.slice(0, 3).join(" · ") || "研究方向",
    })),
    claim: visibleClaims.map((item) => ({
      id: `claim:${item.id}`,
      entityId: item.id,
      lane: "claim" as const,
      kind: "claim" as const,
      title: item.title,
      subtitle: CLAIM_STATUS_META[item.status]?.label ?? item.status,
    })),
    evidence: [
      ...visiblePapers.map((item) => ({
        id: `paper:${item.id}`,
        entityId: item.id,
        lane: "evidence" as const,
        kind: "paper" as const,
        title: item.title,
        subtitle: [item.year, item.venue].filter(Boolean).join(" · ") || "论文",
      })),
      ...visibleExperiments.map((item) => ({
        id: `experiment:${item.id}`,
        entityId: item.id,
        lane: "evidence" as const,
        kind: "experiment" as const,
        title: item.title,
        subtitle: "实验记录",
      })),
      ...visibleNotes.map((item) => ({
        id: `note:${item.id}`,
        entityId: item.id,
        lane: "evidence" as const,
        kind: "note" as const,
        title: item.title,
        subtitle: item.sourceType === "web_clip" ? "网页摘录" : "知识笔记",
      })),
    ],
  } satisfies Record<"interest" | "claim" | "evidence", KnowledgeGraphLayoutInputNode[]>;

  const nodes = buildKnowledgeGraphCanvasLayout(nodeOrder);

  const edges: KnowledgeGraphCanvasEdge[] = [];

  visibleClaims.forEach((claim) => {
    if (claim.researchInterestId) {
      edges.push({
        id: `belongs:interest:${claim.researchInterestId}:claim:${claim.id}`,
        from: `interest:${claim.researchInterestId}`,
        to: `claim:${claim.id}`,
        kind: "belongs",
        label: "结论",
      });
    }
  });

  visiblePapers.forEach((paper) => {
    if (paper.researchInterestId) {
      edges.push({
        id: `belongs:interest:${paper.researchInterestId}:paper:${paper.id}`,
        from: `interest:${paper.researchInterestId}`,
        to: `paper:${paper.id}`,
        kind: "belongs",
        label: "论文",
      });
    }
  });

  visibleNotes.forEach((note) => {
    if (note.researchInterestId) {
      edges.push({
        id: `belongs:interest:${note.researchInterestId}:note:${note.id}`,
        from: `interest:${note.researchInterestId}`,
        to: `note:${note.id}`,
        kind: "belongs",
        label: "笔记",
      });
    }
  });

  visibleEvidenceLinks.forEach((link) => {
    edges.push({
      id: `evidence:${link.id}`,
      from: `claim:${link.claimId}`,
      to: `${link.sourceKind}:${link.sourceId}`,
      kind: "evidence",
      label: RELATION_META[link.relationKind]?.label ?? link.relationKind,
    });
  });

  visibleCitations.forEach((item) => {
    edges.push({
      id: `citation:${item.id}`,
      from: `paper:${item.citingPaperId}`,
      to: `paper:${item.citedPaperId}`,
      kind: "citation",
      label: "引用",
    });
  });

  const claimBundles: KnowledgeGraphClaimBundle[] = visibleClaims.map((claim) => {
    const provenance = visibleEvidenceLinks
      .filter((item) => item.claimId === claim.id)
      .map<KnowledgeGraphProvenanceItem | null>((item) => {
        if (item.sourceKind === "paper") {
          const paper = paperMap.get(item.sourceId);
          if (!paper) return null;
          return {
            link: item,
            sourceKind: "paper",
            title: paper.title,
            subtitle: [paper.year, paper.venue].filter(Boolean).join(" · ") || "论文",
            detail: item.evidenceSummary || truncateText(paper.keyConclusions || paper.notes || "", 120),
          };
        }
        if (item.sourceKind === "experiment") {
          const experiment = experimentMap.get(item.sourceId);
          if (!experiment) return null;
          return {
            link: item,
            sourceKind: "experiment",
            title: experiment.title,
            subtitle: "实验记录",
            detail: item.evidenceSummary || truncateText(experiment.result || experiment.notes || "", 120),
          };
        }
        const note = noteMap.get(item.sourceId);
        if (!note) return null;
        return {
          link: item,
          sourceKind: "note",
          title: note.title,
          subtitle: note.sourceType === "web_clip" ? "网页摘录" : "知识笔记",
          detail: item.evidenceSummary || truncateText(note.content, 120),
        };
      })
      .filter((item): item is KnowledgeGraphProvenanceItem => Boolean(item));

    return {
      claim,
      provenance,
      counts: {
        paper: provenance.filter((item) => item.sourceKind === "paper").length,
        experiment: provenance.filter((item) => item.sourceKind === "experiment").length,
        note: provenance.filter((item) => item.sourceKind === "note").length,
      },
    };
  });

  const timelineEntries: KnowledgeGraphTimelineEntry[] = [
    ...visibleInterests.map((item) => ({
      id: `interest:${item.id}`,
      year: toYear(item.createdAt),
      date: item.createdAt,
      kind: "interest" as const,
      title: interestDisplayName(item),
      detail: item.keywords.slice(0, 3).join(" · ") || "建立研究方向",
    })),
    ...visiblePapers.map((item) => ({
      id: `paper:${item.id}`,
      year: item.year || toYear(item.createdAt),
      date: item.year ? `${item.year}-01-01` : item.createdAt,
      kind: "paper" as const,
      title: item.title,
      detail: [item.year, item.venue].filter(Boolean).join(" · ") || "论文纳入知识库",
    })),
    ...visibleClaims.map((item) => ({
      id: `claim:${item.id}`,
      year: toYear(item.createdAt),
      date: item.createdAt,
      kind: "claim" as const,
      title: item.title,
      detail: CLAIM_STATUS_META[item.status]?.label ?? item.status,
    })),
    ...visibleExperiments.map((item) => ({
      id: `experiment:${item.id}`,
      year: toYear(item.updatedAt),
      date: item.updatedAt,
      kind: "experiment" as const,
      title: item.title,
      detail: truncateText(item.result || item.notes || "实验推进", 80),
    })),
  ]
    .filter((item) => item.year > 0)
    .sort((a, b) => (a.date > b.date ? 1 : -1))
    .slice(-24);

  return {
    visibleInterests,
    visiblePapers,
    visibleNotes,
    visibleExperiments,
    visibleClaims,
    visibleEvidenceLinks,
    visibleCitations,
    nodes,
    edges,
    claimBundles,
    timelineEntries,
  };
}
