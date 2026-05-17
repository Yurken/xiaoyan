export type WritingExportTarget = "texstudio" | "overleaf";
export type WritingViewMode = "split" | "editor" | "preview";
export type WritingTemplateId = "journal" | "conference" | "thesis-note";
export type LatexDiagnosticSeverity = "error" | "warning" | "info";
export type WritingCompileStatus = "idle" | "compiling" | "ready" | "failed";

export interface WritingResearchInterestSummary {
  id: string;
  topic: string;
  folder_name?: string;
}

export interface WritingDraft {
  id: string;
  projectName: string;
  researchInterestId?: string;
  templateId: WritingTemplateId;
  mainTex: string;
  bibtex: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

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
export const WRITING_LIBRARY_STORAGE_KEY = "rc:writing:library:v1";
export const WRITING_ACTIVE_DRAFT_KEY = "rc:writing:active-draft:v1";
export const DEFAULT_PROJECT_NAME = "xiaoyan-paper";
export const MACOS_TEXBIN_PATH = "/Library/TeX/texbin";
export const MACTEX_INSTALLER_URL = "https://mirror.ctan.org/systems/mac/mactex/MacTeX.pkg";
export const MACTEX_DOWNLOAD_PAGE_URL = "https://tug.org/mactex/mactex-download.html";

export const EXPORT_TARGET_LABELS: Record<WritingExportTarget, string> = {
  texstudio: "TeXstudio",
  overleaf: "Overleaf",
};

export function writingDraftTitle(draft: Pick<WritingDraft, "projectName">): string {
  return draft.projectName.trim() || DEFAULT_PROJECT_NAME;
}

export function writingResearchInterestTitle(
  interest?: Pick<WritingResearchInterestSummary, "topic" | "folder_name"> | null,
): string {
  return interest?.folder_name?.trim() || interest?.topic || "未绑定研究主题";
}

export function isLatexCompilerMissing(result: WritingCompileSummary | null): boolean {
  if (!result) return false;
  return result.engine === "not-found" || result.log.includes("未找到 LaTeX 编译器");
}
