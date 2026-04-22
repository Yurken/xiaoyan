import type { ChatSession, KnowledgeNote, Paper, ResearchInterest } from "@research-copilot/types";

export interface SubmissionOverviewStats {
  active: number;
  pendingReviews: number;
  upcomingDdls: { name: string; deadline: string }[];
}

export interface WorkbenchOverviewSource {
  papers: Paper[];
  interests: ResearchInterest[];
  notes: KnowledgeNote[];
  sessions: ChatSession[];
  submission: SubmissionOverviewStats;
}

export type WorkbenchTone = "blue" | "green" | "amber" | "rust";

export interface WorkbenchMetric {
  label: string;
  value: string;
  note: string;
}

export interface WorkbenchLinkAction {
  label: string;
  to: string;
}

export interface WorkbenchAgendaItem {
  id: string;
  label: string;
  title: string;
  description: string;
  tone: WorkbenchTone;
  action: WorkbenchLinkAction;
}

export interface WorkbenchInterestItem {
  id: string;
  title: string;
  stage: string;
  stageTone: WorkbenchTone;
  summary: string;
  nextStep: string;
  stats: string[];
  action: WorkbenchLinkAction;
}

export interface WorkbenchHandoffItem {
  id: string;
  label: string;
  title: string;
  description: string;
  tone: WorkbenchTone;
  action: WorkbenchLinkAction;
}

export interface WorkbenchRiskItem {
  id: string;
  label: string;
  title: string;
  description: string;
  tone: WorkbenchTone;
  action: WorkbenchLinkAction;
}

export interface WorkbenchAssetItem {
  id: string;
  label: string;
  title: string;
  description: string;
  action: WorkbenchLinkAction;
}

export interface WorkbenchOverviewModel {
  heroTitle: string;
  heroDescription: string;
  primaryAction: WorkbenchLinkAction;
  secondaryAction: WorkbenchLinkAction;
  metrics: WorkbenchMetric[];
  summaryItems: Array<{ title: string; description: string }>;
  agenda: WorkbenchAgendaItem[];
  interests: WorkbenchInterestItem[];
  handoffs: WorkbenchHandoffItem[];
  risks: WorkbenchRiskItem[];
  assets: WorkbenchAssetItem[];
}

export function toneToBadgeVariant(tone: WorkbenchTone): "info" | "success" | "warning" | "danger" {
  if (tone === "green") return "success";
  if (tone === "amber") return "warning";
  if (tone === "rust") return "danger";
  return "info";
}

export function toneStyle(tone: WorkbenchTone): { background: string; color: string } {
  if (tone === "green") {
    return { background: "rgba(52,199,89,0.14)", color: "#1A9E3F" };
  }
  if (tone === "amber") {
    return { background: "rgba(255,149,0,0.14)", color: "#C07000" };
  }
  if (tone === "rust") {
    return { background: "rgba(255,59,48,0.14)", color: "#D92B21" };
  }
  return { background: "rgba(0,122,255,0.12)", color: "#007AFF" };
}
