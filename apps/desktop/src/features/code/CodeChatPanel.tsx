import { useRef, type KeyboardEvent } from "react";
import { Loader2, Send, Sparkles, PanelTopClose, PanelTopOpen } from "lucide-react";
import { MarkdownRenderer } from "@research-copilot/ui";
import type { OpenCodeMessage } from "../../lib/client";

interface CodeChatPanelProps {
  messages: OpenCodeMessage[];
  streamingContent: string;
  sending: boolean;
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  currentFileName: string | null;
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
}: CodeChatPanelProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

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

      <div className="code-chat-panel__messages">
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
            ) : (
              <div className="code-chat-msg__assistant">
                <div className="code-chat-msg__assistant-avatar">
                  <Sparkles size={12} />
                </div>
                <div className="code-chat-msg__assistant-content">
                  <MarkdownRenderer content={msg.content} className="code-chat-md" />
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
                <MarkdownRenderer content={streamingContent} className="code-chat-md" />
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
        <div className={`code-chat-input-wrap ${sending ? "is-sending" : ""}`}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder="描述你的代码需求… Enter 发送 · Shift+Enter 换行"
            rows={1}
            className="code-chat-input"
            disabled={sending}
          />
          <button
            type="button"
            className={`code-chat-send-btn ${!input.trim() || sending ? "is-disabled" : ""}`}
            onClick={onSend}
            disabled={!input.trim() || sending}
            aria-label="发送"
          >
            {sending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Send size={14} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
