import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatErrorMessage } from "../../lib/client";
import {
  EXPORT_TARGET_LABELS,
  WRITING_STORAGE_KEY,
  type LatexSnippet,
  type WritingExportTarget,
  type WritingTemplateId,
  type WritingViewMode,
} from "./shared";
import { analyzeLatex, buildLatexPreviewBlocks, extractLatexOutline, getLatexStats } from "./latexAnalysis";
import { buildLatexProjectFiles, sanitizeLatexProjectName } from "./latexProject";
import { useWritingCompiler } from "./useWritingCompiler";
import { WRITING_SNIPPETS, WRITING_TEMPLATES, getDefaultWritingTemplate, getWritingTemplate } from "./templates";
import { buildZipArchive } from "./zip";

interface PersistedWritingState {
  projectName?: string;
  templateId?: WritingTemplateId;
  mainTex?: string;
  bibtex?: string;
  notes?: string;
}

interface InsertOptions {
  selectInserted?: boolean;
}

export function useWritingWorkspace() {
  const initialState = useMemo(loadPersistedState, []);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const [projectName, setProjectName] = useState(initialState.projectName);
  const [templateId, setTemplateId] = useState<WritingTemplateId>(initialState.templateId);
  const [mainTex, setMainTex] = useState(initialState.mainTex);
  const [bibtex, setBibtex] = useState(initialState.bibtex);
  const [notes, setNotes] = useState(initialState.notes);
  const [viewMode, setViewMode] = useState<WritingViewMode>("split");
  const [activeSource, setActiveSource] = useState<"main" | "bib">("main");
  const [exportingTarget, setExportingTarget] = useState<WritingExportTarget | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const outline = useMemo(() => extractLatexOutline(mainTex), [mainTex]);
  const stats = useMemo(() => getLatexStats(mainTex), [mainTex]);
  const diagnostics = useMemo(() => analyzeLatex(mainTex, bibtex), [bibtex, mainTex]);
  const previewBlocks = useMemo(() => buildLatexPreviewBlocks(mainTex), [mainTex]);
  const currentTemplate = useMemo(() => getWritingTemplate(templateId), [templateId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const payload: PersistedWritingState = { projectName, templateId, mainTex, bibtex, notes };
      localStorage.setItem(WRITING_STORAGE_KEY, JSON.stringify(payload));
      setLastSavedAt(new Date());
    }, 350);
    return () => window.clearTimeout(timer);
  }, [bibtex, mainTex, notes, projectName, templateId]);

  const clearStatus = useCallback(() => {
    setError("");
    setMessage("");
  }, []);
  const showMessage = useCallback((nextMessage: string) => {
    setMessage(nextMessage);
    setError("");
  }, []);
  const showError = useCallback((nextError: string) => {
    setError(nextError);
  }, []);
  const compiler = useWritingCompiler({
    projectName,
    mainTex,
    bibtex,
    notes,
    onMessage: showMessage,
    onError: showError,
    clearStatus,
  });

  const insertText = useCallback((before: string, after = "", options: InsertOptions = {}) => {
    setActiveSource("main");
    const editor = editorRef.current;
    if (!editor) {
      setMainTex((current) => `${current}${before}${after}`);
      return;
    }

    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selected = mainTex.slice(start, end);
    const nextValue = `${mainTex.slice(0, start)}${before}${selected}${after}${mainTex.slice(end)}`;
    const cursorStart = start + before.length;
    const cursorEnd = options.selectInserted ? cursorStart + selected.length : cursorStart + selected.length;

    setMainTex(nextValue);
    window.requestAnimationFrame(() => {
      editor.focus();
      editor.setSelectionRange(cursorEnd, cursorEnd);
    });
  }, [mainTex]);

  const insertSnippet = useCallback((snippet: LatexSnippet) => {
    insertText(snippet.before, snippet.after);
  }, [insertText]);

  const jumpToLine = useCallback((line: number) => {
    setActiveSource("main");
    const performJump = () => {
      const editor = editorRef.current;
      if (!editor) return;
      const index = getLineStartIndex(mainTex, line);
      const end = Math.min(index + 1, mainTex.length);
      editor.focus();
      editor.setSelectionRange(index, end);
      setTimeout(() => {
        const currentEditor = editorRef.current;
        if (!currentEditor) return;
        currentEditor.setSelectionRange(index, index);
        const lineHeight = 24;
        currentEditor.scrollTop = Math.max(0, (line - 3) * lineHeight);
      }, 100);
    };

    if (activeSource === "main") {
      performJump();
    } else {
      window.setTimeout(performJump, 50);
    }
  }, [mainTex, activeSource]);

  const applyTemplate = useCallback((nextTemplateId: WritingTemplateId) => {
    const template = getWritingTemplate(nextTemplateId);
    setTemplateId(nextTemplateId);
    setMainTex(template.mainTex);
    setBibtex(template.bibtex);
    setMessage(`已套用「${template.title}」模板`);
    setError("");
  }, []);

  const resetWorkspace = useCallback(() => {
    const template = getDefaultWritingTemplate();
    setProjectName("xiaoyan-paper");
    setTemplateId(template.id);
    setMainTex(template.mainTex);
    setBibtex(template.bibtex);
    setNotes("");
    setMessage("已重置为默认论文草稿");
    setError("");
  }, []);

  const importTexFile = useCallback(async () => {
    try {
      clearStatus();
      const text = await readLocalTextFile(["tex", "txt"]);
      if (text === null) return;
      setMainTex(text);
      setActiveSource("main");
      setMessage("已导入 main.tex 内容");
    } catch (err) {
      setError(formatErrorMessage(err));
    }
  }, [clearStatus]);

  const importBibFile = useCallback(async () => {
    try {
      clearStatus();
      const text = await readLocalTextFile(["bib", "txt"]);
      if (text === null) return;
      setBibtex(text);
      setActiveSource("bib");
      setMessage("已导入 references.bib 内容");
    } catch (err) {
      setError(formatErrorMessage(err));
    }
  }, [clearStatus]);

  const copyMainTex = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(mainTex);
      setMessage("已复制 main.tex 源码");
      setError("");
    } catch (err) {
      setError(formatErrorMessage(err));
    }
  }, [mainTex]);

  const exportProject = useCallback(async (target: WritingExportTarget) => {
    setExportingTarget(target);
    setError("");
    setMessage("");
    try {
      const files = buildLatexProjectFiles({ projectName, mainTex, bibtex, notes }, target);
      const zip = buildZipArchive(files);
      const { save } = await import("@tauri-apps/plugin-dialog");
      const { writeFile } = await import("@tauri-apps/plugin-fs");
      const path = await save({
        filters: [{ name: "LaTeX Zip", extensions: ["zip"] }],
        defaultPath: `${sanitizeLatexProjectName(projectName)}-${target}.zip`,
      });
      if (!path) return;
      await writeFile(path, zip);
      setMessage(`已导出 ${EXPORT_TARGET_LABELS[target]} 项目包：${path.split("/").pop() ?? path}`);
    } catch (err) {
      setError(formatErrorMessage(err));
    } finally {
      setExportingTarget(null);
    }
  }, [bibtex, mainTex, notes, projectName]);

  return {
    projectName,
    templateId,
    currentTemplate,
    mainTex,
    bibtex,
    notes,
    viewMode,
    activeSource,
    exportingTarget,
    compileStatus: compiler.compileStatus,
    compileResult: compiler.compileResult,
    latexInstallerStatus: compiler.latexInstallerStatus,
    message,
    error,
    lastSavedAt,
    outline,
    stats,
    diagnostics,
    previewBlocks,
    templates: WRITING_TEMPLATES,
    snippets: WRITING_SNIPPETS,
    editorRef: editorRef as RefObject<HTMLTextAreaElement>,
    setProjectName,
    setMainTex,
    setBibtex,
    setNotes,
    setViewMode,
    setActiveSource,
    insertText,
    insertSnippet,
    jumpToLine,
    applyTemplate,
    resetWorkspace,
    importTexFile,
    importBibFile,
    copyMainTex,
    exportProject,
    compilePdf: compiler.compilePdf,
    openLatexInstaller: compiler.openLatexInstaller,
    openLatexDownloadPage: compiler.openLatexDownloadPage,
    openCompiledPdf: compiler.openCompiledPdf,
    saveCompiledPdf: compiler.saveCompiledPdf,
  };
}

function loadPersistedState() {
  const template = getDefaultWritingTemplate();
  const fallback = {
    projectName: "xiaoyan-paper",
    templateId: template.id,
    mainTex: template.mainTex,
    bibtex: template.bibtex,
    notes: "",
  };

  try {
    const raw = localStorage.getItem(WRITING_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as PersistedWritingState;
    return {
      projectName: parsed.projectName || fallback.projectName,
      templateId: parsed.templateId || fallback.templateId,
      mainTex: parsed.mainTex || fallback.mainTex,
      bibtex: parsed.bibtex ?? fallback.bibtex,
      notes: parsed.notes ?? fallback.notes,
    };
  } catch {
    return fallback;
  }
}

async function readLocalTextFile(extensions: string[]): Promise<string | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const path = await open({
    filters: [{ name: "文本文件", extensions }],
    multiple: false,
  });
  if (typeof path !== "string") return null;
  const { readTextFile } = await import("@tauri-apps/plugin-fs");
  return readTextFile(path);
}

function getLineStartIndex(source: string, line: number): number {
  if (line <= 1) return 0;
  let currentLine = 1;
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] !== "\n") continue;
    currentLine += 1;
    if (currentLine === line) return index + 1;
  }
  return source.length;
}
