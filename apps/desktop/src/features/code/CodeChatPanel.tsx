import { useEffect, useRef, type KeyboardEvent } from "react";
import { ArrowUp, ChevronDown, Loader2, Plus, Sparkles, PanelTopClose, PanelTopOpen } from "lucide-react";
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
}: CodeChatPanelProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const latestMessageKey = messages
    .map((msg) => `${msg.id}:${msg.content.length}:${msg.tool_calls?.length ?? 0}:${msg.tool_results?.length ?? 0}`)
    .join("|");

  useEffect(() => {
    const node = messagesRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
  }, [latestMessageKey, streamingContent, sending]);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
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
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder={'随便问点什么… "创建一个 CLI 命令用于…"'}
            rows={2}
            className="code-chat-input"
            disabled={sending}
          />

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

              <label className="code-chat-model-select" aria-label="切换模型">
                <span className="code-chat-model-select__prefix">模型</span>
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
