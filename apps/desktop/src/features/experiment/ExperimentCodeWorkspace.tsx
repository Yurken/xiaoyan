import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Loader2,
  MoreHorizontal,
  Pencil,
  Pin,
  Plus,
  Trash2,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
} from "lucide-react";
import type { ExperimentCodeSession, Skill } from "@research-copilot/types";
import { useCodeWorkspace } from "../code/useCodeWorkspace";
import { useCodeGit } from "../code/useCodeGit";
import { extractSkillVariables, applySkillVariables } from "../copilot/shared";
import SkillVariableFillModal from "../copilot/SkillVariableFillModal";
import type { PendingSkillFill } from "../copilot/useCopilotChat";
import CodeEditorModal from "../code/CodeEditorModal";
import CodeChatPanel from "../code/CodeChatPanel";
import CodePermissionPanel from "../code/CodePermissionPanel";
import { skillsApi, codeApi } from "../../lib/client";
import { usePersistentState } from "../../hooks/usePersistentStringState";
import { useCopilotDropZone } from "../copilot/useCopilotDropZone";
import { ExperimentCodeToolsPanel } from "./ExperimentCodeToolsPanel";

interface ExperimentCodeWorkspaceProps {
  experimentId: string;
  workingDir?: string | null;
  onWorkingDirChange?: (dir: string | null) => void;
  onActiveSessionChange?: (session: ExperimentCodeSession | null) => void;
  rightCollapsed?: boolean;
}

