import type { KnowledgeNote, ResearchInterest } from "@research-copilot/types";
import NotesWorkspace from "./notes/NotesWorkspace";

export default function NotesPanel(props: {
  hideFolders?: boolean;
  researchInterestId?: string;
  initialNotes?: KnowledgeNote[];
  initialInterests?: ResearchInterest[];
  linkedNoteClaimCounts?: Record<string, number>;
  onNotesChanged?: () => void | Promise<void>;
}) {
  return <NotesWorkspace {...props} />;
}
