export type WritingExportTarget = "texstudio" | "overleaf";
export type WritingViewMode = "split" | "editor" | "preview";
export type WritingTemplateId = "journal" | "conference" | "thesis-note";
export type LatexDiagnosticSeverity = "error" | "warning" | "info";
export type WritingCompileStatus = "idle" | "compiling" | "ready" | "failed";

export interface LatexTemplate {
  id: WritingTemplateId;
  title: string;
  description: string;
  mainTex: string;
  bibtex: string;
}

export interface LatexOutlineEntry {
  id: string;
  title: string;
  level: number;
  line: number;
  command: string;
}

export interface LatexDiagnostic {
  id: string;
  severity: LatexDiagnosticSeverity;
  title: string;
  detail: string;
  line?: number;
}

export interface LatexSnippet {
  id: string;
  title: string;
  description: string;
  before: string;
  after: string;
}

export interface LatexStats {
  lines: number;
  characters: number;
  words: number;
  equations: number;
  citations: number;
  labels: number;
}

export interface LatexPreviewBlock {
  id: string;
  kind: "meta" | "abstract" | "section" | "body";
  title: string;
  content: string;
  level: number;
}

export interface LatexProjectFile {
  path: string;
  content: string;
}

export interface WritingProjectSnapshot {
  projectName: string;
  mainTex: string;
  bibtex: string;
  notes: string;
}

export interface WritingCompileSummary {
  success: boolean;
  pdfPath: string | null;
  workDir: string;
  engine: string;
  log: string;
}

export const WRITING_STORAGE_KEY = "rc:writing:workspace:v1";
export const DEFAULT_PROJECT_NAME = "xiaoyan-paper";

export const EXPORT_TARGET_LABELS: Record<WritingExportTarget, string> = {
  texstudio: "TeXstudio",
  overleaf: "Overleaf",
};