export function ExperimentCodeWorkspace({
  experimentId,
  workingDir,
  onWorkingDirChange,
  onActiveSessionChange,
  rightCollapsed: controlledRightCollapsed,
}: ExperimentCodeWorkspaceProps) {
  const ws = useCodeWorkspace(experimentId, { workingDir, onWorkingDirChange });
  const git = useCodeGit(ws.workingDir);
  const { zoneRef, isOver } = useCopilotDropZone(ws.pickFromDrop);

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
  const [contextMenuId, setContextMenuId] = useState<string | null>(null);
  const sessionMenuAnchorRef = useRef<DOMRect | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [pinnedIds, setPinnedIds] = usePersistentState<string[]>(
    `rc:experiment:${experimentId}:code:pinned`,
    [],
  );
  const [projectAliases, setProjectAliases] = usePersistentState<Record<string, string>>(
    `rc:experiment:${experimentId}:code:project-aliases`,
    {},
  );
  const [projectMenuDir, setProjectMenuDir] = useState<string | null>(null);
  const projectMenuAnchorRef = useRef<DOMRect | null>(null);
  const [pendingDeleteDir, setPendingDeleteDir] = useState<string | null>(null);
  const [renamingDir, setRenamingDir] = useState<string | null>(null);
  const [renameDirTitle, setRenameDirTitle] = useState("");
  const pinnedSet = useMemo(() => {
    if (!Array.isArray(pinnedIds)) return new Set<string>();
    return new Set(pinnedIds);
  }, [pinnedIds]);

  // 点击外部关闭 context menu / project menu
  useEffect(() => {
    if (!contextMenuId) return;
    const close = () => setContextMenuId(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [contextMenuId]);

  useEffect(() => {
    if (!projectMenuDir) return;
    const close = () => setProjectMenuDir(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [projectMenuDir]);

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
  const rightCollapsed = controlledRightCollapsed ?? true;
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

  async function onConfirmDelete() {
    if (!pendingDeleteId) return;
    await ws.handleDeleteSession(pendingDeleteId);
    setPendingDeleteId(null);
  }

  const groupedSessions = useMemo(() => {
    const groups = new Map<string, ExperimentCodeSession[]>();
    for (const s of ws.sessions) {
      const key = s.working_dir ?? "未选择目录";
      const list = groups.get(key) ?? [];
      list.push(s);
      groups.set(key, list);
    }
    // 项目内部会话按 updated_at 倒序排列；项目之间的顺序在 sortedGroupedSessions 中处理。
    for (const list of groups.values()) {
      list.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    }
    return Array.from(groups.entries());
  }, [ws.sessions]);

  function projectLabel(dir: string) {
    if (dir === "未选择目录") return dir;
    return dir.split(/[/\\]/).pop() || dir;
  }

  function projectDisplayLabel(dir: string) {
    return projectAliases[dir] || projectLabel(dir);
  }

  function handlePinProject(dir: string) {
    const sessionIds = groupedSessions.find(([d]) => d === dir)?.[1].map((s) => s.id) ?? [];
    if (sessionIds.length === 0) {
      setProjectMenuDir(null);
      return;
    }
    const allPinned = sessionIds.every((id) => pinnedSet.has(id));
    setPinnedIds((prev) => {
      if (allPinned) return prev.filter((id) => !sessionIds.includes(id));
      return Array.from(new Set([...prev, ...sessionIds]));
    });
    setProjectMenuDir(null);
  }

  function startRenameProject(dir: string) {
    setRenamingDir(dir);
    setRenameDirTitle(projectDisplayLabel(dir));
    setProjectMenuDir(null);
  }

  function commitRenameProject(dir: string) {
    const title = renameDirTitle.trim();
    if (!title || title === projectLabel(dir)) {
      cancelRenameProject();
      return;
    }
    setProjectAliases((prev) => ({ ...prev, [dir]: title }));
    setRenamingDir(null);
    setRenameDirTitle("");
  }

  function cancelRenameProject() {
    setRenamingDir(null);
    setRenameDirTitle("");
  }

  async function handleDeleteProject(dir: string) {
    const sessionsToDelete = groupedSessions.find(([d]) => d === dir)?.[1] ?? [];
    for (const s of sessionsToDelete) {
      await ws.handleDeleteSession(s.id);
    }
    setPendingDeleteDir(null);
  }

  function onConfirmDeleteProject() {
    if (!pendingDeleteDir) return;
    void handleDeleteProject(pendingDeleteDir);
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

  // ── Session actions ──────────────────────────────────────────
  function handlePin(sessionId: string) {
    setPinnedIds((prev) => {
      if (prev.includes(sessionId)) return prev.filter((id) => id !== sessionId);
      return [...prev, sessionId];
    });
    setContextMenuId(null);
  }

  function startRename(session: ExperimentCodeSession) {
    setRenamingId(session.id);
    setRenameTitle(session.title);
    setContextMenuId(null);
  }

  function commitRename(sessionId: string) {
    const title = renameTitle.trim() || "新会话";
    codeApi.updateSession(sessionId, { title }).catch(() => {});
    // Update local state optimistically
    setRenamingId(null);
    setRenameTitle("");
  }

  function cancelRename() {
    setRenamingId(null);
    setRenameTitle("");
  }

  // ── Pin-aware group sorting ─────────────────────────────────
  const sortedGroupedSessions = useMemo(() => {
    const withMeta = groupedSessions.map(([dir, sessions]) => {
      const sorted = [...sessions].sort((a, b) => {
        const aPinned = pinnedSet.has(a.id);
        const bPinned = pinnedSet.has(b.id);
        if (aPinned !== bPinned) return aPinned ? -1 : 1;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });
      const hasPinnedSession = sessions.some((s) => pinnedSet.has(s.id));
      const earliestCreatedAt = Math.min(...sessions.map((s) => new Date(s.created_at).getTime()));
      return { dir, sessions: sorted, hasPinnedSession, earliestCreatedAt };
    });

    // 项目顺序：置顶优先；其余按项目创建时间（最早会话）降序，最新创建的项目在最上面。
    withMeta.sort((a, b) => {
      if (a.hasPinnedSession !== b.hasPinnedSession) return a.hasPinnedSession ? -1 : 1;
      return b.earliestCreatedAt - a.earliestCreatedAt;
    });

    return withMeta.map(({ dir, sessions }) => [dir, sessions] as [string, ExperimentCodeSession[]]);
  }, [groupedSessions, pinnedSet]);

  // 新分组默认展开
  useEffect(() => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      for (const [dir] of sortedGroupedSessions) {
        next.add(dir);
      }
      return next;
    });
  }, [sortedGroupedSessions]);

  return (
    <div className="code-root code-root--opencode">
      <div className={`code-opencode-body${isResizing ? " code-opencode-body--resizing" : ""}`}>
        {leftCollapsed ? null : (
          <aside
            className="code-opencode-sidebar relative"
            aria-label="会话"
            style={{ width: leftWidth, minWidth: leftWidth }}
          >
            <button
              type="button"
              onClick={() => setLeftCollapsed(true)}
              aria-label="收起会话栏"
              title="收起会话栏"
              className="absolute right-2 top-4 z-10 flex h-6 w-6 items-center justify-center rounded-full border text-ink-tertiary transition-colors hover:text-ink-primary"
              style={{ borderColor: "var(--rc-border)", background: "var(--rc-card-bg)" }}
            >
              <ChevronLeft size={14} />
            </button>
            <div className="code-opencode-sidebar__header">
              <button
                type="button"
                className="code-opencode-new-session"
                onClick={ws.handleCreateSession}
                disabled={ws.creatingSession}
              >
                {ws.creatingSession ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Plus size={14} />
                )}
                <span>新建会话</span>
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
              sortedGroupedSessions.map(([dir, sessions]) => {
                const isExpanded = expandedGroups.has(dir);
                return (
                  <div key={dir} className="code-opencode-session-group">
                    <div className="code-opencode-session-group__header">
                      {renamingDir === dir ? (
                        <div className="code-opencode-session-group__title code-opencode-session-group__title--editing">
                          <input
                            autoFocus
                            type="text"
                            className="code-opencode-rename-input"
                            value={renameDirTitle}
                            onChange={(e) => setRenameDirTitle(e.target.value)}
                            onKeyDown={(e) => {
                              e.stopPropagation();
                              if (e.key === "Enter") commitRenameProject(dir);
                              if (e.key === "Escape") cancelRenameProject();
                            }}
                            onBlur={() => commitRenameProject(dir)}
                          />
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="code-opencode-session-group__title"
                            title={dir}
                            onClick={() => toggleGroup(dir)}
                            aria-expanded={isExpanded}
                          >
                            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            <FolderOpen size={12} />
                            <span>{projectDisplayLabel(dir)}</span>
                          </button>
                          <div className="code-opencode-session-group__actions" style={{ position: "relative" }}>
                            <button
                              type="button"
                              className="code-opencode-session-group__more"
                              onClick={(e) => {
                                e.stopPropagation();
                                const isOpening = projectMenuDir !== dir;
                                if (isOpening) {
                                  projectMenuAnchorRef.current = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                                }
                                setProjectMenuDir(isOpening ? dir : null);
                              }}
                              aria-label="项目操作"
                              title="项目操作"
                            >
                              <MoreHorizontal size={12} />
                            </button>
                            {projectMenuDir === dir && projectMenuAnchorRef.current && createPortal(
                              <div
                                className="code-opencode-context-menu code-opencode-context-menu--portal"
                                style={{
                                  position: "fixed",
                                  right: window.innerWidth - projectMenuAnchorRef.current.right,
                                  top: projectMenuAnchorRef.current.bottom + 4,
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  onClick={() => handlePinProject(dir)}
                                  className="code-opencode-context-menu__item"
                                >
                                  <Pin size={12} />
                                  {groupedSessions.find(([d]) => d === dir)?.[1].every((s) => pinnedSet.has(s.id)) ? "取消置顶项目" : "置顶项目"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => startRenameProject(dir)}
                                  className="code-opencode-context-menu__item"
                                >
                                  <Pencil size={12} />
                                  重命名项目
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setProjectMenuDir(null); setPendingDeleteDir(dir); }}
                                  className="code-opencode-context-menu__item code-opencode-context-menu__item--danger"
                                >
                                  <Trash2 size={12} />
                                  删除项目
                                </button>
                              </div>,
                              document.body,
                            )}
                          </div>
                        </>
                      )}
                    </div>
                    {isExpanded && sessions.map((s) => (
                    <div
                      key={s.id}
                      className={`code-opencode-session-item ${s.id === ws.selectedId ? "is-active" : ""}`}
                    >
                      {renamingId === s.id ? (
                        <div className="code-opencode-session-item__text" style={{ flex: 1 }}>
                          <input
                            autoFocus
                            type="text"
                            className="code-opencode-rename-input"
                            value={renameTitle}
                            onChange={(e) => setRenameTitle(e.target.value)}
                            onKeyDown={(e) => {
                              e.stopPropagation();
                              if (e.key === "Enter") commitRename(s.id);
                              if (e.key === "Escape") cancelRename();
                            }}
                            onBlur={() => commitRename(s.id)}
                          />
                        </div>
                      ) : (
                        <div
                          className="code-opencode-session-item__text"
                          onClick={() => ws.selectSession(s)}
                        >
                          <span className="code-opencode-session-item__title">
                            {pinnedSet.has(s.id) ? <Pin size={10} className="code-opencode-pin-icon" /> : null}
                            {s.title}
                          </span>
                          <span className="code-opencode-session-item__meta">{relativeSessionTime(s.updated_at)}</span>
                        </div>
                      )}

                      <div className="code-opencode-session-item__actions" style={{ position: "relative" }}>
                        <button
                          type="button"
                          className="code-opencode-session-item__more"
                          onClick={(e) => {
                            e.stopPropagation();
                            const isOpening = contextMenuId !== s.id;
                            if (isOpening) {
                              sessionMenuAnchorRef.current = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                            }
                            setContextMenuId(isOpening ? s.id : null);
                          }}
                          aria-label="更多操作"
                          title="更多操作"
                        >
                          <MoreHorizontal size={12} />
                        </button>
                        {contextMenuId === s.id && sessionMenuAnchorRef.current && createPortal(
                          <div
                            className="code-opencode-context-menu code-opencode-context-menu--portal"
                            style={{
                              position: "fixed",
                              right: window.innerWidth - sessionMenuAnchorRef.current.right,
                              top: sessionMenuAnchorRef.current.bottom + 4,
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => handlePin(s.id)}
                              className="code-opencode-context-menu__item"
                            >
                              <Pin size={12} />
                              {pinnedSet.has(s.id) ? "取消置顶" : "置顶"}
                            </button>
                            <button
                              type="button"
                              onClick={() => startRename(s)}
                              className="code-opencode-context-menu__item"
                            >
                              <Pencil size={12} />
                              重命名
                            </button>
                            <button
                              type="button"
                              onClick={() => { setContextMenuId(null); setPendingDeleteId(s.id); }}
                              className="code-opencode-context-menu__item code-opencode-context-menu__item--danger"
                            >
                              <Trash2 size={12} />
                              删除
                            </button>
                          </div>,
                          document.body,
                        )}
                      </div>
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

        <main ref={zoneRef} className="code-opencode-main relative">
          {isOver && (
            <div
              className="absolute inset-0 z-50 flex items-center justify-center rounded-2xl m-2 border-2 border-dashed border-[#007AFF] bg-[rgba(0,122,255,0.08)]"
            >
              <span className="text-sm font-medium text-[#007AFF]">释放以上传文件</span>
            </div>
          )}
          {leftCollapsed && (
            <button
              type="button"
              onClick={() => setLeftCollapsed(false)}
              aria-label="展开会话栏"
              title="展开会话栏"
              className="absolute left-2 top-4 z-10 flex h-7 w-7 items-center justify-center rounded-lg text-ink-tertiary transition-colors hover:bg-white/5 hover:text-ink-primary"
            >
              <ChevronRight size={16} />
            </button>
          )}
          {/* 展开按钮已移至 Experiment.tsx header */}
          <CodePermissionPanel
            requests={ws.permissionRequests}
            onResolve={ws.resolvePermission}
          />
          <CodeChatPanel
            messages={ws.selected?.messages ?? []}
            streamingContent={ws.streamingContent}
            sending={ws.sending}
            taskStartedAt={ws.taskStartedAt}
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
            workingDir={ws.workingDir}
            recentWorkingDirs={ws.recentWorkingDirs}
            onChooseWorkingDir={ws.chooseWorkingDir}
            onChangeWorkingDir={ws.setWorkingDir}
            agentMode={ws.agentMode}
            onAgentModeChange={ws.setAgentMode}
            attachments={ws.attachments}
            onRemoveAttachment={ws.removeAttachment}
            contextStats={ws.contextPack.stats}
            skills={skills}
            selectedSkillId={selectedSkillId}
            onSelectedSkillChange={setSelectedSkillId}
            skillLocked={skillLocked}
            onSkillLockedChange={setSkillLocked}
            onStop={ws.cancelActiveStream}
            onEditMessage={ws.handleEditAndResend}
          />
        </main>

        {!rightCollapsed && (
          <div
            className="code-opencode-resizer"
            onMouseDown={(e) => startResize("right", e)}
            aria-hidden="true"
          />
        )}

        {rightCollapsed ? null : (
          <ExperimentCodeToolsPanel
            workingDir={ws.workingDir}
            width={rightWidth}
            fileSystem={ws.fs}
            openFile={ws.openFile}
            onOpenFile={ws.openFileByPath}
            git={git}
          />
        )}
      </div>

      <CodeEditorModal
        file={ws.openFile}
        onChange={ws.updateFileContent}
        onSave={ws.saveOpenFile}
        onClose={ws.closeOpenFile}
      />

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

      {pendingDeleteDir && (
        <div className="code-overlay" onClick={() => setPendingDeleteDir(null)}>
          <div className="code-dialog" onClick={(e) => e.stopPropagation()}>
            <p className="code-dialog__title">删除项目会话</p>
            <p className="code-dialog__desc">
              确认删除「{projectDisplayLabel(pendingDeleteDir)}」下的全部会话？此操作不可撤销。
            </p>
            <div className="code-dialog__actions">
              <button type="button" className="code-dialog__btn" onClick={() => setPendingDeleteDir(null)}>取消</button>
              <button type="button" className="code-dialog__btn code-dialog__btn--danger" onClick={onConfirmDeleteProject}>删除</button>
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

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function relativeSessionTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diffSec = Math.floor((Date.now() - then) / 1000);
  if (diffSec < 0) return "刚刚";
  if (diffSec < HOUR) {
    const m = Math.floor(diffSec / MINUTE);
    return m <= 0 ? "刚刚" : `${m} 分钟前`;
  }
  if (diffSec < DAY) {
    const h = Math.floor(diffSec / HOUR);
    return `${h} 小时前`;
  }
  if (diffSec < 2 * DAY) return "昨天";
  const d = Math.floor(diffSec / DAY);
  return `${d} 天前`;
}
