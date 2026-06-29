import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  FileCode,
  GitBranch,
  Loader2,
  Plus,
  Search,
  Trash2,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  ChevronLast,
  PanelLeft,
  PanelRight,
} from "lucide-react";
import type { ExperimentCodeSession, Skill } from "@research-copilot/types";
import { CapsuleTabs } from "@research-copilot/ui";
import { useCodeWorkspace } from "../code/useCodeWorkspace";
import { useCodeGit } from "../code/useCodeGit";
import { extractSkillVariables, applySkillVariables } from "../copilot/shared";
import SkillVariableFillModal from "../copilot/SkillVariableFillModal";
import type { PendingSkillFill } from "../copilot/useCopilotChat";
import CodeFileTree from "../code/CodeFileTree";
import CodeEditor from "../code/CodeEditor";
import CodeChatPanel from "../code/CodeChatPanel";
import CodeReviewPanel from "../code/CodeReviewPanel";
import CodeGitPanel from "../code/CodeGitPanel";
import { codeToolLabel } from "../code/shared";
import { skillsApi } from "../../lib/client";
import { usePersistentState } from "../../hooks/usePersistentStringState";

type RightTab = "files" | "editor" | "review" | "git";

const TAB_DEFS: { id: RightTab; label: string; icon: ReactNode }[] = [
  { id: "files", label: "文件", icon: <FolderOpen className="h-4 w-4" /> },
  { id: "editor", label: "编辑器", icon: <FileCode className="h-4 w-4" /> },
  { id: "review", label: "审查", icon: <Search className="h-4 w-4" /> },
  { id: "git", label: "Git", icon: <GitBranch className="h-4 w-4" /> },
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
  const git = useCodeGit(ws.workingDir);

  useEffect(() => {
    onActiveSessionChange?.(ws.selected);
  }, [ws.selected, onActiveSessionChange]);

  // ── Skills ──────────────────────────────────────────────────
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [skillLocked, setSkillLocked] = useState(false);
  const [pendingFill, setPendingFill] = useState<PendingSkillFill | null>(null);

  useEffect(() => {
    skillsApi.list().then((data) => {
      setSkills(data.filter((s) => s.is_enabled && s.kind !== "tool"));
    });
  }, []);

  const selectedSkill = useMemo(
    () => skills.find((s) => s.id === selectedSkillId) ?? null,
    [skills, selectedSkillId],
  );

  function handleSendWithSkill() {
    if (!selectedSkill) {
      ws.handleSend();
      return;
    }
    const variables = extractSkillVariables(selectedSkill.prompt);
    if (variables.length > 0) {
      setPendingFill({ skill: selectedSkill, rawText: ws.input, variables });
    } else {
      doSendWithSkill(selectedSkill.prompt);
    }
  }

  function doSendWithSkill(finalPrompt: string) {
    ws.handleSend(finalPrompt);
    if (!skillLocked) {
      setSelectedSkillId(null);
      setSkillLocked(false);
    }
    setPendingFill(null);
  }

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<RightTab>("files");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // 左右侧边栏宽度与折叠状态
  const [leftWidth, setLeftWidth] = usePersistentState<number>(
    `rc:experiment:${experimentId}:code:left-width`,
    260,
  );
  const [rightWidth, setRightWidth] = usePersistentState<number>(
    `rc:experiment:${experimentId}:code:right-width`,
    300,
  );
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  const resizingRef = useRef<{ side: "left" | "right"; startX: number; startWidth: number } | null>(null);

  const startResize = useCallback((side: "left" | "right", e: React.MouseEvent) => {
    e.preventDefault();
    const startWidth = side === "left" ? leftWidth : rightWidth;
    resizingRef.current = { side, startX: e.clientX, startWidth };
    setIsResizing(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [leftWidth, rightWidth]);

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (!resizingRef.current) return;
      const { side, startX, startWidth } = resizingRef.current;
      const delta = side === "left" ? e.clientX - startX : startX - e.clientX;
      const nextWidth = Math.max(180, Math.min(480, startWidth + delta));
      if (side === "left") {
        setLeftWidth(nextWidth);
      } else {
        setRightWidth(nextWidth);
      }
    }

    function handleMouseUp() {
      resizingRef.current = null;
      setIsResizing(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [setLeftWidth, setRightWidth]);

  // 打开文件时自动切换到编辑器标签。
  useEffect(() => {
    if (ws.openFile?.path) {
      setActiveTab("editor");
    }
  }, [ws.openFile?.path]);

  const refreshGit = git.refresh;

  useEffect(() => {
    if (activeTab === "review" || activeTab === "git") {
      void refreshGit();
    }
  }, [activeTab, refreshGit]);

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

  const groupedSessions = useMemo(() => {
    const groups = new Map<string, ExperimentCodeSession[]>();
    for (const s of ws.sessions) {
      const key = s.working_dir ?? "未选择目录";
      const list = groups.get(key) ?? [];
      list.push(s);
      groups.set(key, list);
    }
    for (const list of groups.values()) {
      list.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    }
    return Array.from(groups.entries()).sort((a, b) => {
      const aTime = Math.max(...a[1].map((s) => new Date(s.updated_at).getTime()));
      const bTime = Math.max(...b[1].map((s) => new Date(s.updated_at).getTime()));
      return bTime - aTime;
    });
  }, [ws.sessions]);

  // 新分组默认展开
  useEffect(() => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      for (const [dir] of groupedSessions) {
        next.add(dir);
      }
      return next;
    });
  }, [groupedSessions]);

  function projectLabel(dir: string) {
    if (dir === "未选择目录") return dir;
    return dir.split(/[/\\]/).pop() || dir;
  }

  function toggleGroup(dir: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(dir)) {
        next.delete(dir);
      } else {
        next.add(dir);
      }
      return next;
    });
  }

  return (
    <div className="code-root code-root--opencode">
      <div className={`code-opencode-body${isResizing ? " code-opencode-body--resizing" : ""}`}>
        {leftCollapsed ? (
          <button
            type="button"
            className="code-opencode-expand-bar"
            onClick={() => setLeftCollapsed(false)}
            aria-label="展开会话栏"
            title="展开会话栏"
          >
            <PanelLeft size={14} />
          </button>
        ) : (
          <aside
            className="code-opencode-sidebar"
            aria-label="会话"
            style={{ width: leftWidth, minWidth: leftWidth }}
          >
            <div className="code-opencode-sidebar__header">
              <button
                type="button"
                className="code-opencode-new-session"
                onClick={ws.handleCreateSession}
              >
                <Plus size={14} />
                <span>新建会话</span>
              </button>
              <button
                type="button"
                className="code-opencode-collapse-btn"
                onClick={() => setLeftCollapsed(true)}
                aria-label="收起会话栏"
                title="收起会话栏"
              >
                <ChevronLeft size={14} />
              </button>
            </div>

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
              groupedSessions.map(([dir, sessions]) => {
                const isExpanded = expandedGroups.has(dir);
                return (
                  <div key={dir} className="code-opencode-session-group">
                    <button
                      type="button"
                      className="code-opencode-session-group__title"
                      title={dir}
                      onClick={() => toggleGroup(dir)}
                      aria-expanded={isExpanded}
                    >
                      {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      <FolderOpen size={12} />
                      <span>{projectLabel(dir)}</span>
                    </button>
                    {isExpanded && sessions.map((s) => (
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
                  ))}
                </div>
              )
            })
          )}
          </div>
        </aside>
        )}

        {!leftCollapsed && (
          <div
            className="code-opencode-resizer"
            onMouseDown={(e) => startResize("left", e)}
            aria-hidden="true"
          />
        )}

        <main className="code-opencode-main">
          <CodeChatPanel
            messages={ws.selected?.messages ?? []}
            streamingContent={ws.streamingContent}
            sending={ws.sending}
            input={ws.input}
            onInputChange={ws.setInput}
            onSend={handleSendWithSkill}
            collapsed={false}
            onToggleCollapse={() => {}}
            currentFileName={ws.openFile?.name ?? null}
            currentModel={ws.currentModel}
            modelOptions={ws.modelOptions}
            activeModelOptionId={ws.activeModelOptionId}
            onModelOptionChange={ws.changeModelOption}
            onAddFile={handleAddFile}
            workingDir={ws.workingDir}
            onChooseWorkingDir={ws.chooseWorkingDir}
            agentMode={ws.agentMode}
            onAgentModeChange={ws.setAgentMode}
            skills={skills}
            selectedSkillId={selectedSkillId}
            onSelectedSkillChange={setSelectedSkillId}
            skillLocked={skillLocked}
            onSkillLockedChange={setSkillLocked}
          />
        </main>

        {!rightCollapsed && (
          <div
            className="code-opencode-resizer"
            onMouseDown={(e) => startResize("right", e)}
            aria-hidden="true"
          />
        )}

        {rightCollapsed ? (
          <button
            type="button"
            className="code-opencode-expand-bar"
            onClick={() => setRightCollapsed(false)}
            aria-label="展开工具栏"
            title="展开工具栏"
          >
            <PanelRight size={14} />
          </button>
        ) : (
          <aside
            className="code-opencode-tools"
            aria-label="工具"
            style={{ width: rightWidth, minWidth: rightWidth }}
          >
            <div className="code-opencode-tabs">
              <CapsuleTabs
                compact
                iconOnly={rightWidth < 260}
                options={TAB_DEFS.map((t) => ({ value: t.id, label: t.label, icon: t.icon }))}
                value={activeTab}
                onChange={(v) => setActiveTab(v as RightTab)}
              />
              <button
                type="button"
                className="code-opencode-collapse-btn code-opencode-collapse-btn--right"
                onClick={() => setRightCollapsed(true)}
                aria-label="收起工具栏"
                title="收起工具栏"
              >
                <ChevronLast size={14} />
              </button>
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
              <CodeReviewPanel
                workingDir={ws.workingDir}
                snapshot={git.snapshot}
                loading={git.loading}
                reviewing={git.reviewing}
                review={git.review}
                error={git.error}
                onRefresh={git.refresh}
                onRunReview={git.runReview}
              />
            )}
            {activeTab === "git" && (
              <CodeGitPanel
                workingDir={ws.workingDir}
                snapshot={git.snapshot}
                loading={git.loading}
                actionLoading={git.actionLoading}
                error={git.error}
                commitMessage={git.commitMessage}
                onCommitMessageChange={git.setCommitMessage}
                onRefresh={git.refresh}
                onStage={git.stage}
                onUnstage={git.unstage}
                onCommit={git.commit}
              />
            )}
          </div>
        </aside>
        )}
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

      {pendingFill && (
        <SkillVariableFillModal
          pending={pendingFill}
          onConfirm={(values) => {
            const finalPrompt = applySkillVariables(pendingFill.skill.prompt, values);
            doSendWithSkill(finalPrompt);
          }}
          onCancel={() => setPendingFill(null)}
        />
      )}
    </div>
  );
}
