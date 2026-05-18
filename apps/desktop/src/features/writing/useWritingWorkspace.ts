import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_PROJECT_NAME,
  type WritingCreateDraftOptions,
  type WritingImageAsset,
  type WritingTemplateId,
  type WritingViewMode,
} from "./shared";
import { analyzeLatex, buildLatexPreviewBlocks, extractLatexOutline, getLatexStats } from "./latexAnalysis";
import { buildLatexImageFigureInsert } from "./latexProject";
import { useWritingCompiler } from "./useWritingCompiler";
import { useWritingDraftLibrary } from "./useWritingDraftLibrary";
import { useWritingFileActions } from "./useWritingFileActions";
import { WRITING_TEMPLATES, getDefaultWritingTemplate, getWritingTemplate } from "./templates";

interface InsertOptions {
  selectInserted?: boolean;
}

export function useWritingWorkspace() {
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const {
    drafts,
    activeDraft,
    activeDraftId,
    interests,
    loadingInterests,
    interestError,
    lastSavedAt,
    setActiveDraftId,
    updateActiveDraft,
    createDraft: createLibraryDraft,
    deleteDraft: deleteLibraryDraft,
  } = useWritingDraftLibrary();
  const projectName = activeDraft.projectName;
  const templateId = activeDraft.templateId;
  const mainTex = activeDraft.mainTex;
  const bibtex = activeDraft.bibtex;
  const notes = activeDraft.notes;
  const imageAssets = activeDraft.imageAssets;
  const [viewMode, setViewMode] = useState<WritingViewMode>("split");
  const [activeSource, setActiveSource] = useState<"main" | "bib">("main");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const outline = useMemo(() => extractLatexOutline(mainTex), [mainTex]);
  const stats = useMemo(() => getLatexStats(mainTex), [mainTex]);
  const diagnostics = useMemo(() => analyzeLatex(mainTex, bibtex), [bibtex, mainTex]);
  const previewBlocks = useMemo(() => buildLatexPreviewBlocks(mainTex), [mainTex]);
  const currentTemplate = useMemo(() => getWritingTemplate(templateId), [templateId]);

  useEffect(() => {
    setActiveSource("main");
  }, [activeDraftId]);

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
    draftId: activeDraft.id,
    projectName,
    mainTex,
    bibtex,
    notes,
    imageAssets,
    onMessage: showMessage,
    onError: showError,
    clearStatus,
  });

  const setProjectName = useCallback((value: string) => {
    updateActiveDraft({ projectName: value });
  }, [updateActiveDraft]);

  const setMainTex = useCallback((value: string) => {
    updateActiveDraft({ mainTex: value });
  }, [updateActiveDraft]);

  const setBibtex = useCallback((value: string) => {
    updateActiveDraft({ bibtex: value });
  }, [updateActiveDraft]);

  const setNotes = useCallback((value: string) => {
    updateActiveDraft({ notes: value });
  }, [updateActiveDraft]);

  const setImageAssets = useCallback((value: WritingImageAsset[]) => {
    updateActiveDraft({ imageAssets: value });
  }, [updateActiveDraft]);

  const setResearchInterestId = useCallback((value: string) => {
    updateActiveDraft({ researchInterestId: value || undefined });
  }, [updateActiveDraft]);

  const fileActions = useWritingFileActions({
    draftId: activeDraft.id,
    projectName,
    mainTex,
    bibtex,
    notes,
    imageAssets,
    setMainTex,
    setBibtex,
    setImageAssets,
    setActiveSource,
    onMessage: showMessage,
    onError: showError,
    clearStatus,
  });

  const insertText = useCallback((before: string, after = "", options: InsertOptions = {}) => {
    setActiveSource("main");
    const editor = activeSource === "main" ? editorRef.current : null;
    const start = editor?.selectionStart ?? mainTex.length;
    const end = editor?.selectionEnd ?? mainTex.length;
    const selected = mainTex.slice(start, end);
    const nextValue = `${mainTex.slice(0, start)}${before}${selected}${after}${mainTex.slice(end)}`;
    const cursorStart = start + before.length;
    const cursorEnd = options.selectInserted ? cursorStart + selected.length : cursorStart + selected.length;

    if (editor) {
      editor.value = nextValue;
    }
    setMainTex(nextValue);
    window.requestAnimationFrame(() => {
      const currentEditor = editorRef.current;
      currentEditor?.focus();
      currentEditor?.setSelectionRange(cursorEnd, cursorEnd);
    });
  }, [activeSource, mainTex, setMainTex]);

  const insertImage = useCallback(async () => {
    const asset = await fileActions.importImage();
    if (!asset) return;
    const snippet = buildLatexImageFigureInsert(asset);
    insertText(snippet.before, snippet.after);
  }, [fileActions, insertText]);

  const getSelectedText = useCallback(() => {
    const editor = activeSource === "main" ? editorRef.current : null;
    if (!editor || editor.selectionStart === editor.selectionEnd) return "";
    return mainTex.slice(editor.selectionStart, editor.selectionEnd);
  }, [activeSource, mainTex]);

  const insertGeneratedText = useCallback((text: string) => {
    if (!text.trim()) return;
    setActiveSource("main");
    const editor = activeSource === "main" ? editorRef.current : null;
    const start = editor?.selectionStart ?? mainTex.length;
    const end = editor?.selectionEnd ?? mainTex.length;
    const nextValue = `${mainTex.slice(0, start)}${text}${mainTex.slice(end)}`;
    const cursor = start + text.length;

    if (editor) {
      editor.value = nextValue;
    }
    setMainTex(nextValue);
    window.requestAnimationFrame(() => {
      const currentEditor = editorRef.current;
      currentEditor?.focus();
      currentEditor?.setSelectionRange(cursor, cursor);
    });
  }, [activeSource, mainTex, setMainTex]);

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
    updateActiveDraft({
      templateId: nextTemplateId,
      mainTex: template.mainTex,
      bibtex: template.bibtex,
    });
    setMessage(`已套用「${template.title}」模板`);
    setError("");
  }, [updateActiveDraft]);

  const resetWorkspace = useCallback(() => {
    const template = getDefaultWritingTemplate();
    updateActiveDraft({
      projectName: DEFAULT_PROJECT_NAME,
      templateId: template.id,
      mainTex: template.mainTex,
      bibtex: template.bibtex,
      notes: "",
    });
    setMessage("已重置为默认论文草稿");
    setError("");
  }, [updateActiveDraft]);

  const createDraft = useCallback((options: WritingCreateDraftOptions = {}) => {
    const draft = createLibraryDraft(options);
    setMessage(`已新建文稿「${draft.projectName}」`);
    setError("");
  }, [createLibraryDraft]);

  const deleteDraft = useCallback((id: string) => {
    const deleted = deleteLibraryDraft(id);
    if (deleted) {
      setMessage("已删除文稿");
      setError("");
    } else {
      setError("至少保留一篇文稿。");
    }
  }, [deleteLibraryDraft]);

  return {
    drafts,
    activeDraftId,
    interests,
    loadingInterests,
    interestError,
    projectName,
    researchInterestId: activeDraft.researchInterestId ?? "",
    templateId,
    currentTemplate,
    mainTex,
    bibtex,
    notes,
    imageAssets,
    viewMode,
    activeSource,
    exportingTarget: fileActions.exportingTarget,
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
    editorRef: editorRef as RefObject<HTMLTextAreaElement>,
    setProjectName,
    setResearchInterestId,
    setMainTex,
    setBibtex,
    setNotes,
    setViewMode,
    setActiveSource,
    setActiveDraftId,
    createDraft,
    deleteDraft,
    insertText,
    insertImage,
    getSelectedText,
    insertGeneratedText,
    jumpToLine,
    applyTemplate,
    resetWorkspace,
    importTexFile: fileActions.importTexFile,
    importBibFile: fileActions.importBibFile,
    copyMainTex: fileActions.copyMainTex,
    exportProject: fileActions.exportProject,
    compilePdf: compiler.compilePdf,
    openLatexInstaller: compiler.openLatexInstaller,
    openLatexDownloadPage: compiler.openLatexDownloadPage,
    openCompiledPdf: compiler.openCompiledPdf,
    saveCompiledPdf: compiler.saveCompiledPdf,
  };
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
