import { useCallback, useState } from "react";
import { formatErrorMessage, writingApi } from "../../lib/client";
import {
  EXPORT_TARGET_LABELS,
  type LatexProjectFile,
  type WritingEditorSource,
  type WritingExportTarget,
  type WritingImageAsset,
  type WritingTexFile,
} from "./shared";
import { buildLatexProjectFiles, sanitizeLatexProjectName } from "./latexProject";
import { normalizeWritingTexFilePath, normalizeWritingTexFiles } from "./texFiles";
import { buildZipArchive } from "./zip";

interface UseWritingFileActionsOptions {
  draftId: string;
  projectName: string;
  mainTex: string;
  bibtex: string;
  texFiles: WritingTexFile[];
  notes: string;
  imageAssets: WritingImageAsset[];
  setMainTex: (value: string) => void;
  setBibtex: (value: string) => void;
  setTexFiles: (value: WritingTexFile[]) => void;
  setImageAssets: (value: WritingImageAsset[]) => void;
  setActiveSource: (value: WritingEditorSource) => void;
  onMessage: (message: string) => void;
  onError: (error: string) => void;
  clearStatus: () => void;
}

export function useWritingFileActions({
  draftId,
  projectName,
  mainTex,
  bibtex,
  texFiles,
  notes,
  imageAssets,
  setMainTex,
  setBibtex,
  setTexFiles,
  setImageAssets,
  setActiveSource,
  onMessage,
  onError,
  clearStatus,
}: UseWritingFileActionsOptions) {
  const [exportingTarget, setExportingTarget] = useState<WritingExportTarget | null>(null);

  const importTexFile = useCallback(async () => {
    try {
      clearStatus();
      const text = await readLocalTextFile(["tex", "txt"]);
      if (text === null) return;
      setMainTex(text);
      setActiveSource("main");
      onMessage("已导入 main.tex 内容");
    } catch (err) {
      onError(formatErrorMessage(err));
    }
  }, [clearStatus, onError, onMessage, setActiveSource, setMainTex]);

  const importBibFile = useCallback(async () => {
    try {
      clearStatus();
      const text = await readLocalTextFile(["bib", "txt"]);
      if (text === null) return;
      setBibtex(text);
      setActiveSource("bib");
      onMessage("已导入 references.bib 内容");
    } catch (err) {
      onError(formatErrorMessage(err));
    }
  }, [clearStatus, onError, onMessage, setActiveSource, setBibtex]);

  const importTexProject = useCallback(async () => {
    try {
      clearStatus();
      const { open } = await import("@tauri-apps/plugin-dialog");
      const path = await open({ directory: true, multiple: false, title: "选择 LaTeX 项目目录" });
      if (typeof path !== "string") return;

      const project = await readLatexProjectDirectory(path);
      setMainTex(project.mainTex);
      setBibtex(project.bibtex);
      setTexFiles(project.texFiles);
      setActiveSource("main");
      onMessage(`已导入项目：main.tex 与 ${project.texFiles.length} 个章节文件`);
    } catch (err) {
      onError(formatErrorMessage(err));
    }
  }, [clearStatus, onError, onMessage, setActiveSource, setBibtex, setMainTex, setTexFiles]);

  const copyMainTex = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(mainTex);
      onMessage("已复制 main.tex 源码");
    } catch (err) {
      onError(formatErrorMessage(err));
    }
  }, [mainTex, onError, onMessage]);

  const importImage = useCallback(async (): Promise<WritingImageAsset | null> => {
    try {
      clearStatus();
      const { open } = await import("@tauri-apps/plugin-dialog");
      const path = await open({
        filters: [{ name: "图片", extensions: ["png", "jpg", "jpeg", "pdf"] }],
        multiple: false,
      });
      if (typeof path !== "string") return null;

      const asset = await writingApi.importImage(draftId, path);
      setImageAssets(upsertImageAsset(imageAssets, asset));
      setActiveSource("main");
      onMessage(`已导入图片：${asset.fileName}`);
      return asset;
    } catch (err) {
      onError(formatErrorMessage(err));
      return null;
    }
  }, [clearStatus, draftId, imageAssets, onError, onMessage, setActiveSource, setImageAssets]);

  const exportProject = useCallback(async (target: WritingExportTarget) => {
    setExportingTarget(target);
    clearStatus();
    try {
      const files = buildLatexProjectFiles({ projectName, mainTex, bibtex, texFiles, notes, imageAssets }, target);
      const imageFiles = await loadImageAssetFiles(imageAssets);
      const zip = buildZipArchive([...files, ...imageFiles]);
      const { save } = await import("@tauri-apps/plugin-dialog");
      const { writeFile } = await import("@tauri-apps/plugin-fs");
      const path = await save({
        filters: [{ name: "LaTeX Zip", extensions: ["zip"] }],
        defaultPath: `${sanitizeLatexProjectName(projectName)}-${target}.zip`,
      });
      if (!path) return;
      await writeFile(path, zip);
      onMessage(`已导出 ${EXPORT_TARGET_LABELS[target]} 项目包：${path.split("/").pop() ?? path}`);
    } catch (err) {
      onError(formatErrorMessage(err));
    } finally {
      setExportingTarget(null);
    }
  }, [bibtex, clearStatus, imageAssets, mainTex, notes, onError, onMessage, projectName, texFiles]);

  return {
    exportingTarget,
    importTexFile,
    importTexProject,
    importBibFile,
    importImage,
    copyMainTex,
    exportProject,
  };
}

