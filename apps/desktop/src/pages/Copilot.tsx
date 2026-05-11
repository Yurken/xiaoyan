import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock3,
  Copy,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { MarkdownRenderer, Select } from "@research-copilot/ui";
import {
  MAIN_ASSISTANT_NAME,
  MAIN_ASSISTANT_WELCOME_DESCRIPTION,
  MAIN_ASSISTANT_WELCOME_TITLE,
} from "@research-copilot/types";
import CollapsibleGroup from "../components/CollapsibleGroup";
import ExternalLink from "../components/ExternalLink";
import CopilotComposer from "../features/copilot/CopilotComposer";
import CopilotOverviewSidebar from "../features/copilot/CopilotOverviewSidebar";
import appLogo from "../assets/xiaoyanv.svg";
import {
  buildCopilotMessageContent,
  parseCopilotMessageContent,
  upsertAgentRun,
} from "../features/copilot/shared";
import { useCopilotAttachments } from "../features/copilot/useCopilotAttachments";
import { useCopilotChatMode } from "../features/copilot/useCopilotChatMode";
import {
  clearPersistentValue,
  readPersistentValue,
  usePersistentStringState,
  writePersistentValue,
} from "../hooks/usePersistentStringState";
import { apiClient, formatErrorMessage } from "../lib/client";
import { openLink } from "../lib/links";
import type { AgentPlanStep, AgentRun, ChatMessage, ChatSession, ResearchInterest, Skill } from "@research-copilot/types";

function splitThoughtFromContent(content: string) {
  const thinkTagPattern = /<think>([\s\S]*?)<\/think>/gi;
  const thoughts: string[] = [];
  let match: RegExpExecArray | null = null;

  while ((match = thinkTagPattern.exec(content)) !== null) {
    const text = (match[1] || "").trim();
    if (text) thoughts.push(text);
  }

  return {
    thought: thoughts.join("\n\n"),
    answer: content.replace(thinkTagPattern, "").trim(),
  };
}

function runTone(status: AgentRun["status"]) {
  if (status === "done") {
    return {
      color: "#34C759",
      background: "rgba(52,199,89,0.12)",
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      label: "已完成",
    };
  }
  if (status === "failed") {
    return {
      color: "#FF3B30",
      background: "rgba(255,59,48,0.12)",
      icon: <XCircle className="w-3.5 h-3.5" />,
      label: "失败",
    };
  }
  return {
    color: "#FF9500",
    background: "rgba(255,149,0,0.12)",
    icon: <Clock3 className="w-3.5 h-3.5" />,
    label: status === "running" ? "处理中" : "待处理",
  };
}

function interestFolderName(interest: ResearchInterest) {
  return interest.folder_name?.trim() || interest.topic;
}

const DEFAULT_ATTACHMENT_PROMPT = "请先阅读我上传的文件，并给我一个简洁的重点概览。";
const COPILOT_LAST_SESSION_KEY = "rc:copilot:last-session-id";

