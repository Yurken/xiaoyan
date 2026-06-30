import { useState } from "react";
import { formatErrorMessage } from "../../lib/client";
import type { CodeFileAttachment } from "./shared";
import { readAttachmentFile } from "./shared";

const MAX_ATTACH = 5;

interface UseCodeAttachmentsOptions {
  onToast: (message: string) => void;
}

export function useCodeAttachments({ onToast }: UseCodeAttachmentsOptions) {
  const [attachments, setAttachments] = useState<CodeFileAttachment[]>([]);

  async function pickAttachments() {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const picked = await open({ multiple: true, directory: false });
      if (!picked) return;

      const paths = Array.isArray(picked) ? picked : [picked];
      const remaining = MAX_ATTACH - attachments.length;
      if (remaining <= 0) {
        onToast(`最多附加 ${MAX_ATTACH} 个文件`);
        return;
      }

      const newAttachments: CodeFileAttachment[] = [];
      for (const p of paths.slice(0, remaining)) {
        const result = await readAttachmentFile(p);
        if (result) {
          newAttachments.push({
            id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            ...result,
          });
        }
      }

      if (newAttachments.length > 0) {
        setAttachments((prev) => [...prev, ...newAttachments]);
      }
    } catch (err) {
      onToast(formatErrorMessage(err));
    }
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((item) => item.id !== id));
  }

  function clearAttachments() {
    setAttachments([]);
  }

  return {
    attachments,
    pickAttachments,
    removeAttachment,
    clearAttachments,
  };
}
