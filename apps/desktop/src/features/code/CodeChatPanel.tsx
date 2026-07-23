import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Check, ChevronDown, ChevronRight, Copy, FolderOpen, Lock, LockOpen, Pencil, Sparkles, PanelTopClose, PanelTopOpen, Square, X, Zap } from "lucide-react";
import type { Skill } from "@research-copilot/types";
import type { CodeMessage, CodeToolResult } from "../../lib/client";
import { useResizableHeight } from "../../hooks/useResizableHeight";
import { codeToolLabel, CODE_MODES, CODE_MODE_MAP } from "./shared";
import type { CodeAgentMode, CodeFileAttachment, CodeModelOption } from "./shared";
import CodeAssistantMessage from "./CodeAssistantMessage";
import CodeChatContextControls from "./CodeChatContextControls";
import { CodeTaskSummary } from "./CodeTaskSummary";
import { CodeToolActionLine } from "./CodeToolMessage";

interface CodeChatPanelProps {
  messages: CodeMessage[];
  streamingContent: string;
  sending: boolean;
  taskStartedAt?: number | null;
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onEditMessage?: (messageId: string, newText: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  currentFileName: string | null;
  currentModel: string;
  modelOptions: CodeModelOption[];
  activeModelOptionId: string;
  onModelOptionChange: (optionId: string) => void;
  workingDir?: string | null;
  recentWorkingDirs?: string[];
  onChooseWorkingDir?: () => void;
  onChangeWorkingDir?: (dir: string | null) => void;
  agentMode?: CodeAgentMode;
  onAgentModeChange?: (mode: CodeAgentMode) => void;
  attachments?: CodeFileAttachment[];
  onRemoveAttachment?: (id: string) => void;
  contextStats?: { files: number; instructions: number; scripts: number; chars: number } | null;
  skills?: Skill[];
  selectedSkillId?: string | null;
  onSelectedSkillChange?: (id: string | null) => void;
  skillLocked?: boolean;
  onSkillLockedChange?: (locked: boolean) => void;
  onStop?: () => void;
}

export default function CodeChatPanel({
  messages,
  streamingContent,
  sending,
  taskStartedAt,
  input,
  onInputChange,
  onSend,
  onEditMessage,
  collapsed,
  onToggleCollapse,
  currentFileName,
  currentModel,
  modelOptions,
  activeModelOptionId,
  onModelOptionChange,
  workingDir,
  recentWorkingDirs = [],
  onChooseWorkingDir,
  onChangeWorkingDir,
  agentMode = "build",
  onAgentModeChange,
  attachments = [],
  onRemoveAttachment,
  contextStats = null,
  skills = [],
  selectedSkillId = null,
  onSelectedSkillChange,
  skillLocked = false,
  onSkillLockedChange,
  onStop,
}: CodeChatPanelProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const [slashIndex, setSlashIndex] = useState(0);
  const [modePickerOpen, setModePickerOpen] = useState(false);
  const [dirMenuOpen, setDirMenuOpen] = useState(false);
  const [recentSubmenuOpen, setRecentSubmenuOpen] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const dirMenuRef = useRef<HTMLDivElement>(null);
  const { height: composerHeight, onDragStart } = useResizableHeight({
    initialHeight: 132,
    minHeight: 80,
    maxHeight: 360,
    persistentKey: "codeComposerHeight",
  });

  useEffect(() => {
    if (!dirMenuOpen) {
      setRecentSubmenuOpen(false);
      return;
    }
    function handlePointerDown(event: MouseEvent) {
      if (!dirMenuRef.current?.contains(event.target as Node)) {
        setDirMenuOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [dirMenuOpen]);

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
      onSend();
    }
  }

  function handleEditInput(e: React.FormEvent<HTMLTextAreaElement>) {
    const t = e.currentTarget;
    t.style.height = "auto";
    t.style.height = Math.min(t.scrollHeight, 200) + "px";
  }

  async function handleCopy(text: string, messageId: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 1500);
    } catch {
      // ignore
    }
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
            <img
              src="/illustrations/xiaoyan-code-assistant.png"
              alt="小妍正在编写代码"
              className="code-chat-panel__empty-illustration"
            />
            <p>描述你的代码需求，我来帮你写代码、调试或解释</p>
          </div>
        )}

        {messages.map((msg) => {
          // 把 tool 结果按 call_id 收集，便于单行合并 call+result。
          // 这里不需要 useMemo：聊天面板的消息规模通常 < 100，扁平扫一次可忽略不计；
          // 若将来成为热点再加 useMemo。
          const resultsByCallId = new Map<string, CodeToolResult>();
          for (const result of msg.tool_results ?? []) {
            resultsByCallId.set(result.tool_call_id, result);
          }
          // 旧实现里 role==="tool" 的消息单独渲染 result card。
          // 新版把 call + result 合并到 assistant 消息的同一行，所以这里跳过 tool 消息。
          if (msg.role === "tool") return null;

          return (
            <div key={msg.id} className={`code-chat-msg code-chat-msg--${msg.role}`}>
              {msg.role === "user" ? (() => {
                const isEditing = editingMessageId === msg.id;
                return (
                  <div className="code-chat-msg__user group">
                    <div className="code-chat-msg__user-avatar">你</div>
                    <div
                      className="code-chat-msg__user-content"
                      style={isEditing ? { background: "transparent", boxShadow: "none", padding: 0 } : undefined}
                    >
                      {isEditing ? (
                        <textarea
                          rows={3}
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              onEditMessage?.(msg.id, editText);
                            }
                            if (e.key === "Escape") {
                              setEditingMessageId(null);
                              setEditText("");
                            }
                          }}
                          onInput={handleEditInput}
                          className="w-full rounded-2xl px-3 py-2 text-xs text-ink-primary outline-none border-0 resize-none"
                          style={{ background: "var(--rc-surface)", boxShadow: "var(--rc-inset-shadow)" }}
                          autoFocus
                        />
                      ) : (
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                      )}
                    </div>
                    {isEditing ? (
                      <div className="flex justify-end gap-1 mt-1">
                        <button
                          type="button"
                          onClick={() => { setEditingMessageId(null); setEditText(""); }}
                          className="rounded-lg px-2 py-1 text-[11px] transition-colors"
                          style={{ color: "var(--rc-text-tertiary)" }}
                        >
                          取消
                        </button>
                        <button
                          type="button"
                          onClick={() => onEditMessage?.(msg.id, editText)}
                          disabled={!editText.trim() || sending}
                          className="rounded-lg px-2 py-1 text-[11px] font-medium transition-colors disabled:opacity-40"
                          style={{ color: "#FFFFFF", background: "#007AFF" }}
                        >
                          保存并发送
                        </button>
                      </div>
                    ) : (
                      !sending && onEditMessage && (
                        <div className="flex justify-end gap-0.5 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => handleCopy(msg.content, msg.id)}
                            aria-label={copiedMessageId === msg.id ? "已复制" : "复制消息"}
                            title={copiedMessageId === msg.id ? "已复制" : "复制消息"}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] transition-colors"
                            style={{ color: "var(--rc-text-tertiary)" }}
                          >
                            {copiedMessageId === msg.id ? (
                              <Check className="w-3 h-3" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setEditingMessageId(msg.id); setEditText(msg.content); }}
                            aria-label="编辑消息"
                            title="编辑消息"
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] transition-colors"
                            style={{ color: "var(--rc-text-tertiary)" }}
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        </div>
                      )
                    )}
                  </div>
                );
              })() : (
                <div className="code-chat-msg__assistant">
                  <div className="code-chat-msg__assistant-avatar">
                    <Sparkles size={12} />
                  </div>
                  <div className="code-chat-msg__assistant-content">
                    {msg.content && <CodeAssistantMessage content={msg.content} />}
                    {msg.tool_calls?.map((toolCall) => {
                      const result = resultsByCallId.get(toolCall.id);
                      // 还在执行中（assistant 已发出调用但 tool 消息尚未到达）显示 pending
                      const pending = !result && sending;
                      return (
                        <CodeToolActionLine
                          key={toolCall.id}
                          toolCall={toolCall}
                          result={result}
                          pending={pending}
                        />
                      );
                    })}
                    {msg.tool_id && (
                      <div className="code-chat-msg__meta">
                        {codeToolLabel(msg.tool_id)}
                        {msg.model ? ` · ${msg.model}` : ""}
                      </div>
                    )}
                    <CodeTaskSummary durationMs={msg.duration_ms} />
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {sending && streamingContent && (
          <div className="code-chat-msg code-chat-msg--assistant">
            <div className="code-chat-msg__assistant">
              <div className="code-chat-msg__assistant-avatar">
                <Sparkles size={12} />
              </div>
              <div className="code-chat-msg__assistant-content">
                <CodeAssistantMessage content={streamingContent} streaming />
                <span className="code-chat-cursor" />
                <CodeTaskSummary startedAt={taskStartedAt} running />
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
              <CodeTaskSummary startedAt={taskStartedAt} running />
            </div>
          </div>
        )}
      </div>

      {/* Composer — aligned with CopilotComposer (except mode toggle) */}
      <div className="code-chat-panel__input-area">
        <div
          className="rounded-3xl flex flex-col"
          style={{
            height: composerHeight,
            background: "var(--rc-surface)",
            boxShadow: "var(--rc-inset-shadow)",
          }}
        >
          {/* 拖拽调整高度 */}
          <div
            onMouseDown={onDragStart}
            className="h-1.5 w-full cursor-ns-resize rounded-t-3xl flex items-center justify-center flex-shrink-0 group/handle"
            title="拖拽调整输入框高度"
            aria-label="拖拽调整输入框高度"
            role="slider"
            aria-orientation="vertical"
          >
            <div
              className="w-8 h-1 rounded-full opacity-50 transition-colors group-hover/handle:opacity-100"
              style={{ background: "var(--rc-border)" }}
            />
          </div>
          <div className="relative overflow-visible flex-1 min-h-0">
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
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={selectedSkillId ? "输入内容，将与技能指令一起发送 · ⌘/Ctrl + ↵ 发送" : '让小妍做点什么… 输入 "/" 唤起技能 · ⌘/Ctrl + ↵ 发送'}
              className="w-full h-full px-5 pt-3.5 pb-2 text-sm text-ink-primary placeholder:text-ink-tertiary outline-none border-0 resize-none"
              style={{ background: "transparent" }}
              disabled={sending}
            />
          </div>

          <div className="flex items-center justify-between px-3 pb-3 gap-2 flex-shrink-0">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <div className="relative" ref={dirMenuRef}>
                <button
                  type="button"
                  onClick={() => setDirMenuOpen((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-medium transition-all duration-150 flex-shrink-0 max-w-[160px]"
                  style={{ color: workingDir ? "#636366" : "#007AFF", background: "var(--rc-chip-bg)", boxShadow: "var(--rc-chip-shadow)" }}
                  title={workingDir || "点击选择工作目录"}
                >
                  <FolderOpen className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{workingDir ? (workingDir.split(/[/\\]/).pop() || workingDir) : "选择目录"}</span>
                  <ChevronDown className="w-3 h-3 flex-shrink-0" style={{ transform: dirMenuOpen ? "rotate(180deg)" : "rotate(0deg)" }} />
                </button>

                {dirMenuOpen && (
                  <div
                    className="rc-dropdown-menu absolute bottom-full mb-2 left-0 z-20 min-w-[180px] rounded-2xl py-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setRecentSubmenuOpen((prev) => !prev)}
                        className="w-full text-left px-3 py-2 text-xs transition-colors duration-100 flex items-center justify-between gap-2"
                        style={{ color: "var(--rc-text-soft)" }}
                        aria-expanded={recentSubmenuOpen}
                        aria-haspopup="menu"
                      >
                        <span className="flex items-center gap-2">
                          <FolderOpen className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>最近项目</span>
                        </span>
                        <ChevronRight
                          className={`w-3 h-3 flex-shrink-0 transition-transform duration-150 ${recentSubmenuOpen ? "rotate-90" : ""}`}
                          style={{ color: "var(--rc-text-muted)" }}
                        />
                      </button>
                      {recentSubmenuOpen && (
                        <div
                          className="rc-dropdown-menu absolute left-full bottom-0 mb-0 ml-1 z-30 min-w-[180px] max-h-72 overflow-y-auto rounded-2xl py-1"
                        >
                          {recentWorkingDirs.length > 0 ? (
                            recentWorkingDirs.map((dir) => (
                              <button
                                key={dir}
                                type="button"
                                onClick={() => {
                                  onChangeWorkingDir?.(dir);
                                  setRecentSubmenuOpen(false);
                                  setDirMenuOpen(false);
                                }}
                                className="w-full text-left px-3 py-2 text-xs transition-colors duration-100 flex items-center gap-2"
                                style={{ color: dir === workingDir ? "#007AFF" : "var(--rc-text-soft)", background: dir === workingDir ? "rgba(0,122,255,0.08)" : "transparent" }}
                                title={dir}
                              >
                                <FolderOpen className="w-3.5 h-3.5 flex-shrink-0" />
                                <span className="truncate">{dir.split(/[/\\]/).pop() || dir}</span>
                              </button>
                            ))
                          ) : (
                            <div className="px-3 py-2 text-xs text-ink-tertiary">暂无最近项目</div>
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onChooseWorkingDir?.();
                        setRecentSubmenuOpen(false);
                        setDirMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs transition-colors duration-100 flex items-center gap-2"
                      style={{ color: "var(--rc-text-soft)" }}
                    >
                      <FolderOpen className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>使用现有文件夹</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onChangeWorkingDir?.(null);
                        setRecentSubmenuOpen(false);
                        setDirMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs transition-colors duration-100 flex items-center gap-2"
                      style={{ color: "var(--rc-text-soft)" }}
                    >
                      <span className="w-3.5 h-3.5 flex-shrink-0 flex items-center justify-center text-ink-tertiary">—</span>
                      <span>不使用文件夹</span>
                    </button>
                  </div>
                )}
              </div>

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

              <CodeChatContextControls
                attachments={attachments}
                contextStats={contextStats}
                onRemoveAttachment={onRemoveAttachment}
              />

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
              onClick={() => { if (sending) { onStop?.(); } else { onSend(); } }}
              disabled={sending ? false : !input.trim()}
              aria-label={sending ? "终止生成" : "发送消息（⌘ / Ctrl + Enter）"}
              title={sending ? "终止生成" : "发送消息（⌘ / Ctrl + Enter）"}
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white transition-all duration-150 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: sending
                  ? "#FF3B30"
                  : "linear-gradient(145deg, #1A8AFF, #0062CC)",
                boxShadow: sending
                  ? "3px 3px 8px rgba(255,59,48,0.35), -2px -2px 6px rgba(255,100,80,0.2)"
                  : input.trim()
                    ? "3px 3px 8px rgba(0,62,204,0.35), -2px -2px 6px rgba(58,155,255,0.2)"
                    : "none",
              }}
            >
              {sending ? (
                <Square className="w-3.5 h-3.5" />
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
