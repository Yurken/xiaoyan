import { useEffect, useMemo, useState } from "react";
import { ArrowUp, Bot, BrainCircuit, FileText, Paperclip, Plus, Square, X, Zap } from "lucide-react";
import type { ChatMode, Skill } from "@research-copilot/types";
import {
  COPILOT_CHAT_MODE_OPTIONS,
  getCopilotInputPlaceholder,
} from "./shared";
import type { PendingCopilotAttachment } from "./useCopilotAttachments";
import CopilotSkillPicker from "./CopilotSkillPicker";

interface CopilotComposerProps {
  chatMode: ChatMode;
  onChatModeChange: (mode: ChatMode) => void;
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void | Promise<void>;
  onCancel: () => void;
  sending: boolean;
  uploadingAttachments: boolean;
  attachments: PendingCopilotAttachment[];
  pickAttachments: () => void | Promise<void>;
  onPasteImages: (files: File[]) => void | Promise<void>;
  removeAttachment: (attachmentId: string) => void;
  skills: Skill[];
  selectedSkillId: string | null;
  onSelectedSkillChange: (skillId: string | null) => void;
  skillLocked: boolean;
  onSkillLockedChange: (locked: boolean) => void;
}

const MODE_ICON = {
  direct: Bot,
  task: BrainCircuit,
} as const;

