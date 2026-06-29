import { useEffect, useState } from "react";
import {
  Loader2,
  Plus,
  Trash2,
  FolderOpen,
  ClipboardCheck,
  GitBranch,
} from "lucide-react";
import type { ExperimentCodeSession } from "@research-copilot/types";
import { useCodeWorkspace } from "../code/useCodeWorkspace";
import CodeFileTree from "../code/CodeFileTree";
import CodeEditor from "../code/CodeEditor";
import CodeChatPanel from "../code/CodeChatPanel";
import { codeToolLabel } from "../code/shared";

type RightTab = "files" | "editor" | "review" | "git";

const TAB_DEFS: { id: RightTab; label: string }[] = [
  { id: "files", label: "文件" },
  { id: "editor", label: "编辑器" },
  { id: "review", label: "审查" },
  { id: "git", label: "Git" },
];

interface ExperimentCodeWorkspaceProps {
  experimentId: string;
  workingDir?: string | null;
  onWorkingDirChange?: (dir: string) => void;
  onActiveSessionChange?: (session: ExperimentCodeSession | null) => void;
}

export function ExperimentCodeWorkspace({
  experimentId,
  workingDir,
  onWorkingDirChange,
  onActiveSessionChange,
}: ExperimentCodeWorkspaceProps) {
  const ws = useCodeWorkspace(experimentId, { workingDir, onWorkingDirChange });

  useEffect(() => {
    onActiveSessionChange?.(ws.selected);
  }, [ws.selected, onActiveSessionChange]);

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<RightTab>("files");

  // 打开文件时自动切换到编辑器标签。
  useEffect(() => {
    if (ws.openFile?.path) {
      setActiveTab("editor");
    }
  }, [ws.openFile?.path]);

  async function onConfirmDelete() {
    if (!pendingDeleteId) return;
    await ws.handleDeleteSession(pendingDeleteId);
    setPendingDeleteId(null);
  }

  function handleAddFile() {
    setActiveTab("files");
    if (!ws.workingDir) {
      void ws.chooseWorkingDir();
    }
  }

  return (
    <div className="code-root code-root--opencode">
      <div className="code-opencode-body">
        <aside className="code-opencode-sidebar" aria-label="会话">
          <button
            type="button"
            className="code-opencode-new-session"
            onClick={ws.handleCreateSession}
          >
            <Plus size={14} />
            <span>新建会话</span>
          </button>

          <div className="code-opencode-session-list">
              {ws.chatLoading ? (
                <div className="code-opencode-session-empty">
                  <Loader2 size={16} className="animate-spin" />
                </div>
              ) : ws.sessions.length === 0 ? (
                <div className="code-opencode-session-empty">
                  <span>暂无会话</span>
                </div>
              ) : (
                ws.sessions.map((s) => (
                  <div
                    key={s.id}
                    className={`code-opencode-session-item ${s.id === ws.selectedId ? "is-active" : ""}`}
                  >
                    <button
                      type="button"
                      className="code-opencode-session-item__main"
                      onClick={() => ws.selectSession(s)}
                    >
                      <div className="code-opencode-session-item__text">
                        <span className="code-opencode-session-item__title">{s.title}</span>
                        <span className="code-opencode-session-item__meta">
                          {new Date(s.updated_at).toLocaleDateString("zh-CN", { month: "short", day: "numeric" })}
                          {s.messages.length > 0 && ` · ${s.messages.length} 条`}
                          {s.tool_id && ` · ${codeToolLabel(s.tool_id)}`}
                        </span>
                      </div>
                    </button>
                    <button
                      type="button"
                      className="code-opencode-session-item__del"
                      onClick={() => setPendingDeleteId(s.id)}
                      aria-label="删除"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))
              )}
            </div>
        </aside>

        <main className="code-opencode-main">
          <CodeChatPanel
            messages={ws.selected?.messages ?? []}
            streamingContent={ws.streamingContent}
            sending={ws.sending}
            input={ws.input}
            onInputChange={ws.setInput}
            onSend={ws.handleSend}
            collapsed={false}
            onToggleCollapse={() => {}}
            currentFileName={ws.openFile?.name ?? null}
            currentModel={ws.currentModel}
            modelOptions={ws.modelOptions}
            activeModelOptionId={ws.activeModelOptionId}
            onModelOptionChange={ws.changeModelOption}
            onAddFile={handleAddFile}
          />
        </main>

        <aside className="code-opencode-tools" aria-label="工具">
          <div className="code-opencode-tabs">
            {TAB_DEFS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`code-opencode-tab ${activeTab === tab.id ? "is-active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="code-opencode-tab-content">
            {activeTab === "files" && ws.workingDir && (
              <CodeFileTree
                rootPath={ws.workingDir}
                entries={ws.fs.entries}
                loading={ws.fs.loading}
                onListDir={ws.fs.listDir}
                onOpenFile={ws.openFileByPath}
                activePath={ws.openFile?.path ?? null}
              />
            )}
            {activeTab === "files" && !ws.workingDir && (
              <div className="code-opencode-tab-placeholder">
                <FolderOpen size={24} />
                <p>请先选择工作目录</p>
              </div>
            )}
            {activeTab === "editor" && (
              <CodeEditor
                path={ws.openFile?.path ?? null}
                name={ws.openFile?.name ?? ""}
                content={ws.openFile?.content ?? ""}
                dirty={ws.openFile?.dirty ?? false}
                onChange={ws.updateFileContent}
                onSave={ws.saveOpenFile}
                onClose={ws.closeOpenFile}
              />
            )}
            {activeTab === "review" && (
              <div className="code-opencode-tab-placeholder">
                <ClipboardCheck size={24} />
                <p>代码审查面板（即将上线）</p>
              </div>
            )}
            {activeTab === "git" && (
              <div className="code-opencode-tab-placeholder">
                <GitBranch size={24} />
                <p>Git changes 面板（即将上线）</p>
              </div>
            )}
          </div>
        </aside>
      </div>

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
