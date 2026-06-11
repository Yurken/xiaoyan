import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import CopilotComposer from "../features/copilot/CopilotComposer";
import CopilotOverviewSidebar from "../features/copilot/CopilotOverviewSidebar";
import { CopilotChatArea } from "../features/copilot/CopilotChatArea";
import { CopilotSessionSidebar } from "../features/copilot/CopilotSessionSidebar";
import { useCopilotSessions } from "../features/copilot/useCopilotSessions";
import { useCopilotChat } from "../features/copilot/useCopilotChat";
import { useCopilotAttachments } from "../features/copilot/useCopilotAttachments";
import { useCopilotChatMode } from "../features/copilot/useCopilotChatMode";
import { usePersistentStringState } from "../hooks/usePersistentStringState";
import { apiClient, formatErrorMessage } from "../lib/client";
import { openLink } from "../lib/links";
import type { ChatSession, Skill } from "@research-copilot/types";
import { interestFolderName } from "../lib/interestUtils";

export default function Copilot({ hideFolders = false }: { hideFolders?: boolean }) {
  const [sessionListMode, setSessionListMode] = usePersistentStringState<"open" | "collapsed">(
    "rc:copilot:session-list-mode",
    hideFolders ? "collapsed" : "open",
    ["open", "collapsed"] as const,
  );
  const sessionListCollapsed = sessionListMode === "collapsed";

  const sessions = useCopilotSessions();
  const { chatMode, setChatMode } = useCopilotChatMode();

  const [skills, setSkills] = useState<Skill[]>([]);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [memoryInput, setMemoryInput] = useState("");
  const [savingMemory, setSavingMemory] = useState(false);
  const [memorySaved, setMemorySaved] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const memorySavedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    attachments,
    uploading: uploadingAttachments,
    pickAttachments,
    pickFromDrop,
    removeAttachment,
    clearAttachments,
  } = useCopilotAttachments((err) => sessions.setLoadError(err));

  const chat = useCopilotChat({
    currentSession: sessions.currentSession,
    selectedInterestId: sessions.selectedInterestId,
    chatMode,
    skills,
    selectedSkillId,
    attachments,
    clearAttachments,
    onNewSession: () => {},
    onSessionCreated: async (sessionId: string) => {
      const updated = await apiClient.chat.listSessions();
      const nextSession = updated.find((s) => s.id === sessionId) ?? null;
      // Update sessions list via the session hook's internal sync
      if (nextSession) sessions.syncSession(nextSession);
    },
  });

  // Sync chat reset with session changes
  const handleNewChat = useCallback(() => {
    sessions.handleNewChat();
    chat.resetChat();
  }, [sessions, chat]);

  // Restore last session and load agent runs
  useEffect(() => {
    sessions.restoreLastSession();
  }, [sessions]);

  const handleLoadSession = useCallback(async (session: ChatSession) => {
    chat.cancelActiveStream();
    const sessionData = await sessions.loadSession(session);
    if (!sessionData) return;
    chat.resetChat();
    chat.setMessages(sessionData.messages ?? []);
    try {
      const runData = await apiClient.chat.listAgentRuns(session.id);
      chat.setAgentRuns(runData);
    } catch (err) { console.warn("Failed to load agent runs:", err); }
    chat.setSidebarCollapsed(true);
  }, [sessions, chat]);

  // Skills
  useEffect(() => {
    apiClient.skills.list().then((data) => {
      setSkills(data.filter((s) => s.is_enabled && s.name !== "ppt-generate"));
    }).catch((err) => { console.warn("Failed to load skills:", err); });
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      chat.cancelActiveStream();
      if (memorySavedTimerRef.current) clearTimeout(memorySavedTimerRef.current);
    };
  }, [chat]);

  // Copy handler
  const handleCopy = async (text: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(messageId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) { console.warn("Clipboard write failed:", err); }
  };

  // Edit handlers
  const handleStartEdit = (message: { id: string; content: string }) => {
    setEditingMessageId(message.id);
    setEditText(message.content);
  };
  const handleSaveEdit = () => { setEditingMessageId(null); setEditText(""); };
  const handleCancelEdit = () => { setEditingMessageId(null); setEditText(""); };

  // Save memory
  const handleSaveMemory = async () => {
    if (!memoryInput.trim() || savingMemory) return;
    setSavingMemory(true);
    try {
      await apiClient.memory.add({ type: "manual", summary: memoryInput.trim() });
      setMemoryInput("");
      setMemorySaved(true);
      if (memorySavedTimerRef.current) clearTimeout(memorySavedTimerRef.current);
      memorySavedTimerRef.current = setTimeout(() => setMemorySaved(false), 3000);
    } catch (error) {
      sessions.setLoadError(formatErrorMessage(error));
    } finally {
      setSavingMemory(false);
    }
  };

  // Session groups for sidebar
  const sessionGroups = useMemo(() => {
    return sessions.interests.map((interest) => ({
      key: interest.id,
      title: interestFolderName(interest),
      subtitle: interestFolderName(interest) !== interest.topic ? `研究主题：${interest.topic}` : undefined,
      sessions: sessions.sessions.filter(
        (s) => s.context_type === "interest" && s.context_id === interest.id
      ),
    }));
  }, [sessions.interests, sessions.sessions]);

  const ungroupedSessions = useMemo(
    () => sessions.sessions.filter((s) => s.context_type !== "interest" || !s.context_id),
    [sessions.sessions]
  );

  // Displayed runs for artifacts
  const displayedRuns = useMemo(() => {
    return [...chat.agentRuns].sort((a, b) => a.orderIndex - b.orderIndex);
  }, [chat.agentRuns]);

  const artifacts = useMemo(() => {
    return displayedRuns.flatMap((run) => run.artifacts ?? []);
  }, [displayedRuns]);

  return (
    <>
      <div className="relative flex h-full overflow-hidden" style={{ background: "var(--rc-surface)" }}>
        <CopilotSessionSidebar
          sessions={sessions.sessions}
          interests={sessions.interests}
          currentSession={sessions.currentSession}
          selectedInterestId={sessions.selectedInterestId}
          sessionListCollapsed={sessionListCollapsed}
          sessionGroups={sessionGroups}
          ungroupedSessions={ungroupedSessions}
          hideFolders={hideFolders}
          renamingId={sessions.renamingId}
          renameTitle={sessions.renameTitle}
          menuSessionId={sessions.menuSessionId}
          confirmingDeleteGroupId={sessions.confirmDeleteGroupId}
          deletingGroupId={sessions.deletingGroupId}
          onNewChat={handleNewChat}
          onSelectInterest={sessions.setSelectedInterestId}
          onToggleCollapse={() => setSessionListMode("collapsed")}
          onLoadSession={handleLoadSession}
          onContextMenu={(e, session) => {
            e.preventDefault();
            sessions.setContextMenu({ x: e.clientX, y: e.clientY, session });
          }}
          onMenuToggle={sessions.setMenuSessionId}
          onPinSession={sessions.handlePinSession}
          onStartRename={sessions.startRename}
          onDeleteSession={sessions.handleDeleteSession}
          onDeleteInterestGroup={sessions.handleDeleteInterestGroup}
          onConfirmDeleteGroup={sessions.setConfirmDeleteGroupId}
          onRenameTitleChange={sessions.setRenameTitle}
          onCommitRename={sessions.commitRename}
          onCancelRename={sessions.cancelRename}
        />

        <div className="flex-1 min-w-0 flex overflow-hidden">
          <div className="flex-1 flex flex-col min-w-0 bg-nm-bg relative">
            {sessionListCollapsed && (
              <button
                type="button"
                aria-label="展开会话列表"
                onClick={() => setSessionListMode("open")}
                className="absolute top-3 left-3 z-10 flex h-9 w-9 items-center justify-center rounded-2xl text-ink-tertiary transition-colors hover:text-ink-primary"
                style={{ background: "var(--rc-surface)", boxShadow: "var(--rc-chip-shadow)" }}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            )}

            <CopilotChatArea
              messages={chat.messages}
              agentRuns={chat.agentRuns}
              plan={chat.plan}
              routingDecision={chat.routingDecision}
              activeAssistantId={chat.activeAssistantId}
              sending={chat.sending}
              searchingQuery={chat.searchingQuery}
              loadError={sessions.loadError || chat.loadError}
              editingMessageId={editingMessageId}
              editText={editText}
              copiedId={copiedId}
              onClearError={() => { sessions.setLoadError(""); chat.setLoadError(""); }}
              onCopy={handleCopy}
              onRetry={() => {}}
              onStartEdit={handleStartEdit}
              onSaveEdit={handleSaveEdit}
              onCancelEdit={handleCancelEdit}
              onEditTextChange={setEditText}
              onPickFromDrop={pickFromDrop}
            />

            <CopilotComposer
              chatMode={chatMode}
              onChatModeChange={(mode) => {
                setChatMode(mode);
                if (mode === "task" && chat.messages.length > 0) {
                  chat.setSidebarCollapsed(false);
                }
              }}
              input={chat.input}
              onInputChange={chat.setInput}
              onSubmit={chat.handleSend}
              sending={chat.sending}
              uploadingAttachments={uploadingAttachments}
              attachments={attachments}
              pickAttachments={pickAttachments}
              removeAttachment={removeAttachment}
              skills={skills}
              selectedSkillId={selectedSkillId}
              onSelectedSkillChange={setSelectedSkillId}
            />
          </div>
        </div>

        <CopilotOverviewSidebar
          plan={chat.plan}
          runs={displayedRuns}
          sending={chat.sending}
          updatingSessionContext={sessions.updatingSessionContext}
          artifacts={artifacts}
          memoryInput={memoryInput}
          memorySaved={memorySaved}
          savingMemory={savingMemory}
          onMemoryInputChange={(value) => { setMemoryInput(value); setMemorySaved(false); }}
          onSaveMemory={handleSaveMemory}
          onArtifactLinkClick={openLink}
          collapsed={chat.sidebarCollapsed}
          onCollapsedChange={chat.setSidebarCollapsed}
        />
      </div>

      {/* 会话右键菜单 */}
      {sessions.contextMenu && (
        <div
          className="fixed z-50 min-w-[160px] overflow-hidden rounded-2xl py-1.5 text-xs"
          style={{
            left: sessions.contextMenu.x,
            top: sessions.contextMenu.y,
            background: "var(--rc-elevated)",
            boxShadow: "var(--rc-chip-shadow)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink-tertiary">
            移动到主页
          </div>
          <button
            className="w-full px-3 py-1.5 text-left text-ink-secondary transition-colors hover:bg-nm-dark/8 hover:text-ink-primary"
            onClick={() => void sessions.handleMoveSession(sessions.contextMenu!.session, "")}
          >
            未归类
          </button>
          {sessions.interests.map((interest) => (
            <button
              key={interest.id}
              className="w-full px-3 py-1.5 text-left text-ink-secondary transition-colors hover:bg-nm-dark/8 hover:text-ink-primary"
              onClick={() => void sessions.handleMoveSession(sessions.contextMenu!.session, interest.id)}
            >
              {interestFolderName(interest)}
            </button>
          ))}
          <div className="my-1 border-t border-nm-dark/10" />
          <button
            className="w-full px-3 py-1.5 text-left text-apple-red transition-colors hover:bg-apple-red/8"
            onClick={() => {
              void sessions.handleDeleteSession(sessions.contextMenu!.session.id);
              sessions.setContextMenu(null);
            }}
          >
            删除对话
          </button>
        </div>
      )}
    </>
  );
}