export default function CopilotComposer({
  chatMode,
  onChatModeChange,
  input,
  onInputChange,
  onSubmit,
  onCancel,
  sending,
  uploadingAttachments,
  attachments,
  pickAttachments,
  onPasteImages,
  removeAttachment,
  skills,
  selectedSkillId,
  onSelectedSkillChange,
  skillLocked,
  onSkillLockedChange,
}: CopilotComposerProps) {
  const [slashIndex, setSlashIndex] = useState(0);

  // 斜杠唤起：当输入恰为单个 /token（无空格）时，弹出技能自动补全。
  const slashQuery = useMemo(() => {
    const match = input.match(/^\/(\S*)$/);
    return match ? match[1] : null;
  }, [input]);
  const slashMatches = useMemo(() => {
    if (slashQuery === null) return [];
    const query = slashQuery.toLowerCase();
    if (!query) return skills;
    return skills.filter(
      (skill) =>
        skill.name.toLowerCase().includes(query) || skill.title.toLowerCase().includes(query),
    );
  }, [slashQuery, skills]);
  const slashOpen = slashQuery !== null && slashMatches.length > 0;

  useEffect(() => {
    setSlashIndex(0);
  }, [slashQuery]);

  const selectSlashSkill = (skillId: string) => {
    onSelectedSkillChange(skillId);
    onInputChange("");
  };

  const canSubmit = (input.trim() || attachments.length > 0) && !sending && !uploadingAttachments;

  // 粘贴图片：从剪贴板取出图片文件并添加为附件（阻止其作为乱码/二进制贴入文本框）。
  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = event.clipboardData?.items;
    if (!items) return;
    const files = Array.from(items)
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null);
    if (files.length > 0) {
      event.preventDefault();
      void onPasteImages(files);
    }
  };

  const attachmentIcon = (ext: string) => {
    if (ext === "pdf") return <FileText className="w-4 h-4 flex-shrink-0" />;
    return <Paperclip className="w-4 h-4 flex-shrink-0" />;
  };

  return (
    <div className="px-3 pb-3 pt-2 relative">
      <div className="space-y-2.5">
        {/* 附件卡片 - 固定尺寸，在输入框上方 */}
        {attachments.length > 0 && (
          <div className="flex items-start gap-2 flex-wrap">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="relative flex items-center gap-1.5 w-36 h-9 rounded-xl px-2.5 flex-shrink-0 group"
                style={{
                  background: "rgba(0,122,255,0.06)",
                  boxShadow: "var(--rc-inset-shadow)",
                }}
              >
                <button
                  type="button"
                  onClick={() => removeAttachment(attachment.id)}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  style={{
                    background: "var(--rc-elevated)",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                    color: "#FF3B30",
                  }}
                >
                  <X className="w-2.5 h-2.5" />
                </button>
                <div className="flex-shrink-0" style={{ color: attachment.extension === "pdf" ? "#FF3B30" : "#007AFF" }}>
                  {attachment.kind === "image" && attachment.imageData ? (
                    <img
                      src={`data:${attachment.imageMediaType};base64,${attachment.imageData}`}
                      alt={attachment.name}
                      className="w-5 h-5 rounded object-cover"
                    />
                  ) : (
                    attachmentIcon(attachment.extension)
                  )}
                </div>
                <span
                  className="text-[11px] font-medium truncate"
                  style={{ color: "var(--rc-text-soft)" }}
                  title={attachment.name}
                >
                  {attachment.name}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* 输入框 + 内嵌按钮栏 */}
        <div
          className="rounded-3xl"
          style={{
            background: "var(--rc-surface)",
            boxShadow: "var(--rc-inset-shadow)",
          }}
        >
          <div className="relative rounded-t-3xl overflow-visible">
            {slashOpen && (
              <div
                className="rc-dropdown-menu absolute bottom-full mb-2 left-3 z-30 w-64 max-h-72 overflow-y-auto rounded-2xl py-1.5"
                onMouseDown={(event) => event.preventDefault()}
              >
                <p className="px-3 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-widest text-ink-tertiary">
                  技能 · 回车选择
                </p>
                {slashMatches.map((skill, index) => (
                  <button
                    key={skill.id}
                    type="button"
                    onMouseEnter={() => setSlashIndex(index)}
                    onClick={() => selectSlashSkill(skill.id)}
                    className="w-full text-left px-3 py-2 transition-colors duration-100 flex items-center gap-2"
                    style={{
                      background: index === slashIndex ? "rgba(0,122,255,0.1)" : "transparent",
                    }}
                  >
                    <Zap
                      className="w-3 h-3 flex-shrink-0"
                      style={{ color: index === slashIndex ? "#007AFF" : "#8E8E93" }}
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className="block truncate text-xs font-medium"
                        style={{ color: index === slashIndex ? "#007AFF" : "var(--rc-text-soft)" }}
                      >
                        {skill.title}
                      </span>
                      <span className="block truncate text-[10px] font-mono text-ink-tertiary">
                        /{skill.name}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
            <textarea
              rows={3}
              value={input}
              onChange={(event) => onInputChange(event.target.value)}
              onKeyDown={(event) => {
                if (slashOpen) {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setSlashIndex((i) => (i + 1) % slashMatches.length);
                    return;
                  }
                  if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setSlashIndex((i) => (i - 1 + slashMatches.length) % slashMatches.length);
                    return;
                  }
                  if (event.key === "Tab" || (event.key === "Enter" && !event.metaKey && !event.ctrlKey)) {
                    event.preventDefault();
                    const picked = slashMatches[slashIndex];
                    if (picked) selectSlashSkill(picked.id);
                    return;
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    onInputChange("");
                    return;
                  }
                }
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  void onSubmit();
                }
              }}
              onPaste={handlePaste}
              placeholder={getCopilotInputPlaceholder(chatMode)}
              className="w-full px-5 pt-4 pb-2 text-sm text-ink-primary placeholder:text-ink-tertiary outline-none border-0 resize-none"
              style={{ background: "transparent" }}
            />
          </div>

          <div className="flex items-center justify-between px-3 pb-3 gap-2">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <div
                className="relative inline-flex rounded-xl p-0.5"
                style={{ background: "rgba(60,60,67,0.08)" }}
              >
                <div
                  className="absolute top-0.5 bottom-0.5 rounded-[10px] transition-all duration-300 ease-out"
                  style={{
                    left: chatMode === "direct" ? "0.125rem" : "50%",
                    width: "calc(50% - 0.25rem)",
                    background: "var(--rc-surface)",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)",
                  }}
                />
                {COPILOT_CHAT_MODE_OPTIONS.map((option) => {
                  const Icon = MODE_ICON[option.value];
                  const active = chatMode === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => onChatModeChange(option.value)}
                      className="relative inline-flex items-center gap-1.5 rounded-[10px] px-3 py-1 text-xs font-medium transition-colors duration-200 flex-shrink-0"
                      style={{ color: active ? "#007AFF" : "#636366" }}
                      title={option.description}
                    >
                      <Icon className="w-3 h-3 flex-shrink-0" />
                      <span>{option.label}</span>
                    </button>
                  );
                })}
              </div>

              <CopilotSkillPicker
                skills={skills}
                selectedSkillId={selectedSkillId}
                onSelectedSkillChange={onSelectedSkillChange}
                skillLocked={skillLocked}
                onSkillLockedChange={onSkillLockedChange}
              />

              <button
                type="button"
                onClick={() => void pickAttachments()}
                disabled={sending || uploadingAttachments}
                className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-medium transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50 flex-shrink-0"
                style={{ color: "#636366", background: "var(--rc-chip-bg)", boxShadow: "var(--rc-card-shadow)" }}
              >
                <Plus className="w-3 h-3" />
                {uploadingAttachments ? "读取文件中..." : "上传文件"}
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                if (sending) {
                  onCancel();
                  return;
                }
                void onSubmit();
              }}
              disabled={!sending && !canSubmit}
              aria-label={sending ? "终止生成" : "发送消息（⌘ / Ctrl + Enter）"}
              title={sending ? "终止生成" : "发送消息（⌘ / Ctrl + Enter）"}
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white transition-all duration-150 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: sending ? "#FF3B30" : "linear-gradient(145deg, #1A8AFF, #0062CC)",
                boxShadow: sending || canSubmit
                  ? sending
                    ? "2px 2px 7px rgba(215,45,38,0.28)"
                    : "3px 3px 8px rgba(0,62,204,0.35), -2px -2px 6px rgba(58,155,255,0.2)"
                  : "none",
              }}
            >
              {sending ? <Square className="w-3.5 h-3.5 fill-current" /> : <ArrowUp className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
