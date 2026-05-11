import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Bot, BrainCircuit, FileText, Paperclip, Plus, X, Zap } from "lucide-react";
import type { ChatMode, Skill } from "@research-copilot/types";
import {
  COPILOT_CHAT_MODE_OPTIONS,
  getCopilotInputPlaceholder,
} from "./shared";
import type { PendingCopilotAttachment } from "./useCopilotAttachments";

interface CopilotComposerProps {
  chatMode: ChatMode;
  onChatModeChange: (mode: ChatMode) => void;
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void | Promise<void>;
  sending: boolean;
  uploadingAttachments: boolean;
  attachments: PendingCopilotAttachment[];
  pickAttachments: () => void | Promise<void>;
  removeAttachment: (attachmentId: string) => void;
  skills: Skill[];
  selectedSkillId: string | null;
  onSelectedSkillChange: (skillId: string | null) => void;
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
  sending,
  uploadingAttachments,
  attachments,
  pickAttachments,
  removeAttachment,
  skills,
  selectedSkillId,
  onSelectedSkillChange,
}: CopilotComposerProps) {
  const [skillPickerOpen, setSkillPickerOpen] = useState(false);
  const [hoveredSkillId, setHoveredSkillId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const dragCounterRef = useRef(0);

  useEffect(() => {
    if (!skillPickerOpen) return undefined;

    const close = () => {
      setSkillPickerOpen(false);
      setHoveredSkillId(null);
    };

    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [skillPickerOpen]);

  const handleDragEnter = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounterRef.current += 1;
    if (event.dataTransfer.items && event.dataTransfer.items.length > 0) {
      setDragOver(true);
    }
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setDragOver(false);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounterRef.current = 0;
    setDragOver(false);
    // 文件路径由 Tauri onDragDropEvent 获取
  };

  const hoveredSkill = useMemo(
    () => skills.find((item) => item.id === hoveredSkillId) ?? null,
    [hoveredSkillId, skills],
  );
  const previewSkill = useMemo(() => {
    if (hoveredSkill) return hoveredSkill;
    if (selectedSkillId) {
      const selected = skills.find((item) => item.id === selectedSkillId);
      if (selected) return selected;
    }
    return skills[0] ?? null;
  }, [hoveredSkill, selectedSkillId, skills]);

  const canSubmit = (input.trim() || attachments.length > 0) && !sending && !uploadingAttachments;

  const attachmentIcon = (ext: string) => {
    if (ext === "pdf") return <FileText className="w-4 h-4 flex-shrink-0" />;
    return <Paperclip className="w-4 h-4 flex-shrink-0" />;
  };

  return (
    <div
      className="px-3 pb-3 pt-2 relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {dragOver && (
        <div
          className="absolute inset-0 z-30 rounded-2xl flex items-center justify-center"
          style={{
            background: "rgba(0,122,255,0.08)",
            border: "2px dashed #007AFF",
            pointerEvents: "none",
          }}
        >
          <span
            className="text-sm font-medium"
            style={{ color: "#007AFF" }}
          >
            释放以添加文件
          </span>
        </div>
      )}

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
                  {attachmentIcon(attachment.extension)}
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
          <div className="rounded-t-3xl overflow-hidden">
            <textarea
              rows={3}
              value={input}
              onChange={(event) => onInputChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void onSubmit();
                }
              }}
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

              <div className="relative">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setSkillPickerOpen((prev) => !prev);
                  }}
                  data-open={skillPickerOpen}
                  className="rc-dropdown-trigger inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-medium transition-all duration-150"
                  style={{ color: skillPickerOpen ? "#007AFF" : "#636366" }}
                >
                  <Zap className="w-3 h-3" />
                  技能
                </button>

                {skillPickerOpen && (
                  <div
                    onClick={(event) => event.stopPropagation()}
                    onMouseLeave={() => setHoveredSkillId(null)}
                    className="absolute bottom-full mb-2 left-0 z-20 flex items-start gap-2"
                  >
                    <div className="rc-dropdown-menu w-44 max-h-[420px] flex-shrink-0 overflow-y-auto rounded-2xl py-2">
                      <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-ink-tertiary">技能库</p>
                      <button
                        type="button"
                        onMouseEnter={() => setHoveredSkillId(null)}
                        onClick={() => {
                          onSelectedSkillChange(null);
                          setSkillPickerOpen(false);
                          setHoveredSkillId(null);
                        }}
                        className="w-full text-left px-3 py-2 text-xs transition-colors duration-100 flex items-center gap-2"
                        style={{
                          color: !selectedSkillId ? "#007AFF" : "var(--rc-text-soft)",
                          background: !selectedSkillId ? "rgba(0,122,255,0.08)" : "transparent",
                          fontWeight: !selectedSkillId ? 600 : 400,
                        }}
                      >
                        <X className="w-3 h-3 flex-shrink-0 opacity-50" />
                        不使用技能
                      </button>
                      {skills.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-ink-tertiary">暂无已启用技能</p>
                      ) : (
                        skills.map((skill) => (
                          <button
                            key={skill.id}
                            type="button"
                            onMouseEnter={() => setHoveredSkillId(skill.id)}
                            onClick={() => {
                              onSelectedSkillChange(skill.id);
                              setSkillPickerOpen(false);
                              setHoveredSkillId(null);
                            }}
                            className="w-full text-left px-3 py-2 text-xs transition-colors duration-100 flex items-center gap-2"
                            style={{
                              color: selectedSkillId === skill.id ? "#007AFF" : "var(--rc-text-soft)",
                              background: hoveredSkillId === skill.id || selectedSkillId === skill.id
                                ? "rgba(0,122,255,0.08)" : "transparent",
                              fontWeight: selectedSkillId === skill.id ? 600 : 400,
                            }}
                          >
                            <Zap className="w-3 h-3 flex-shrink-0 opacity-60" />
                            <span className="truncate">{skill.title}</span>
                          </button>
                        ))
                      )}
                    </div>

                    <div className="rc-dropdown-menu flex w-56 flex-shrink-0 flex-col gap-2 self-start rounded-2xl p-3">
                      {previewSkill ? (
                        <>
                          <div className="flex items-start gap-2">
                            <div className="w-7 h-7 rounded-xl flex-shrink-0 flex items-center justify-center mt-0.5"
                              style={{ background: "rgba(0,122,255,0.12)", color: "#007AFF" }}>
                              <Zap className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-ink-primary leading-tight">{previewSkill.title}</p>
                              <p className="text-[10px] font-mono text-ink-tertiary mt-0.5">/{previewSkill.name}</p>
                            </div>
                          </div>
                          {previewSkill.description ? (
                            <p className="text-[11px] leading-[1.6] text-ink-secondary">{previewSkill.description}</p>
                          ) : null}
                          {previewSkill.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {previewSkill.tags.map((tag) => (
                                <span key={tag} className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                                  style={{ background: "rgba(0,122,255,0.1)", color: "#007AFF" }}>{tag}</span>
                              ))}
                            </div>
                          )}
                          <div className="rounded-xl px-2.5 py-2 overflow-y-auto"
                            style={{ background: "rgba(0,0,0,0.04)", maxHeight: 160 }}>
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-tertiary mb-1">指令预览</p>
                            <p className="whitespace-pre-wrap break-words text-[11px] leading-[1.6] text-ink-secondary">{previewSkill.prompt}</p>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full gap-2 py-6 text-center">
                          <Zap className="w-6 h-6 text-ink-tertiary opacity-30" />
                          <p className="text-xs text-ink-tertiary">悬停技能查看详情</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {selectedSkillId && (() => {
                const skill = skills.find((item) => item.id === selectedSkillId);
                if (!skill) return null;
                return (
                  <div className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-medium flex-shrink-0"
                    style={{ background: "rgba(0,122,255,0.1)", color: "#007AFF" }}>
                    <Zap className="w-3 h-3" />
                    {skill.title}
                    <button type="button" onClick={() => onSelectedSkillChange(null)}
                      className="ml-0.5 hover:opacity-60 transition-opacity">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })()}

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
              onClick={() => void onSubmit()}
              disabled={!canSubmit}
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white transition-all duration-150 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: "linear-gradient(145deg, #1A8AFF, #0062CC)",
                boxShadow: canSubmit
                  ? "3px 3px 8px rgba(0,62,204,0.35), -2px -2px 6px rgba(58,155,255,0.2)"
                  : "none",
              }}
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
