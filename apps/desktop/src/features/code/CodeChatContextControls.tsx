import { FileText, Layers, Plus, X } from "lucide-react";
import type { CodeFileAttachment } from "./shared";

interface CodeChatContextControlsProps {
  attachments: CodeFileAttachment[];
  contextStats?: { files: number; instructions: number; scripts: number; chars: number } | null;
  onAddFile: () => void;
  onPickAttachments?: () => void;
  onRemoveAttachment?: (id: string) => void;
}

export default function CodeChatContextControls({
  attachments,
  contextStats = null,
  onAddFile,
  onPickAttachments,
  onRemoveAttachment,
}: CodeChatContextControlsProps) {
  return (
    <>
      <button
        type="button"
        className="code-chat-attach-btn"
        onClick={onPickAttachments ?? onAddFile}
        aria-label="添加文件"
        title="添加文件作为上下文"
      >
        <Plus size={16} />
      </button>

      {contextStats && (
        <div
          className="code-chat-context-chip"
          title={`上下文包：${contextStats.files} 个文件线索，${contextStats.instructions} 个项目指令，${contextStats.scripts} 个脚本`}
        >
          <Layers className="w-3 h-3 flex-shrink-0" />
          <span>{contextStats.files} files</span>
          {contextStats.instructions > 0 && <span>{contextStats.instructions} rules</span>}
        </div>
      )}

      {attachments.map((attachment) => (
        <div
          key={attachment.id}
          className="inline-flex items-center gap-1 rounded-xl px-2 py-0.5 text-[11px] font-medium flex-shrink-0 max-w-[140px] group"
          style={{ background: "rgba(0,122,255,0.08)", color: "#007AFF" }}
          title={attachment.path}
        >
          <FileText className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{attachment.name}</span>
          <button
            type="button"
            onClick={() => onRemoveAttachment?.(attachment.id)}
            className="opacity-0 group-hover:opacity-100 transition-opacity hover:opacity-60 flex-shrink-0"
            aria-label="移除附件"
            title="移除附件"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
    </>
  );
}
