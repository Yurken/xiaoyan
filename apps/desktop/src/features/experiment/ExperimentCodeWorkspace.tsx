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
} from "lucide-react";
import type { ExperimentCodeSession } from "@research-copilot/types";
import { useCodeWorkspace } from "../code/useCodeWorkspace";
import CodeFileTree from "../code/CodeFileTree";
import CodeEditor from "../code/CodeEditor";
import CodeChatPanel from "../code/CodeChatPanel";
import CodeToolSwitcher from "../code/CodeToolSwitcher";

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

  return (
    <div className="code-root">
      {/* ── Left sidebar: File tree ───────────────────────── */}
      <aside className={`code-sidebar ${ws.treeOpen ? "is-open" : ""}`}>
        <div className="code-sidebar__header">
          <div className="code-sidebar__brand">
            <Code2 size={16} className="code-sidebar__brand-icon" />
            <span>代码工作区</span>
          </div>
        </div>

        {/* Working directory selector */}
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

        {/* Session toggle */}
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
                <button
                  key={s.id}
                  type="button"
                  className={`code-sidebar__item ${s.id === ws.selectedId ? "is-active" : ""}`}
                  onClick={() => ws.selectSession(s)}
                >
                  <div className="code-sidebar__item-text">
                    <span className="code-sidebar__item-title">{s.title}</span>
                    <span className="code-sidebar__item-meta">
                      {new Date(s.updated_at).toLocaleDateString("zh-CN", { month: "short", day: "numeric" })}
                      {s.messages.length > 0 && ` · ${s.messages.length} 条`}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="code-sidebar__item-del"
                    onClick={(e) => { e.stopPropagation(); setPendingDeleteId(s.id); }}
                    aria-label="删除"
                  >
                    <Trash2 size={12} />
                  </button>
                </button>
              ))
            )}
          </div>
        )}

        {/* File tree */}
        {ws.workingDir && (
          <>
            <button
              type="button"
              className="code-sidebar__toggle"
              onClick={() => ws.setTreeOpen((v) => !v)}
            >
              {ws.treeOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <FolderOpen size={14} />
              <span>文件浏览器</span>
            </button>
            {ws.treeOpen && (
              <div className="code-sidebar__tree">
                <CodeFileTree
                  rootPath={ws.workingDir}
                  entries={ws.fs.entries}
                  loading={ws.fs.loading}
                  onListDir={ws.fs.listDir}
                  onOpenFile={ws.openFileByPath}
                  activePath={ws.openFile?.path ?? null}
                />
              </div>
            )}
          </>
        )}
      </aside>

      {/* ── Main area ─────────────────────────────────────── */}
      <main className="code-main">
        {/* Editor */}
        <div className="code-editor-wrap">
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

        {/* Chat panel */}
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
          toolbar={
            <CodeToolSwitcher
              tools={ws.tools}
              toolsLoaded={ws.toolsLoaded}
              activeTool={ws.activeTool}
              onSelectTool={ws.setActiveTool}
              activeModel={ws.activeModel}
              onModelChange={ws.setActiveModel}
            />
          }
        />
      </main>

      {/* Toast */}
      {ws.toast && <div className="code-toast">{ws.toast}</div>}

      {/* Delete confirm */}
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