export default function Copilot({ hideFolders = false }: { hideFolders?: boolean }) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [interests, setInterests] = useState<ResearchInterest[]>([]);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [plan, setPlan] = useState<AgentPlanStep[]>([]);
  const [agentRuns, setAgentRuns] = useState<AgentRun[]>([]);
  const [requestId, setRequestId] = useState<string>();
  const [activeAssistantId, setActiveAssistantId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [selectedInterestId, setSelectedInterestId] = useState("");
  const [updatingSessionContext, setUpdatingSessionContext] = useState(false);
  const [confirmDeleteGroupId, setConfirmDeleteGroupId] = useState<string | null>(null);
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; session: ChatSession } | null>(null);
  const [menuSessionId, setMenuSessionId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [memoryInput, setMemoryInput] = useState("");
  const [savingMemory, setSavingMemory] = useState(false);
  const [memorySaved, setMemorySaved] = useState(false);
  const [searchingQuery, setSearchingQuery] = useState<string | null>(null);
  const [chatDragOver, setChatDragOver] = useState(false);
  const chatDragCounterRef = useRef(0);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [sessionListMode, setSessionListMode] = usePersistentStringState<"open" | "collapsed">(
    "rc:copilot:session-list-mode",
    "open",
    ["open", "collapsed"] as const,
  );
  const { chatMode, setChatMode } = useCopilotChatMode();
  const bottomRef = useRef<HTMLDivElement>(null);
  const streamAbortRef = useRef<AbortController | null>(null);
  const restoredSessionRef = useRef(false);
  const memorySavedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const {
    attachments,
    uploading: uploadingAttachments,
    pickAttachments,
    pickFromDrop,
    removeAttachment,
    clearAttachments,
  } = useCopilotAttachments(setLoadError);

  useEffect(() => {
    let cancelled = false;

    setLoadError("");

    apiClient.chat.listSessions()
      .then((data) => {
        if (!cancelled) {
          setSessions(data);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(formatErrorMessage(error));
          setSessions([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    apiClient.knowledge
      .listInterests()
      .then((data) => {
        if (!cancelled) {
          setInterests(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setInterests([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    apiClient.skills.list().then((data) => {
      setSkills(data.filter((s) => s.is_enabled && s.name !== "ppt-generate"));
    }).catch(() => { });
  }, []);

  const cancelActiveStream = useCallback(() => {
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      cancelActiveStream();
      if (memorySavedTimerRef.current) clearTimeout(memorySavedTimerRef.current);
    };
  }, [cancelActiveStream]);

  useEffect(() => {
    const unlisten = getCurrentWindow().onDragDropEvent((event) => {
      if (event.payload.type === "drop") {
        pickFromDrop(event.payload.paths);
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [pickFromDrop]);

  const sessionGroups = useMemo(() => {
    return interests.map((interest) => ({
      key: interest.id,
      title: interestFolderName(interest),
      subtitle: interestFolderName(interest) !== interest.topic ? `研究主题：${interest.topic}` : undefined,
      sessions: sessions.filter((session) => session.context_type === "interest" && session.context_id === interest.id),
    }));
  }, [interests, sessions]);

  const ungroupedSessions = useMemo(
    () => sessions.filter((session) => session.context_type !== "interest" || !session.context_id),
    [sessions]
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => {
      setContextMenu(null);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [contextMenu]);

  const handleMoveSession = async (session: ChatSession, interestId: string) => {
    setContextMenu(null);
    try {
      const updated = await apiClient.chat.updateSessionContext(session.id, interestId || undefined);
      syncSession(updated);
      if (currentSession?.id === session.id) {
        setSelectedInterestId(interestId);
      }
    } catch (error) {
      setLoadError(formatErrorMessage(error));
    }
  };

  const loadSession = useCallback(async (session: ChatSession) => {
    cancelActiveStream();
    try {
      setLoadError("");
      const [sessionData, runData] = await Promise.all([
        apiClient.chat.getSession(session.id),
        apiClient.chat.listAgentRuns(session.id),
      ]);
      setCurrentSession(sessionData);
      writePersistentValue(COPILOT_LAST_SESSION_KEY, sessionData.id);
      setSelectedInterestId(
        sessionData.context_type === "interest" && sessionData.context_id ? sessionData.context_id : ""
      );
      setMessages(sessionData.messages ?? []);
      setAgentRuns(runData);
      setPlan([]);
      setRequestId(runData[0]?.request_id);
      setActiveAssistantId(null);
    } catch (error) {
      setLoadError(formatErrorMessage(error));
    }
  }, [cancelActiveStream]);

  useEffect(() => {
    if (restoredSessionRef.current || currentSession || sessions.length === 0) {
      return;
    }

    restoredSessionRef.current = true;
    const storedSessionId = readPersistentValue(COPILOT_LAST_SESSION_KEY);
    if (!storedSessionId) return;

    const targetSession = sessions.find((session) => session.id === storedSessionId);
    if (!targetSession) {
      clearPersistentValue(COPILOT_LAST_SESSION_KEY);
      return;
    }

    void loadSession(targetSession);
  }, [currentSession, loadSession, sessions]);

  const syncSession = (updatedSession: ChatSession) => {
    setSessions((prev) => [updatedSession, ...prev.filter((session) => session.id !== updatedSession.id)]);
    setCurrentSession((prev) => (prev?.id === updatedSession.id ? updatedSession : prev));
  };

  const handleNewChat = () => {
    cancelActiveStream();
    clearPersistentValue(COPILOT_LAST_SESSION_KEY);
    setCurrentSession(null);
    setMessages([]);
    setPlan([]);
    setAgentRuns([]);
    setRequestId(undefined);
    setLoadError("");
    setActiveAssistantId(null);
  };

  const handleSessionInterestChange = async (nextInterestId: string) => {
    const previousInterestId = selectedInterestId;
    setSelectedInterestId(nextInterestId);

    if (!currentSession) {
      return;
    }

    try {
      setUpdatingSessionContext(true);
      setLoadError("");
      const updatedSession = await apiClient.chat.updateSessionContext(currentSession.id, nextInterestId || undefined);
      syncSession(updatedSession);
    } catch (error) {
      setSelectedInterestId(previousInterestId);
      setLoadError(formatErrorMessage(error));
    } finally {
      setUpdatingSessionContext(false);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await apiClient.chat.deleteSession(sessionId);
      setSessions((prev) => prev.filter((item) => item.id !== sessionId));
      if (currentSession?.id === sessionId) {
        handleNewChat();
      } else if (readPersistentValue(COPILOT_LAST_SESSION_KEY) === sessionId) {
        clearPersistentValue(COPILOT_LAST_SESSION_KEY);
      }
    } catch (error) {
      setLoadError(formatErrorMessage(error));
    }
  };

  const handlePinSession = (sessionId: string) => {
    setSessions((prev) => {
      const idx = prev.findIndex((s) => s.id === sessionId);
      if (idx <= 0) return prev;
      const item = prev[idx];
      const next = [...prev];
      next.splice(idx, 1);
      next.unshift(item);
      return next;
    });
  };

  const startRename = (session: ChatSession) => {
    setRenamingId(session.id);
    setRenameTitle(session.title || "");
    setMenuSessionId(null);
  };

  const commitRename = () => {
    if (renamingId && renameTitle.trim()) {
      setSessions((prev) =>
        prev.map((s) => (s.id === renamingId ? { ...s, title: renameTitle.trim() } : s)),
      );
    }
    setRenamingId(null);
    setRenameTitle("");
  };

  const cancelRename = () => {
    setRenamingId(null);
    setRenameTitle("");
  };

  // 关闭三点菜单的点击外部监听
  useEffect(() => {
    if (!menuSessionId) return;
    const handler = () => setMenuSessionId(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [menuSessionId]);

  const handleDeleteInterestGroup = async (interestId: string, deleteAll: boolean) => {
    try {
      setDeletingGroupId(interestId);
      if (deleteAll) {
        await apiClient.knowledge.deleteInterestBundle(interestId);
        setSessions((prev) =>
          prev.filter((s) => !(s.context_type === "interest" && s.context_id === interestId))
        );
        if (currentSession?.context_type === "interest" && currentSession.context_id === interestId) {
          handleNewChat();
        }
      } else {
        await apiClient.knowledge.deleteInterestOnly(interestId);
        setSessions((prev) =>
          prev.map((s) =>
            s.context_type === "interest" && s.context_id === interestId
              ? { ...s, context_type: "general", context_id: undefined }
              : s
          )
        );
        if (currentSession?.context_type === "interest" && currentSession.context_id === interestId) {
          setCurrentSession((prev) => prev ? { ...prev, context_type: "general", context_id: undefined } : prev);
          setSelectedInterestId("");
        }
      }
      setInterests((prev) => prev.filter((item) => item.id !== interestId));
      setConfirmDeleteGroupId(null);
    } catch (error) {
      setLoadError(formatErrorMessage(error));
    } finally {
      setDeletingGroupId(null);
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && attachments.length === 0) || sending || uploadingAttachments) return;
    const rawText = input.trim() || DEFAULT_ATTACHMENT_PROMPT;
    const selectedSkill = skills.find((s) => s.id === selectedSkillId);
    const text = selectedSkill
      ? `[技能指令 · ${selectedSkill.title}]\n${selectedSkill.prompt}\n\n---\n\n${rawText}`
      : rawText;
    const submittedText = buildCopilotMessageContent(text, attachments);
    const assistantId = `${Date.now()}_a`;

    // 埋点：记录提问内容（取前60字）
    void apiClient.memory.add({
      type: "auto",
      action: "chat.query",
      summary: `向小妍提问：${rawText.slice(0, 60)}${rawText.length > 60 ? "..." : ""}`,
    });

    // Abort any previous stream before starting a new one
    cancelActiveStream();
    const abortController = new AbortController();
    streamAbortRef.current = abortController;

    setInput("");
    clearAttachments();
    setSending(true);
    setLoadError("");
    setPlan([]);
    setAgentRuns([]);
    setRequestId(undefined);
    setActiveAssistantId(assistantId);

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: submittedText,
      created_at: new Date().toISOString(),
    };
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    try {
      let sessionId = currentSession?.id;

      for await (const chunk of apiClient.chat.stream(
        {
          session_id: currentSession?.id,
          message: submittedText,
          context_type: selectedInterestId ? "interest" : "general",
          context_id: selectedInterestId || undefined,
          chat_mode: chatMode,
        },
        abortController.signal
      )) {
        if (streamAbortRef.current !== abortController || abortController.signal.aborted) {
          abortController.abort();
          break;
        }

        if (chunk.type === "session_id") {
          sessionId = chunk.value;
        }
        if (chunk.type === "request_id") {
          setRequestId(chunk.value);
        }
        if (chunk.type === "plan") {
          setPlan(chunk.value);
        }
        if (chunk.type === "agent_start" || chunk.type === "agent_complete" || chunk.type === "agent_error") {
          setAgentRuns((prev) => upsertAgentRun(prev, chunk.value));
        }
        if (chunk.type === "searching") {
          setSearchingQuery(chunk.query);
        }
        if (chunk.type === "delta") {
          if (searchingQuery) setSearchingQuery(null);
          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantId
                ? { ...message, content: message.content + chunk.value }
                : message
            )
          );
        }
        if (chunk.type === "sources") {
          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantId
                ? { ...message, sources: chunk.value }
                : message
            )
          );
        }
        if (chunk.type === "error") {
          const errorText = chunk.value || "请求未完成，请稍后重试。";
          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantId ? { ...message, content: errorText } : message
            )
          );
        }
      }

      if (sessionId && !currentSession && !abortController.signal.aborted) {
        const updated = await apiClient.chat.listSessions();
        const nextSession = updated.find((session) => session.id === sessionId) ?? null;
        setSessions(updated);
        setCurrentSession(nextSession);
        if (nextSession) {
          writePersistentValue(COPILOT_LAST_SESSION_KEY, nextSession.id);
        }
      }
    } catch (error) {
      if ((error as Error)?.name === "AbortError") {
        // User-initiated abort is not an error surface
      } else {
        const message = `请求未完成：${formatErrorMessage(error)}`;
        setMessages((prev) =>
          prev.map((item) =>
            item.id === assistantId ? { ...item, content: message } : item
          )
        );
      }
    } finally {
      setSending(false);
      if (streamAbortRef.current === abortController) {
        streamAbortRef.current = null;
      }
    }
  };

  const handleSaveMemory = async () => {
    if (!memoryInput.trim() || savingMemory) return;
    setSavingMemory(true);
    try {
      await apiClient.memory.add({
        type: "manual",
        summary: memoryInput.trim(),
      });
      setMemoryInput("");
      setMemorySaved(true);
      if (memorySavedTimerRef.current) clearTimeout(memorySavedTimerRef.current);
      memorySavedTimerRef.current = setTimeout(() => setMemorySaved(false), 3000);
    } catch (error) {
      setLoadError(formatErrorMessage(error));
    } finally {
      setSavingMemory(false);
    }
  };

  const handleChatDragEnter = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    chatDragCounterRef.current += 1;
    if (event.dataTransfer.items && event.dataTransfer.items.length > 0) {
      setChatDragOver(true);
    }
  };

  const handleChatDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    chatDragCounterRef.current -= 1;
    if (chatDragCounterRef.current <= 0) {
      chatDragCounterRef.current = 0;
      setChatDragOver(false);
    }
  };

  const handleChatDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = async (text: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(messageId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // clipboard API may fail in some contexts
    }
  };

  const handleStartEdit = (message: ChatMessage) => {
    const parsed = parseCopilotMessageContent(message.content);
    setEditingMessageId(message.id);
    setEditText(parsed.text);
  };

  const handleSaveEdit = () => {
    if (!editText.trim()) return;
    setInput(editText.trim());
    setEditingMessageId(null);
    setEditText("");
    setTimeout(() => { void handleSend(); }, 0);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditText("");
  };

  const handleRetry = (assistantMsgId: string) => {
    const idx = messages.findIndex((m) => m.id === assistantMsgId);
    if (idx <= 0) return;
    const userMsg = messages[idx - 1];
    if (userMsg.role !== "user") return;
    const parsed = parseCopilotMessageContent(userMsg.content);
    setInput(parsed.text);
    setTimeout(() => { void handleSend(); }, 0);
  };

  const handleChatDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    chatDragCounterRef.current = 0;
    setChatDragOver(false);
    // 文件路径由 Tauri onDragDropEvent 获取
  };

  const activeRequestId =
    requestId ||
    [...agentRuns].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]?.request_id;

  const displayedRuns = [...agentRuns]
    .filter((run) => !activeRequestId || run.request_id === activeRequestId)
    .sort((a, b) => a.order_index - b.order_index);

  const artifacts = displayedRuns.flatMap((run) => run.artifacts ?? []);
  const sessionListCollapsed = sessionListMode === "collapsed";

  const renderSessionItem = (session: ChatSession) => {
    const isRenaming = renamingId === session.id;
    return (
      <div
        key={session.id}
        className="group relative flex items-center gap-2 rounded-2xl px-3 py-2.5 text-xs transition-all duration-150"
        onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, session }); }}
        style={
          currentSession?.id === session.id
            ? {
              background: "var(--rc-surface)",
              boxShadow: "var(--rc-inset-shadow)",
              color: "#007AFF",
            }
            : {
              background: "var(--rc-surface)",
              boxShadow: "var(--rc-chip-shadow)",
              color: "var(--rc-text-soft)",
            }
        }
      >
        {isRenaming ? (
          <input
            className="min-w-0 flex-1 rounded-lg px-2 py-1 text-xs font-medium text-ink-primary outline-none"
            style={{ background: "var(--rc-chip-inset-bg)", boxShadow: "var(--rc-chip-inset-shadow)" }}
            value={renameTitle}
            onChange={(e) => setRenameTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") cancelRename();
            }}
            onBlur={commitRename}
            autoFocus
          />
        ) : (
          <button className="min-w-0 flex-1 text-left" onClick={() => void loadSession(session)}>
            <div className="truncate font-medium">{session.title || "新对话"}</div>
            {/* <div className="mt-1 text-[11px] opacity-70">
              {new Date(session.updated_at || session.created_at).toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
            </div> */}
          </button>
        )}
        <div className="relative flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); setMenuSessionId(menuSessionId === session.id ? null : session.id); }}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-ink-tertiary hover:text-ink-primary"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
          {menuSessionId === session.id && (
            <div
              className="absolute right-0 top-full mt-1 z-50 min-w-[100px] rounded-2xl py-1.5 text-xs"
              style={{
                background: "var(--rc-elevated)",
                boxShadow: "var(--rc-chip-shadow)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="w-full px-3 py-1.5 text-left text-ink-secondary transition-colors hover:bg-nm-dark/8 hover:text-ink-primary"
                onClick={() => { handlePinSession(session.id); setMenuSessionId(null); }}
              >
                置顶
              </button>
              <button
                className="w-full px-3 py-1.5 text-left text-ink-secondary transition-colors hover:bg-nm-dark/8 hover:text-ink-primary"
                onClick={() => startRename(session)}
              >
                重命名
              </button>
              <button
                className="w-full px-3 py-1.5 text-left text-apple-red transition-colors hover:bg-apple-red/8"
                onClick={() => { void handleDeleteSession(session.id); setMenuSessionId(null); }}
              >
                删除
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="relative flex h-full overflow-hidden" style={{ background: "var(--rc-surface)" }}>
        <div
          className={`${sessionListCollapsed ? "w-14" : "w-52"} flex-shrink-0 flex flex-col`}
          style={{
            background: "linear-gradient(180deg, var(--rc-surface) 0%, var(--rc-surface) 100%)",
            boxShadow: "4px 0 10px rgb(var(--rc-text-rgb) / 0.04)",
          }}
        >
          <div className="p-3 pb-2">
            <div className="flex items-center gap-2">
              <button
                onClick={handleNewChat}
                aria-label="新建对话"
                className={`${sessionListCollapsed ? "h-9 w-9 justify-center px-0" : "flex-1 px-3"} flex items-center gap-2 rounded-2xl py-2.5 text-sm font-medium text-white transition-all duration-150 active:scale-[0.98]`}
                style={{
                  background: "linear-gradient(145deg, #1A8AFF, #0062CC)",
                  boxShadow: "4px 4px 10px rgba(0,62,204,0.35), -3px -3px 8px rgba(58,155,255,0.2)",
                }}
              >
                <Plus className="w-4 h-4" />
                {!sessionListCollapsed && "新建对话"}
              </button>
              <button
                type="button"
                aria-label={sessionListCollapsed ? "展开会话列表" : "收起会话列表"}
                onClick={() => setSessionListMode(sessionListCollapsed ? "open" : "collapsed")}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl text-ink-tertiary transition-colors hover:text-ink-primary"
                style={{ background: "var(--rc-surface)", boxShadow: "var(--rc-chip-shadow)" }}
              >
                {sessionListCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </button>
            </div>
            {!hideFolders && !sessionListCollapsed && (
              <div className="mt-2">
                <Select
                  label="新对话主题文件夹"
                  value={selectedInterestId}
                  onChange={setSelectedInterestId}
                  className="text-xs"
                  options={[
                    { value: "", label: "未归类" },
                    ...interests.map((interest) => ({
                      value: interest.id,
                      label: interest.folder_name?.trim() || interest.topic,
                    })),
                  ]}
                />
              </div>
            )}
          </div>

          {sessionListCollapsed ? (
            <div className="flex flex-1 flex-col items-center gap-2 px-2 pb-3">
              <button
                type="button"
                onClick={() => setSessionListMode("open")}
                className="flex h-9 w-9 items-center justify-center rounded-2xl text-ink-tertiary transition-colors hover:text-ink-primary"
                style={{ background: "var(--rc-surface)", boxShadow: "var(--rc-chip-shadow)" }}
                title={`${sessions.length} 条对话`}
              >
                <MessageSquare className="h-4 w-4" />
              </button>
              <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-ink-tertiary">
                {sessions.length}
              </span>
            </div>
          ) : (
          <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-1">
            {sessions.length === 0 && interests.length === 0 && (
              <div className="flex flex-col items-center py-8 gap-2">
                <MessageSquare className="w-8 h-8 text-ink-tertiary opacity-40" />
                <p className="text-xs text-ink-tertiary">暂无对话记录</p>
              </div>
            )}

            {hideFolders ? (
              // 自由工作台：扁平展示所有会话
              <div className="space-y-1.5">{sessions.map(renderSessionItem)}</div>
            ) : selectedInterestId ? (
              // 已选主题：只展示该主题下的会话
              (() => {
                const group = sessionGroups.find((g) => g.key === selectedInterestId);
                const groupSessions = group?.sessions ?? [];
                return groupSessions.length === 0 ? (
                  <div className="px-3 py-6 text-center text-xs text-ink-tertiary">该主题下暂无对话</div>
                ) : (
                  <div className="space-y-1.5">{groupSessions.map(renderSessionItem)}</div>
                );
              })()
            ) : (
              <div className="space-y-1.5">{sessions.map(renderSessionItem)}</div>
            )}
          </div>
          )}
        </div>

        <div className="flex-1 min-w-0 flex overflow-hidden">
          <div className="flex-1 flex flex-col min-w-0 bg-nm-bg">
            <div
              className="flex h-[52px] items-center justify-between px-4"
              style={{
                background: "linear-gradient(180deg, var(--rc-surface), var(--rc-surface))",
                boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
              }}
            >
              <div className="flex-1" />
              <div className="flex items-center gap-3">
                {currentSession && (
                  <Select
                    value={selectedInterestId}
                    onChange={(value) => void handleSessionInterestChange(value)}
                    disabled={updatingSessionContext}
                    className="min-w-[160px]"
                    options={[
                      { value: "", label: "未归类" },
                      ...interests.map((interest) => ({
                        value: interest.id,
                        label: interest.folder_name?.trim() || interest.topic,
                      })),
                    ]}
                  />
                )}
                <div
                  className="px-3 py-1.5 rounded-full text-xs font-medium"
                  style={{
                    background: "var(--rc-surface)",
                    color: updatingSessionContext ? "#007AFF" : sending ? "#FF9500" : "#34C759",
                    boxShadow: "var(--rc-inset-shadow)",
                  }}
                >
                  {updatingSessionContext ? "正在更新归属" : sending ? "处理中" : "就绪"}
                </div>
              </div>
            </div>

            {loadError && (
              <div className="px-5 pt-4">
                <div
                  className="flex items-start gap-3 rounded-2xl px-4 py-3 text-sm text-apple-red"
                  style={{
                    background: "color-mix(in srgb, var(--rc-elevated) 82%, #FF3B30 10%)",
                    boxShadow: "var(--rc-inset-shadow)",
                  }}
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span className="rc-selectable min-w-0 flex-1 break-all">{loadError}</span>
                  <button
                    type="button"
                    aria-label="关闭错误提示"
                    onClick={() => setLoadError("")}
                    className="rounded-lg p-0.5 text-apple-red/70 transition-colors hover:bg-apple-red/10 hover:text-apple-red"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}

            <div
              className="flex-1 overflow-y-auto p-4 space-y-4 relative"
              onDragEnter={handleChatDragEnter}
              onDragLeave={handleChatDragLeave}
              onDragOver={handleChatDragOver}
              onDrop={handleChatDrop}
            >
              {chatDragOver && (
                <div
                  className="absolute inset-2 z-30 rounded-3xl flex items-center justify-center"
                  style={{
                    background: "rgba(0,122,255,0.08)",
                    border: "2px dashed #007AFF",
                    pointerEvents: "none",
                  }}
                >
                  <span
                    className="text-lg font-semibold"
                    style={{ color: "#007AFF" }}
                  >
                    释放文件以上传
                  </span>
                </div>
              )}
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full gap-4 pb-12">
                  <img
                    src={appLogo}
                    alt="小妍"
                    draggable={false}
                    className="w-20 h-20 object-contain"
                    style={{
                      WebkitMaskImage: "radial-gradient(circle at center, #000 82%, transparent 100%)",
                      maskImage: "radial-gradient(circle at center, #000 82%, transparent 100%)",
                    }}
                  />
                  <div className="text-center max-w-md">
                    <p className="font-semibold text-ink-primary">{MAIN_ASSISTANT_WELCOME_TITLE}</p>
                    <p className="text-sm text-ink-tertiary mt-2 leading-6">{MAIN_ASSISTANT_WELCOME_DESCRIPTION}</p>
                  </div>
                </div>
              )}

              {messages.map((message) => (
                <div key={message.id} className="space-y-2">
                  {message.role === "assistant" && (() => {
                    const parsed = splitThoughtFromContent(message.content || "");
                    const isActiveAssistant = message.id === activeAssistantId;
                    const planForBubble = isActiveAssistant ? plan : [];
                    const runsForBubble = isActiveAssistant ? displayedRuns : [];

                    return (
                      <>
                        {(parsed.thought || planForBubble.length > 0 || runsForBubble.length > 0) && (
                          <div
                            className="rounded-2xl px-3 py-3"
                            style={{
                              background: "color-mix(in srgb, var(--rc-elevated) 86%, #FF9500 10%)",
                              boxShadow: "var(--rc-inset-shadow)",
                            }}
                          >
                            {parsed.thought && (
                              <details open>
                                <summary className="cursor-pointer text-xs font-semibold text-ink-secondary">模型推理过程</summary>
                                <div className="mt-2 whitespace-pre-wrap text-xs leading-5 text-ink-secondary">
                                  {parsed.thought}
                                </div>
                              </details>
                            )}

                            {planForBubble.length > 0 && (
                              <div className={parsed.thought ? "mt-3" : ""}>
                                <div className="mb-2 text-xs font-semibold text-ink-secondary">执行步骤</div>
                                <div className="space-y-2">
                                  {planForBubble.map((step, index) => {
                                    const run = [...runsForBubble]
                                      .reverse()
                                      .find((item) => item.agent_name === step.agent_name);
                                    const tone = runTone(run?.status || "pending");

                                    return (
                                      <div
                                        key={`${step.agent_name}-${index}`}
                                        className="rounded-xl px-3 py-2"
                                        style={{
                                          background: "var(--rc-surface)",
                                          boxShadow: "var(--rc-inset-shadow)",
                                        }}
                                      >
                                        <div className="flex items-center justify-between gap-2">
                                          <span className="text-xs font-semibold text-ink-primary">{index + 1}. {step.title}</span>
                                          <span className="rounded-full px-2 py-0.5 text-[11px]" style={{ color: tone.color, background: tone.background }}>
                                            {tone.label}
                                          </span>
                                        </div>
                                        <p className="mt-1 text-[11px] leading-5 text-ink-tertiary">{step.goal}</p>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {searchingQuery && isActiveAssistant && (
                          <div
                            className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs"
                            style={{
                              background: "rgba(0,122,255,0.06)",
                              color: "#007AFF",
                            }}
                          >
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            正在搜索：{searchingQuery}
                          </div>
                        )}
                        <div className="rc-selectable text-sm leading-relaxed" style={{ color: "var(--rc-text)" }}>
                          <MarkdownRenderer
                            content={parsed.answer || (sending && isActiveAssistant ? "小妍思考中..." : "")}
                            onLinkClick={openLink}
                          />
                        </div>
                        {parsed.answer && (
                          <div className="flex items-center gap-0.5 mt-1">
                            <button
                              type="button"
                              onClick={() => handleCopy(parsed.answer, message.id)}
                              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] transition-colors hover:bg-nm-dark/8"
                              style={{ color: "var(--rc-text-tertiary)" }}
                            >
                              {copiedId === message.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRetry(message.id)}
                              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] transition-colors hover:bg-nm-dark/8"
                              style={{ color: "var(--rc-text-tertiary)" }}
                            >
                              <RefreshCw className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </>
                    );
                  })()}

                  {message.role === "user" && (() => {
                    const parsedUserMessage = parseCopilotMessageContent(message.content);
                    const isEditing = editingMessageId === message.id;

                    return (
                      <div className="flex justify-end">
                        <div className="max-w-[85%]">
                          {isEditing ? (
                            <div className="space-y-2">
                              <textarea
                                rows={3}
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSaveEdit();
                                  }
                                  if (e.key === "Escape") {
                                    handleCancelEdit();
                                  }
                                }}
                                className="w-full rounded-2xl px-3 py-2 text-xs text-ink-primary outline-none resize-none"
                                style={{
                                  background: "var(--rc-surface)",
                                  boxShadow: "var(--rc-inset-shadow)",
                                }}
                                autoFocus
                              />
                              <div className="flex justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={handleCancelEdit}
                                  className="rounded-lg px-2 py-1 text-[11px] transition-colors hover:bg-nm-dark/8"
                                  style={{ color: "var(--rc-text-tertiary)" }}
                                >
                                  取消
                                </button>
                                <button
                                  type="button"
                                  onClick={handleSaveEdit}
                                  disabled={!editText.trim()}
                                  className="rounded-lg px-2 py-1 text-[11px] font-medium transition-colors disabled:opacity-40"
                                  style={{ color: "#FFFFFF", background: "#007AFF" }}
                                >
                                  保存并发送
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              {parsedUserMessage.attachments.length > 0 && (
                                <div className="mb-2 flex flex-wrap gap-1.5 justify-end">
                                  {parsedUserMessage.attachments.map((attachment, index) => (
                                    <span
                                      key={`${attachment.name}-${index}`}
                                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium"
                                      style={{ background: "rgba(0,122,255,0.1)", color: "#007AFF" }}
                                    >
                                      <MessageSquare className="w-3 h-3" />
                                      {attachment.name}
                                    </span>
                                  ))}
                                </div>
                              )}
                              <div
                                className="rounded-2xl px-3 py-1.5 text-xs"
                                style={{
                                  background: "linear-gradient(145deg, #1A8AFF, #0062CC)",
                                  boxShadow: "4px 4px 10px rgba(0,62,204,0.3), -3px -3px 8px rgba(58,155,255,0.2)",
                                  color: "#FFFFFF",
                                }}
                              >
                                <p className="rc-selectable whitespace-pre-wrap leading-relaxed">
                                  {parsedUserMessage.text || DEFAULT_ATTACHMENT_PROMPT}
                                </p>
                              </div>
                              <div className="flex justify-end gap-0.5 mt-1">
                                <button
                                  type="button"
                                  onClick={() => handleCopy(parsedUserMessage.text || DEFAULT_ATTACHMENT_PROMPT, message.id)}
                                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] transition-colors hover:bg-nm-dark/8"
                                  style={{ color: "var(--rc-text-tertiary)" }}
                                >
                                  {copiedId === message.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleStartEdit(message)}
                                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] transition-colors hover:bg-nm-dark/8"
                                  style={{ color: "var(--rc-text-tertiary)" }}
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {message.role === "assistant" && message.sources && message.sources.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {message.sources.map((source, index) => (
                        <ExternalLink
                          key={`${source.source}-${index}`}
                          href={source.url}
                          className="px-2.5 py-1 rounded-full text-[11px] text-[#6B7280] hover:text-apple-blue"
                          title={source.content}
                        >
                          <span
                            className="rounded-full px-2.5 py-1"
                            style={{
                              background: "var(--rc-surface)",
                              boxShadow: "var(--rc-inset-shadow)",
                            }}
                          >
                            {source.source || `来源 ${index + 1}`}
                          </span>
                        </ExternalLink>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            <CopilotComposer
              chatMode={chatMode}
              onChatModeChange={setChatMode}
              input={input}
              onInputChange={setInput}
              onSubmit={handleSend}
              sending={sending}
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
          activeRequestId={activeRequestId}
          plan={plan}
          runs={displayedRuns}
          sending={sending}
          artifacts={artifacts}
          memoryInput={memoryInput}
          memorySaved={memorySaved}
          savingMemory={savingMemory}
          onMemoryInputChange={(value) => {
            setMemoryInput(value);
            setMemorySaved(false);
          }}
          onSaveMemory={handleSaveMemory}
          onArtifactLinkClick={openLink}
        />
      </div>

      {/* 会话右键菜单 */}
      {contextMenu && (
        <div
          className="fixed z-50 min-w-[160px] overflow-hidden rounded-2xl py-1.5 text-xs"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
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
            onClick={() => void handleMoveSession(contextMenu.session, "")}
          >
            未归类
          </button>
          {interests.map((interest) => (
            <button
              key={interest.id}
              className="w-full px-3 py-1.5 text-left text-ink-secondary transition-colors hover:bg-nm-dark/8 hover:text-ink-primary"
              onClick={() => void handleMoveSession(contextMenu.session, interest.id)}
            >
              {interestFolderName(interest)}
            </button>
          ))}
          <div className="my-1 border-t border-nm-dark/10" />
          <button
            className="w-full px-3 py-1.5 text-left text-apple-red transition-colors hover:bg-apple-red/8"
            onClick={() => { void handleDeleteSession(contextMenu.session.id); setContextMenu(null); }}
          >
            删除对话
          </button>
        </div>
      )}
    </>
  );
}
