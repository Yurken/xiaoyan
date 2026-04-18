import { useState } from "react";
import { apiClient, formatErrorMessage } from "../../lib/client";
import type { CopilotAttachmentPayload } from "./shared";

export interface PendingCopilotAttachment extends CopilotAttachmentPayload {
  id: string;
  path: string;
}

const MAX_ATTACHMENTS = 5;
const MAX_TEXT_CHARS = 12000;
const TEXT_FILE_EXTENSIONS = new Set([
  "txt",
  "md",
  "markdown",
  "json",
  "jsonl",
  "csv",
  "tsv",
  "yaml",
  "yml",
  "log",
  "py",
  "js",
  "jsx",
  "ts",
  "tsx",
  "rs",
  "go",
  "java",
  "c",
  "cc",
  "cpp",
  "h",
  "hpp",
  "css",
  "html",
  "xml",
  "sql",
  "sh",
  "toml",
  "ini",
]);

function getFileName(path: string) {
  return path.split(/[/\\]/).pop() || path;
}

function getExtension(path: string) {
  const name = getFileName(path);
  const lastDot = name.lastIndexOf(".");
  return lastDot >= 0 ? name.slice(lastDot + 1).toLowerCase() : "";
}

function normalizeSelectedPaths(
  selected:
    | string
    | string[]
    | { path?: string | null }[]
    | { path?: string | null }
    | null,
) {
  if (!selected) return [];
  if (typeof selected === "string") return [selected];
  if (Array.isArray(selected)) {
    return selected
      .map((item) => (typeof item === "string" ? item : item?.path || ""))
      .filter((item): item is string => Boolean(item));
  }
  return selected.path ? [selected.path] : [];
}

async function readAttachmentContent(path: string, extension: string) {
  if (extension === "pdf") {
    return apiClient.papers.extractPdfText(path, MAX_TEXT_CHARS);
  }

  if (!TEXT_FILE_EXTENSIONS.has(extension)) {
    throw new Error(`暂不支持读取该文件类型：.${extension || "unknown"}`);
  }

  const { readTextFile } = await import("@tauri-apps/plugin-fs");
  const text = await readTextFile(path);
  return text.slice(0, MAX_TEXT_CHARS);
}

function toMediaTypeLabel(extension: string) {
  if (extension === "pdf") return "PDF";
  return "文本";
}

export function useCopilotAttachments(onError: (message: string) => void) {
  const [attachments, setAttachments] = useState<PendingCopilotAttachment[]>([]);
  const [uploading, setUploading] = useState(false);

  const pickAttachments = async () => {
    if (uploading || attachments.length >= MAX_ATTACHMENTS) {
      if (attachments.length >= MAX_ATTACHMENTS) {
        onError(`最多只能添加 ${MAX_ATTACHMENTS} 个附件。`);
      }
      return;
    }

    try {
      onError("");
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        multiple: true,
        filters: [
          { name: "支持的文件", extensions: ["pdf", ...TEXT_FILE_EXTENSIONS] },
        ],
      });

      const selectedPaths = normalizeSelectedPaths(selected);
      if (selectedPaths.length === 0) return;

      setUploading(true);
      const existingPaths = new Set(attachments.map((attachment) => attachment.path));
      const acceptedPaths = selectedPaths
        .filter((path) => !existingPaths.has(path))
        .slice(0, MAX_ATTACHMENTS - attachments.length);

      const nextAttachments: PendingCopilotAttachment[] = [];
      const failedFiles: string[] = [];

      for (const path of acceptedPaths) {
        const extension = getExtension(path);
        const name = getFileName(path);

        try {
          const content = (await readAttachmentContent(path, extension)).trim();
          if (!content) {
            throw new Error("没有提取到可读内容");
          }

          nextAttachments.push({
            id: `${Date.now()}-${path}`,
            path,
            name,
            extension,
            mediaTypeLabel: toMediaTypeLabel(extension),
            content,
          });
        } catch (error) {
          failedFiles.push(`${name}：${formatErrorMessage(error)}`);
        }
      }

      if (nextAttachments.length > 0) {
        setAttachments((current) => [...current, ...nextAttachments]);
      }

      if (failedFiles.length > 0) {
        onError(failedFiles.join("；"));
      } else if (acceptedPaths.length < selectedPaths.length) {
        onError(`部分文件未添加：已达到 ${MAX_ATTACHMENTS} 个附件上限，或文件已在列表中。`);
      }
    } catch (error) {
      onError(formatErrorMessage(error));
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = (attachmentId: string) => {
    setAttachments((current) => current.filter((attachment) => attachment.id !== attachmentId));
  };

  const clearAttachments = () => {
    setAttachments([]);
  };

  return {
    attachments,
    uploading,
    pickAttachments,
    removeAttachment,
    clearAttachments,
  };
}
