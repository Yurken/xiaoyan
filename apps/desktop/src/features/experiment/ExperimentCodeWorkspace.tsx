import { useEffect, useState } from "react";
import {
  Loader2,
  Plus,
  Trash2,
  Code2,
  FolderOpen,
  MessageSquare,
  ChevronRight,
  ChevronDown,
  PanelRight,
  TerminalSquare,
  Globe2,
  Files,
  ClipboardCheck,
  Bot,
  GitBranch,
} from "lucide-react";
import type { ExperimentCodeSession } from "@research-copilot/types";
import { useCodeWorkspace } from "../code/useCodeWorkspace";
import CodeFileTree from "../code/CodeFileTree";
import CodeEditor from "../code/CodeEditor";
import CodeChatPanel from "../code/CodeChatPanel";
import { codeToolLabel } from "../code/shared";

interface ExperimentCodeWorkspaceProps {
  experimentId: string;
  onActiveSessionChange?: (session: ExperimentCodeSession | null) => void;
}

export function ExperimentCodeWorkspace({ experimentId, onActiveSessionChange }: ExperimentCodeWorkspaceProps) {
  const ws = useCodeWorkspace(experimentId);

  useEffect(() => {
    onActiveSessionChange?.(ws.selected);
  }, [ws.selected, onActiveSessionChange]);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [showSessions, setShowSessions] = useState(true);

  async function onConfirmDelete() {
    if (!pendingDeleteId) return;
    await ws.handleDeleteSession(pendingDeleteId);
    setPendingDeleteId(null);
  }

  const assistantLabel = "小妍代码助手";
  const workspaceName = ws.workingDir
    ? ws.workingDir.split(/[/\\]/).pop() || ws.workingDir
    : "未选择工作目录";

  return (
    <div className="code-root code-root--codex">
      <aside className="code-sidebar code-sidebar--codex is-open">
        <div className="code-sidebar__header">
          <div className="code-sidebar__brand">
            <Code2 size={16} className="code-sidebar__brand-icon" />
            <span>实验代码</span>
          </div>
          <button
            type="button"
            className="code-sidebar__new-icon"
            onClick={ws.handleCreateSession}
            title="新建会话"
            aria-label="新建会话"
          >
            <Plus size={14} />
          </button>
        </div>

        <div className="code-sidebar__section">
          <button
            type="button"
            className="code-sidebar__dir-btn"
            onClick={ws.chooseWorkingDir}
            title={ws.workingDir ?? "选择工作目录"}
          >
            <FolderOpen size={14} />
            <span className="code-sidebar__dir-label">
              {ws.workingDir
                ? ws.workingDir.split(/[/\\]/).pop() || ws.workingDir
                : "选择工作目录"}
            </span>
          </button>
        </div>

        <button
          type="button"
          className="code-sidebar__toggle"
          onClick={() => setShowSessions((v) => !v)}
        >
          {showSessions ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <MessageSquare size={14} />
          <span>会话列表</span>
          <span className="code-sidebar__toggle-badge">{ws.sessions.length}</span>
        </button>

        {showSessions && (
          <div className="code-sidebar__session-list">
            <button
              type="button"
              className="code-sidebar__new"
              onClick={ws.handleCreateSession}
            >
              <Plus size={14} />
              <span>新建会话</span>
            </button>

            {ws.chatLoading ? (
              <div className="code-sidebar__empty">
                <Loader2 size={16} className="animate-spin" />
              </div>
            ) : ws.sessions.length === 0 ? (
              <div className="code-sidebar__empty">
                <span>暂无会话</span>
              </div>
            ) : (
              ws.sessions.map((s) => (
                <div
                  key={s.id}
                  className={`code-sidebar__item ${s.id === ws.selectedId ? "is-active" : ""}`}
                >
                  <button
                    type="button"
                    className="code-sidebar__item-main"
                    onClick={() => ws.selectSession(s)}
                  >
                    <div className="code-sidebar__item-text">
                      <span className="code-sidebar__item-title">{s.title}</span>
                      <span className="code-sidebar__item-meta">
                        {new Date(s.updated_at).toLocaleDateString("zh-CN", { month: "short", day: "numeric" })}
                        {s.messages.length > 0 && ` · ${s.messages.length} 条`}
                        {s.tool_id && ` · ${codeToolLabel(s.tool_id)}`}
                      </span>
                    </div>
                  </button>
                  <button
                    type="button"
                    className="code-sidebar__item-del"
                    onClick={() => setPendingDeleteId(s.id)}
                    aria-label="删除"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        <div className="code-sidebar__project-card">
          <div className="code-sidebar__project-title">{workspaceName}</div>
          <div className="code-sidebar__project-meta">
            <GitBranch size={12} />
            <span>实验分支 · {assistantLabel}</span>
          </div>
        </div>
      </aside>

      <main className="code-codex-main">
        <div className="code-codex-conversation">
          <CodeChatPanel
            messages={ws.selected?.messages ?? []}
            streamingContent={ws.streamingContent}
            sending={ws.sending}
            input={ws.input}
            onInputChange={ws.setInput}
            onSend={ws.handleSend}
            collapsed={ws.chatCollapsed}
            onToggleCollapse={() => ws.setChatCollapsed((v) => !v)}
            currentFileName={ws.openFile?.name ?? null}
          />
        </div>

        <aside className="code-codex-tools" aria-label="代码工具">
          <section className="code-codex-tool-card code-codex-tool-card--primary">
            <div className="code-codex-tool-card__title">
              <Bot size={15} />
              <span>AI 助手</span>
            </div>
            <div className="code-codex-assistant-info">
              <span className="code-codex-assistant-name">{assistantLabel}</span>
              <span className="code-codex-assistant-desc">直接复用小妍设置中的模型</span>
            </div>
          </section>

          <section className="code-codex-tool-card">
            <div className="code-codex-tool-card__title">
              <PanelRight size={15} />
              <span>工作面板</span>
            </div>
            <div className="code-codex-tool-list">
              <button type="button" className="code-codex-tool-row">
                <ClipboardCheck size={15} />
                <span>审查</span>
                <kbd>⌃⇧G</kbd>
              </button>
              <button type="button" className="code-codex-tool-row">
                <TerminalSquare size={15} />
                <span>终端</span>
                <kbd>⌘J</kbd>
              </button>
              <button type="button" className="code-codex-tool-row">
                <Globe2 size={15} />
                <span>浏览器</span>
                <kbd>⌘T</kbd>
              </button>
              <button
                type="button"
                className={`code-codex-tool-row ${ws.treeOpen ? "is-active" : ""}`}
                onClick={() => ws.setTreeOpen((v) => !v)}
              >
                <Files size={15} />
                <span>文件</span>
                {ws.treeOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
              <button
                type="button"
                className={`code-codex-tool-row ${!ws.chatCollapsed ? "is-active" : ""}`}
                onClick={() => ws.setChatCollapsed((v) => !v)}
              >
                <MessageSquare size={15} />
                <span>侧边聊天</span>
                <kbd>⌥⌘S</kbd>
              </button>
            </div>
          </section>

          {ws.workingDir && ws.treeOpen && (
            <section className="code-codex-tool-card code-codex-files">
              <CodeFileTree
                rootPath={ws.workingDir}
                entries={ws.fs.entries}
                loading={ws.fs.loading}
                onListDir={ws.fs.listDir}
                onOpenFile={ws.openFileByPath}
                activePath={ws.openFile?.path ?? null}
              />
            </section>
          )}

          <div className="code-codex-editor">
            <CodeEditor
              path={ws.openFile?.path ?? null}
              name={ws.openFile?.name ?? ""}
              content={ws.openFile?.content ?? ""}
              dirty={ws.openFile?.dirty ?? false}
              onChange={ws.updateFileContent}
              onSave={ws.saveOpenFile}
              onClose={ws.closeOpenFile}
            />
          </div>
        </aside>

        <div className="code-codex-terminal" aria-label="终端状态">
          <div className="code-codex-terminal__tab">
            <TerminalSquare size={14} />
            <span>{workspaceName}</span>
          </div>
          <button type="button" className="code-codex-terminal__add" onClick={ws.chooseWorkingDir} title="切换工作目录">
            <Plus size={15} />
          </button>
          <div className="code-codex-terminal__body">
            <span className="code-codex-terminal__path">~/ {ws.workingDir ?? "请选择工作目录"}</span>
            <span className="code-codex-terminal__branch">本地工作区</span>
            <span className="code-codex-terminal__tool">{assistantLabel}</span>
            <span className={`code-codex-terminal__prompt ${ws.sending ? "is-running" : ""}`}>›</span>
          </div>
        </div>
      </main>

      {ws.toast && <div className="code-toast">{ws.toast}</div>}

      {pendingDeleteId && (
        <div className="code-overlay" onClick={() => setPendingDeleteId(null)}>
          <div className="code-dialog" onClick={(e) => e.stopPropagation()}>
            <p className="code-dialog__title">删除会话</p>
            <p className="code-dialog__desc">
              确认删除「{ws.sessions.find((s) => s.id === pendingDeleteId)?.title ?? ""}」？此操作不可撤销。
            </p>
            <div className="code-dialog__actions">
              <button type="button" className="code-dialog__btn" onClick={() => setPendingDeleteId(null)}>取消</button>
              <button type="button" className="code-dialog__btn code-dialog__btn--danger" onClick={onConfirmDelete}>删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
