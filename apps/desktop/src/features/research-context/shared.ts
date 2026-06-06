export interface ResearchTheme {
  id: string;
  name: string;
  lastActiveAt: string;
  completedTasks: string[];
  openQuestions: string[];
  nextSteps: Array<{ title: string; description?: string }>;
}

export type EvidenceLinkType = "paper" | "note" | "experiment" | "submission" | "checkpoint";

export interface EvidenceLink {
  id: string;
  type: EvidenceLinkType;
  title: string;
  sourceId: string;
  summary: string;
}

export interface ResearchActivityEvent {
  id: string;
  themeId: string;
  eventType: string; // e.g., "paper_read", "note_added", "experiment_created"
  title: string;
  timestamp: string;
  details?: Record<string, any>;
}

export interface ResearchContextState {
  theme: ResearchTheme | null;
  events: ResearchActivityEvent[];
  recentThemes: ResearchTheme[];
}