interface ImportedLatexProject {
  mainTex: string;
  bibtex: string;
  texFiles: WritingTexFile[];
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

async function readLatexProjectDirectory(rootPath: string): Promise<ImportedLatexProject> {
  const { readDir, readTextFile } = await import("@tauri-apps/plugin-fs");
  const { join } = await import("@tauri-apps/api/path");
  const entries: Array<{ path: string; content: string }> = [];

  const visit = async (absolutePath: string, relativePath = "") => {
    const children = await readDir(absolutePath);
    for (const child of children) {
      if (child.isSymlink) continue;
      const nextAbsolutePath = await join(absolutePath, child.name);
      const nextRelativePath = relativePath ? `${relativePath}/${child.name}` : child.name;
      if (child.isDirectory) {
        await visit(nextAbsolutePath, nextRelativePath);
      } else if (child.isFile && /\.(?:tex|bib)$/i.test(child.name)) {
        entries.push({ path: nextRelativePath, content: await readTextFile(nextAbsolutePath) });
      }
    }
  };

  await visit(rootPath);
  const texEntries = entries
    .filter((entry) => /\.tex$/i.test(entry.path))
    .flatMap((entry) => {
      const path = normalizeImportedTexPath(entry.path);
      return path ? [{ path, content: entry.content }] : [];
    })
    .sort((left, right) => left.path.localeCompare(right.path));
  const mainEntry = texEntries.find((entry) => entry.path === "main.tex")
    ?? texEntries.find((entry) => /\\documentclass(?:\[[^\]]*\])?\s*\{/.test(entry.content))
    ?? texEntries[0];
  if (!mainEntry) throw new Error("所选目录中没有可用的 .tex 文件。");

  const bibEntries = entries.filter((entry) => /\.bib$/i.test(entry.path));
  const bibEntry = bibEntries.find((entry) => entry.path.toLowerCase() === "references.bib") ?? bibEntries[0];
  return {
    mainTex: mainEntry.content,
    bibtex: bibEntry?.content ?? "",
    texFiles: normalizeWritingTexFiles(texEntries.filter((entry) => entry.path !== mainEntry.path)),
  };
}

function normalizeImportedTexPath(path: string): string | null {
  if (path.toLowerCase() === "main.tex") return "main.tex";
  return normalizeWritingTexFilePath(path);
}

async function loadImageAssetFiles(imageAssets: WritingImageAsset[]): Promise<LatexProjectFile[]> {
  if (imageAssets.length === 0) return [];
  const { readFile } = await import("@tauri-apps/plugin-fs");
  return Promise.all(imageAssets.map(async (asset) => ({
    path: asset.projectPath,
    content: await readFile(asset.storedPath),
  })));
}

function upsertImageAsset(current: WritingImageAsset[], asset: WritingImageAsset): WritingImageAsset[] {
  const existingIndex = current.findIndex((item) => item.id === asset.id || item.projectPath === asset.projectPath);
  if (existingIndex === -1) return [...current, asset];
  return current.map((item, index) => (index === existingIndex ? asset : item));
}
