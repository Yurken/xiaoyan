import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, ChevronDown, FileText, FolderOpen, Loader2, Lock, LockOpen, Plus, Sparkles, PanelTopClose, PanelTopOpen, X, Zap } from "lucide-react";
import type { Skill } from "@research-copilot/types";
import type { CodeMessage } from "../../lib/client";
import { codeToolLabel, CODE_MODES, CODE_MODE_MAP } from "./shared";
import type { CodeAgentMode, CodeFileAttachment, CodeModelOption } from "./shared";
import CodeAssistantMessage from "./CodeAssistantMessage";
import { CodeToolCallCard, CodeToolResultCard } from "./CodeToolMessage";

interface CodeChatPanelProps {
  messages: CodeMessage[];
  streamingContent: string;
  sending: boolean;
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  currentFileName: string | null;
  currentModel: string;
  modelOptions: CodeModelOption[];
  activeModelOptionId: string;
  onModelOptionChange: (optionId: string) => void;
  onAddFile: () => void;
  workingDir?: string | null;
  onChooseWorkingDir?: () => void;
  agentMode?: CodeAgentMode;
  onAgentModeChange?: (mode: CodeAgentMode) => void;
  attachments?: CodeFileAttachment[];
  onPickAttachments?: () => void;
  onRemoveAttachment?: (id: string) => void;
  skills?: Skill[];
  selectedSkillId?: string | null;
  onSelectedSkillChange?: (id: string | null) => void;
  skillLocked?: boolean;
  onSkillLockedChange?: (locked: boolean) => void;
}

