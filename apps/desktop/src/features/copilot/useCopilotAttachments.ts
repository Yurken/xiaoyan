import { useEffect, useState } from "react";
import { apiClient, formatErrorMessage } from "../../lib/client";
import type { CopilotAttachmentPayload } from "./shared";

export interface PendingCopilotAttachment extends CopilotAttachmentPayload {
  id: string;
  path: string;
}

// 跨路由保留未发送的附件：Copilot 页切走再回来时组件会卸载、state 重置，
// 用模块级缓存兜底，发送（clearAttachments）后清空。
let pendingAttachmentsCache: PendingCopilotAttachment[] = [];

const MAX_ATTACHMENTS = 5;
const MAX_TEXT_CHARS = 12000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 单图原始字节上限 8MB
const IMAGE_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};
const IMAGE_FILE_EXTENSIONS = Object.keys(IMAGE_MIME);

/** Uint8Array → base64（分块避免 String.fromCharCode 调用栈溢出）。 */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
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
  const [attachments, setAttachments] = useState<PendingCopilotAttachment[]>(() => pendingAttachmentsCache);
  const [uploading, setUploading] = useState(false);

  // 同步模块级缓存，使未发送附件在路由切换/组件重挂后仍可恢复。
  useEffect(() => {
    pendingAttachmentsCache = attachments;
  }, [attachments]);

  const addAttachments = async (selectedPaths: string[]) => {
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
        if (IMAGE_MIME[extension]) {
          const { readFile } = await import("@tauri-apps/plugin-fs");
          const bytes = await readFile(path);
          if (bytes.length > MAX_IMAGE_BYTES) {
            throw new Error(`图片过大（${(bytes.length / 1024 / 1024).toFixed(1)}MB），上限 ${MAX_IMAGE_BYTES / 1024 / 1024}MB`);
          }
          nextAttachments.push({
            id: `${Date.now()}-${path}`,
            path,
            name,
            extension,
            mediaTypeLabel: "图片",
            content: "",
            kind: "image",
            imageData: bytesToBase64(bytes),
            imageMediaType: IMAGE_MIME[extension],
          });
          continue;
        }

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
          kind: "text",
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

    setUploading(false);
  };

  // 粘贴/拖入的图片 Blob（无文件路径），直接读为 base64 添加为图片附件。
  const addImageFiles = async (files: File[]) => {
    const supported = new Set(Object.values(IMAGE_MIME));
    const images = files.filter((file) => supported.has(file.type));
    if (images.length === 0) {
      if (files.length > 0) onError("仅支持粘贴 PNG / JPEG / GIF / WebP 图片。");
      return;
    }
    if (attachments.length >= MAX_ATTACHMENTS) {
      onError(`最多只能添加 ${MAX_ATTACHMENTS} 个附件。`);
      return;
    }

    setUploading(true);
    onError("");
    const accepted = images.slice(0, MAX_ATTACHMENTS - attachments.length);
    const nextAttachments: PendingCopilotAttachment[] = [];
    const failedFiles: string[] = [];

    for (let i = 0; i < accepted.length; i += 1) {
      const file = accepted[i];
      const label = file.name || "粘贴图片";
      try {
        if (file.size > MAX_IMAGE_BYTES) {
          throw new Error(`图片过大（${(file.size / 1024 / 1024).toFixed(1)}MB），上限 ${MAX_IMAGE_BYTES / 1024 / 1024}MB`);
        }
        const bytes = new Uint8Array(await file.arrayBuffer());
        const extension = file.type.split("/")[1] || "png";
        const uniqueId = `paste-${Date.now()}-${i}`;
        nextAttachments.push({
          id: uniqueId,
          path: uniqueId,
          name: file.name || `粘贴图片-${i + 1}.${extension}`,
          extension,
          mediaTypeLabel: "图片",
          content: "",
          kind: "image",
          imageData: bytesToBase64(bytes),
          imageMediaType: file.type,
        });
      } catch (error) {
        failedFiles.push(`${label}：${formatErrorMessage(error)}`);
      }
    }

    if (nextAttachments.length > 0) {
      setAttachments((current) => [...current, ...nextAttachments]);
    }
    if (failedFiles.length > 0) {
      onError(failedFiles.join("；"));
    } else if (accepted.length < images.length) {
      onError(`部分图片未添加：已达到 ${MAX_ATTACHMENTS} 个附件上限。`);
    }
    setUploading(false);
  };

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
          { name: "支持的文件", extensions: ["pdf", ...IMAGE_FILE_EXTENSIONS, ...TEXT_FILE_EXTENSIONS] },
        ],
      });

      const selectedPaths = normalizeSelectedPaths(selected);
      await addAttachments(selectedPaths);
    } catch (error) {
      onError(formatErrorMessage(error));
    }
  };

  const pickFromDrop = async (paths: string[]) => {
    if (uploading) return;
    if (attachments.length >= MAX_ATTACHMENTS) {
      onError(`最多只能添加 ${MAX_ATTACHMENTS} 个附件。`);
      return;
    }

    try {
      onError("");
      await addAttachments(paths);
    } catch (error) {
      onError(formatErrorMessage(error));
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
    pickFromDrop,
    addImageFiles,
    removeAttachment,
    clearAttachments,
  };
}
