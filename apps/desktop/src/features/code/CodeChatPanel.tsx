import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ArrowUp, ChevronDown, Loader2, Lock, LockOpen, Plus, Sparkles, PanelTopClose, PanelTopOpen, X, Zap } from "lucide-react";
import type { Skill } from "@research-copilot/types";
import type { CodeMessage } from "../../lib/client";
import { codeToolLabel } from "./shared";
import type { CodeModelOption } from "./shared";
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
  skills = [],
  selectedSkillId = null,
  onSelectedSkillChange,
  skillLocked = false,
  onSkillLockedChange,
}: CodeChatPanelProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const [slashIndex, setSlashIndex] = useState(0);
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

  function selectSlashSkill(skillId: string) {
    onSelectedSkillChange?.(skillId);
    onInputChange("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (slashOpen) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashIndex((i) => (i + 1) % slashMatches.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashIndex((i) => (i - 1 + slashMatches.length) % slashMatches.length);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const skill = slashMatches[slashIndex];
        if (skill) selectSlashSkill(skill.id);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        onInputChange("");
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
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

      <div className="code-chat-panel__input-area">
        <div className={`code-chat-composer ${sending ? "is-sending" : ""}`}>
          <div className="relative flex-1 flex flex-col">
            {slashOpen && (
              <div
                className="code-chat-slash-dropdown"
                onMouseDown={(event) => event.preventDefault()}
              >
                <p className="code-chat-slash-dropdown__label">技能 · 回车选择</p>
                {slashMatches.map((skill, index) => (
                  <button
                    key={skill.id}
                    type="button"
                    onMouseEnter={() => setSlashIndex(index)}
                    onClick={() => selectSlashSkill(skill.id)}
                    className={`code-chat-slash-dropdown__item ${index === slashIndex ? "is-active" : ""}`}
                  >
                    <Zap size={12} className={index === slashIndex ? "text-blue-500" : "opacity-50"} />
                    <span className="code-chat-slash-dropdown__item-text">
                      <span className="code-chat-slash-dropdown__item-title">{skill.title}</span>
                      <span className="code-chat-slash-dropdown__item-name">/{skill.name}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onInput={handleInput}
              placeholder={selectedSkillId ? "输入内容，将与技能指令一起发送…" : '随便问点什么… 输入 "/" 唤起技能'}
              rows={2}
              className="code-chat-input"
              disabled={sending}
            />
          </div>

          <div className="code-chat-composer__toolbar">
            <div className="code-chat-composer__toolbar-left">
              <button
                type="button"
                className="code-chat-attach-btn"
                onClick={onAddFile}
                aria-label="添加文件"
                title={currentFileName ? `当前文件：${currentFileName}` : "添加文件"}
              >
                <Plus size={16} />
              </button>

              {selectedSkillId && (() => {
                const skill = skills.find((item) => item.id === selectedSkillId);
                if (!skill) return null;
                return (
                  <div className="code-chat-skill-chip">
                    <Zap size={12} />
                    <span>{skill.title}</span>
                    <button
                      type="button"
                      onClick={() => onSkillLockedChange?.(!skillLocked)}
                      title={skillLocked ? "已锁定：连续多轮生效，点击解除" : "默认仅本条生效，点击锁定以连续使用"}
                      className="code-chat-skill-chip__lock"
                      style={{ opacity: skillLocked ? 1 : 0.55 }}
                    >
                      {skillLocked ? <Lock size={11} /> : <LockOpen size={11} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectedSkillChange?.(null);
                        onSkillLockedChange?.(false);
                      }}
                      title="移除技能"
                      className="code-chat-skill-chip__close"
                    >
                      <X size={11} />
                    </button>
                  </div>
                );
              })()}

              <label className="code-chat-model-select" aria-label="切换模型">
                <select
                  value={activeModelOptionId}
                  onChange={(e) => onModelOptionChange(e.target.value)}
                  disabled={modelOptions.length === 0}
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
                <ChevronDown size={14} className="code-chat-model-select__chevron" />
              </label>
            </div>

            <button
              type="button"
              className={`code-chat-send-btn ${!input.trim() || sending ? "is-disabled" : ""}`}
              onClick={onSend}
              disabled={!input.trim() || sending}
              aria-label="发送"
            >
              {sending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <ArrowUp size={16} />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