export default function CodeChatPanel({
  messages,
  streamingContent,
  sending,
  input,
  onInputChange,
  onSend,
  collapsed,
  onToggleCollapse,
  currentFileName,
  currentModel,
  modelOptions,
  activeModelOptionId,
  onModelOptionChange,
  onAddFile,
  workingDir,
  onChooseWorkingDir,
  agentMode = "build",
  onAgentModeChange,
  attachments = [],
  onPickAttachments,
  onRemoveAttachment,
  skills = [],
  selectedSkillId = null,
  onSelectedSkillChange,
  skillLocked = false,
  onSkillLockedChange,
}: CodeChatPanelProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const [slashIndex, setSlashIndex] = useState(0);
  const [modePickerOpen, setModePickerOpen] = useState(false);

  const latestMessageKey = messages
    .map((msg) => `${msg.id}:${msg.content.length}:${msg.tool_calls?.length ?? 0}:${msg.tool_results?.length ?? 0}`)
    .join("|");

  useEffect(() => {
    const node = messagesRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
  }, [latestMessageKey, streamingContent, sending]);

  // ── Slash command ──────────────────────────────────────────
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
    onSelectedSkillChange?.(skillId);
    onInputChange("");
  };

  useEffect(() => {
    if (!modePickerOpen) return undefined;
    const close = () => setModePickerOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [modePickerOpen]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
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
      if (event.key === "Enter" || event.key === "Tab") {
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
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSend();
    }
  }

  function handleInput(e: React.FormEvent<HTMLTextAreaElement>) {
    const t = e.currentTarget;
    t.style.height = "auto";
    t.style.height = Math.min(t.scrollHeight, 120) + "px";
  }

  if (collapsed) {
    return (
      <div className="code-chat-collapsed">
        <button
          type="button"
          className="code-chat-collapsed__btn"
          onClick={onToggleCollapse}
        >
          <PanelTopOpen size={14} />
          <span>展开 AI 助手</span>
          {currentFileName && (
            <span className="code-chat-collapsed__context">· {currentFileName}</span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="code-chat-panel">
      <div className="code-chat-panel__header">
        <div className="code-chat-panel__header-left">
          <Sparkles size={14} className="code-chat-panel__header-icon" />
          <span>AI 助手</span>
          {currentFileName && (
            <span className="code-chat-panel__context" title="当前基于打开的文件进行对话">
              · {currentFileName}
            </span>
          )}
        </div>
        <button
          type="button"
          className="code-chat-panel__collapse-btn"
          onClick={onToggleCollapse}
          title="收起"
        >
          <PanelTopClose size={14} />
        </button>
      </div>

      <div ref={messagesRef} className="code-chat-panel__messages">
        {messages.length === 0 && !streamingContent && (
          <div className="code-chat-panel__empty">
            <Sparkles size={20} />
            <p>描述你的代码需求，我来帮你写代码、调试或解释</p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`code-chat-msg code-chat-msg--${msg.role}`}>
            {msg.role === "user" ? (
              <div className="code-chat-msg__user">
                <div className="code-chat-msg__user-avatar">你</div>
                <div className="code-chat-msg__user-content">{msg.content}</div>
              </div>
            ) : msg.role === "tool" ? (
              <div className="code-chat-msg__assistant">
                <div className="code-chat-msg__assistant-avatar">
                  <Sparkles size={12} />
                </div>
                <div className="code-chat-msg__assistant-content">
                  {msg.tool_results?.map((result) => (
                    <CodeToolResultCard key={result.tool_call_id} result={result} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="code-chat-msg__assistant">
                <div className="code-chat-msg__assistant-avatar">
                  <Sparkles size={12} />
                </div>
                <div className="code-chat-msg__assistant-content">
                  {msg.content && <CodeAssistantMessage content={msg.content} />}
                  {msg.tool_calls?.map((toolCall) => (
                    <CodeToolCallCard key={toolCall.id} toolCall={toolCall} />
                  ))}
                  {msg.tool_id && (
                    <div className="code-chat-msg__meta">
                      {codeToolLabel(msg.tool_id)}
                      {msg.model ? ` · ${msg.model}` : ""}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {sending && streamingContent && (
          <div className="code-chat-msg code-chat-msg--assistant">
            <div className="code-chat-msg__assistant">
              <div className="code-chat-msg__assistant-avatar">
                <Sparkles size={12} />
              </div>
              <div className="code-chat-msg__assistant-content">
                <CodeAssistantMessage content={streamingContent} streaming />
                <span className="code-chat-cursor" />
              </div>
            </div>
          </div>
        )}

        {sending && !streamingContent && (
          <div className="code-chat-msg code-chat-msg--thinking">
            <div className="code-chat-msg__assistant">
              <div className="code-chat-msg__assistant-avatar">
                <Sparkles size={12} />
              </div>
              <div className="code-chat-thinking">
                <span className="code-chat-thinking__dot" />
                <span className="code-chat-thinking__dot" />
                <span className="code-chat-thinking__dot" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Composer — aligned with CopilotComposer (except mode toggle) */}
      <div className="code-chat-panel__input-area">
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
              ref={inputRef}
              rows={3}
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onInput={handleInput}
              placeholder={selectedSkillId ? "输入内容，将与技能指令一起发送…" : '让小妍做点什么… 输入 "/" 唤起技能'}
              className="w-full px-5 pt-4 pb-2 text-sm text-ink-primary placeholder:text-ink-tertiary outline-none border-0 resize-none"
              style={{ background: "transparent" }}
              disabled={sending}
            />
          </div>

          <div className="flex items-center justify-between px-3 pb-3 gap-2">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <button
                type="button"
                onClick={onChooseWorkingDir}
                className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-medium transition-all duration-150 flex-shrink-0 max-w-[160px]"
                style={{ color: workingDir ? "#636366" : "#007AFF", background: "var(--rc-chip-bg)", boxShadow: "var(--rc-chip-shadow)" }}
                title={workingDir || "点击选择工作目录"}
              >
                <FolderOpen className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{workingDir ? (workingDir.split(/[/\\]/).pop() || workingDir) : "选择目录"}</span>
              </button>

              <div className="relative">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setModePickerOpen((prev) => !prev);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-medium transition-all duration-150 flex-shrink-0"
                  style={{ color: "#636366", background: "var(--rc-chip-bg)", boxShadow: "var(--rc-chip-shadow)" }}
                  title={CODE_MODE_MAP[agentMode].description}
                >
                  {(() => {
                    const ModeIcon = CODE_MODE_MAP[agentMode].icon;
                    return <ModeIcon className="w-3 h-3" />;
                  })()}
                  <span>{CODE_MODE_MAP[agentMode].label}</span>
                </button>

                {modePickerOpen && (
                  <div
                    className="rc-dropdown-menu absolute bottom-full mb-2 left-0 z-20 w-56 rounded-2xl py-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-ink-tertiary">模式</p>
                    {CODE_MODES.map((mode) => {
                      const active = agentMode === mode.id;
                      const ModeIcon = mode.icon;
                      return (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => {
                            onAgentModeChange?.(mode.id);
                            setModePickerOpen(false);
                          }}
                          className="w-full text-left px-3 py-2 text-xs transition-colors duration-100 flex items-start gap-2"
                          style={{
                            color: active ? "#007AFF" : "var(--rc-text-soft)",
                            background: active ? "rgba(0,122,255,0.08)" : "transparent",
                          }}
                        >
                          <ModeIcon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                          <span className="min-w-0 flex-1">
                            <span className="block font-medium">{mode.label}</span>
                            <span className="block text-[10px] text-ink-tertiary mt-0.5">{mode.description}</span>
                          </span>
                          {mode.readOnly && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-orange-500/10 text-orange-500 flex-shrink-0">只读</span>
                          )}
                          {mode.confirmWrites && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-yellow-500/10 text-yellow-600 flex-shrink-0">需确认</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <button
                type="button"
                className="code-chat-attach-btn"
                onClick={onPickAttachments ?? onAddFile}
                aria-label="添加文件"
                title="添加文件作为上下文"
              >
                <Plus size={16} />
              </button>

              {attachments.length > 0 && attachments.map((att) => (
                <div
                  key={att.id}
                  className="inline-flex items-center gap-1 rounded-xl px-2 py-0.5 text-[11px] font-medium flex-shrink-0 max-w-[140px] group"
                  style={{ background: "rgba(0,122,255,0.08)", color: "#007AFF" }}
                  title={att.path}
                >
                  <FileText className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{att.name}</span>
                  <button
                    type="button"
                    onClick={() => onRemoveAttachment?.(att.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity hover:opacity-60 flex-shrink-0"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}

              {selectedSkillId && (() => {
                const skill = skills.find((item) => item.id === selectedSkillId);
                if (!skill) return null;
                return (
                  <div className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-medium flex-shrink-0"
                    style={{ background: "rgba(0,122,255,0.1)", color: "#007AFF" }}>
                    <Zap className="w-3 h-3" />
                    {skill.title}
                    <button
                      type="button"
                      onClick={() => onSkillLockedChange?.(!skillLocked)}
                      title={skillLocked ? "已锁定：连续多轮生效，点击解除" : "默认仅本条生效，点击锁定以连续使用"}
                      aria-label={skillLocked ? "解除技能锁定" : "锁定技能"}
                      aria-pressed={skillLocked}
                      className="ml-0.5 transition-opacity hover:opacity-60"
                      style={{ opacity: skillLocked ? 1 : 0.55 }}
                    >
                      {skillLocked ? <Lock className="w-3 h-3" /> : <LockOpen className="w-3 h-3" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectedSkillChange?.(null);
                        onSkillLockedChange?.(false);
                      }}
                      title="移除技能"
                      className="hover:opacity-60 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })()}

              <div className="relative inline-flex items-center rounded-xl flex-shrink-0"
                style={{ background: "var(--rc-chip-bg)", boxShadow: "var(--rc-chip-shadow)" }}>
                <select
                  value={activeModelOptionId}
                  onChange={(e) => onModelOptionChange(e.target.value)}
                  disabled={modelOptions.length === 0}
                  className="appearance-none bg-transparent pl-2.5 pr-7 py-1 text-xs font-medium outline-none cursor-pointer"
                  style={{ color: "var(--rc-text-soft)", maxWidth: 140 }}
                >
                  {modelOptions.length === 0 ? (
                    <option value="">{currentModel || "默认模型"}</option>
                  ) : (
                    modelOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))
                  )}
                </select>
                <ChevronDown className="absolute right-2 pointer-events-none w-3 h-3" style={{ color: "var(--rc-text-muted)" }} />
              </div>
            </div>

            <button
              onClick={() => onSend()}
              disabled={!input.trim() || sending}
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white transition-all duration-150 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: "linear-gradient(145deg, #1A8AFF, #0062CC)",
                boxShadow: input.trim() && !sending
                  ? "3px 3px 8px rgba(0,62,204,0.35), -2px -2px 6px rgba(58,155,255,0.2)"
                  : "none",
              }}
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowUp className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
