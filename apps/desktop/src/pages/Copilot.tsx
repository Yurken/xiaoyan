import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Bot,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  MessageSquare,
  Plus,
  Send,
  Trash2,
  User,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { MarkdownRenderer, Select } from "@research-copilot/ui";
import {
  MAIN_ASSISTANT_INPUT_PLACEHOLDER,
  MAIN_ASSISTANT_NAME,
  MAIN_ASSISTANT_STATUS_DESCRIPTION,
  MAIN_ASSISTANT_WELCOME_DESCRIPTION,
  MAIN_ASSISTANT_WELCOME_TITLE,
  MAIN_ASSISTANT_WORKSPACE_NAME,
} from "@research-copilot/types";
import CollapsibleGroup from "../components/CollapsibleGroup";
import ExternalLink from "../components/ExternalLink";
import CopilotOverviewSidebar from "../features/copilot/CopilotOverviewSidebar";
import appLogo from "../assets/app-logo.svg";
import {
  buildCopilotMessageContent,
  parseCopilotMessageContent,
  upsertAgentRun,
} from "../features/copilot/shared";
import { useCopilotAttachments } from "../features/copilot/useCopilotAttachments";
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
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [skillPickerOpen, setSkillPickerOpen] = useState(false);
  const [hoveredSkillId, setHoveredSkillId] = useState<string | null>(null);
  const [memoryInput, setMemoryInput] = useState("");
  const [savingMemory, setSavingMemory] = useState(false);
  const [memorySaved, setMemorySaved] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const {
    attachments,
    uploading: uploadingAttachments,
    pickAttachments,
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
    }).catch(() => {});
  }, []);

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
    if (!contextMenu && !skillPickerOpen) return;
    const close = () => {
      setContextMenu(null);
      setSkillPickerOpen(false);
      setHoveredSkillId(null);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [contextMenu, skillPickerOpen]);

  const hoveredSkill = useMemo(
    () => skills.find((item) => item.id === hoveredSkillId) ?? null,
    [hoveredSkillId, skills]
  );
  const previewSkill = useMemo(() => {
    if (hoveredSkill) return hoveredSkill;
    if (selectedSkillId) {
      const selected = skills.find((item) => item.id === selectedSkillId);
      if (selected) return selected;
    }
    return skills[0] ?? null;
  }, [hoveredSkill, selectedSkillId, skills]);

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

  const loadSession = async (session: ChatSession) => {
    try {
      setLoadError("");
      const [sessionData, runData] = await Promise.all([
        apiClient.chat.getSession(session.id),
        apiClient.chat.listAgentRuns(session.id),
      ]);
      setCurrentSession(sessionData);
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
  };

  const syncSession = (updatedSession: ChatSession) => {
    setSessions((prev) => [updatedSession, ...prev.filter((session) => session.id !== updatedSession.id)]);
    setCurrentSession((prev) => (prev?.id === updatedSession.id ? updatedSession : prev));
  };

  const handleNewChat = () => {
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
      }
    } catch (error) {
      setLoadError(formatErrorMessage(error));
    }
  };

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
      summary: `向小妍提问：${rawText.slice(0, 60)}${rawText.length > 60 ? "…" : ""}`,
    });

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

      for await (const chunk of apiClient.chat.stream({
        session_id: currentSession?.id,
        message: submittedText,
        context_type: selectedInterestId ? "interest" : "general",
        context_id: selectedInterestId || undefined,
      })) {
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
        if (chunk.type === "delta") {
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
          setLoadError(errorText);
          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantId ? { ...message, content: errorText } : message
            )
          );
        }
      }

      if (sessionId && !currentSession) {
        const updated = await apiClient.chat.listSessions();
        setSessions(updated);
        setCurrentSession(updated.find((session) => session.id === sessionId) ?? null);
      }
    } catch (error) {
      const message = `请求未完成：${formatErrorMessage(error)}`;
      setLoadError(message);
      setMessages((prev) =>
        prev.map((item) =>
          item.id === assistantId ? { ...item, content: message } : item
        )
      );
    } finally {
      setSending(false);
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
      setTimeout(() => setMemorySaved(false), 3000);
    } finally {
      setSavingMemory(false);
    }
  };

  const activeRequestId =
    requestId ||
    [...agentRuns].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]?.request_id;

  const displayedRuns = [...agentRuns]
    .filter((run) => !activeRequestId || run.request_id === activeRequestId)
    .sort((a, b) => a.order_index - b.order_index);

  const artifacts = displayedRuns.flatMap((run) => run.artifacts ?? []);

  const renderSessionItem = (session: ChatSession) => (
    <div
      key={session.id}
      className="group flex items-start gap-2 rounded-2xl px-3 py-2.5 text-xs transition-all duration-150"
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
              color: "#3C3C43",
            }
      }
    >
      <button className="min-w-0 flex-1 text-left" onClick={() => void loadSession(session)}>
        <div className="truncate font-medium">{session.title || "新对话"}</div>
        <div className="mt-1 text-[11px] opacity-70">
          {new Date(session.updated_at || session.created_at).toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
        </div>
      </button>
      <button
        onClick={() => void handleDeleteSession(session.id)}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-ink-tertiary hover:text-apple-red"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );

  return (
    <>
	    <div className="relative flex h-full overflow-hidden" style={{ background: "linear-gradient(180deg, #F3F6FA 0%, var(--rc-surface) 100%)" }}>
      <div
        className="w-52 flex-shrink-0 flex flex-col"
        style={{
          background: "linear-gradient(180deg, var(--rc-surface) 0%, var(--rc-surface) 100%)",
          boxShadow: "4px 0 10px rgba(0,0,0,0.04)",
        }}
      >
        <div className="p-3 pb-2">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-2xl text-sm font-medium text-white transition-all duration-150 active:scale-[0.98]"
            style={{
              background: "linear-gradient(145deg, #1A8AFF, #0062CC)",
              boxShadow: "4px 4px 10px rgba(0,62,204,0.35), -3px -3px 8px rgba(58,155,255,0.2)",
            }}
          >
            <Plus className="w-4 h-4" />
            新建对话
          </button>
          {!hideFolders && (
          <div className="mt-2">
            <Select
              label="新对话主题文件夹"
              value={selectedInterestId}
              onChange={setSelectedInterestId}
              className="text-xs"
              options={[
                { value: "", label: "未归档" },
                ...interests.map((interest) => ({
                  value: interest.id,
                  label: interest.folder_name?.trim() || interest.topic,
                })),
              ]}
            />
          </div>
          )}
        </div>

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
            // 未选主题：展示所有分组 + 未归档
            <>
              {sessionGroups.filter((group) => group.sessions.length > 0).map((group) => (
                <CollapsibleGroup
                  key={group.key}
                  compact
                  title={group.title}
                  subtitle={group.subtitle}
                  countLabel={`${group.sessions.length} 条`}
                  defaultOpen={group.sessions.length > 0}
                  bodyClassName="space-y-1.5"
                  actions={
                    confirmDeleteGroupId === group.key ? (
                      <>
                        <button
                          type="button"
                          disabled={deletingGroupId === group.key}
                          onClick={() => void handleDeleteInterestGroup(group.key, false)}
                          className="rounded-lg px-1.5 py-0.5 text-[10px] text-ink-tertiary transition-colors hover:bg-nm-dark/10 hover:text-ink-primary disabled:opacity-50"
                        >
                          未归档
                        </button>
                        <button
                          type="button"
                          disabled={deletingGroupId === group.key}
                          onClick={() => void handleDeleteInterestGroup(group.key, true)}
                          className="rounded-lg px-1.5 py-0.5 text-[10px] text-apple-red transition-colors hover:bg-apple-red/10 disabled:opacity-50"
                        >
                          删除全部
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteGroupId(null)}
                          className="text-ink-tertiary hover:text-ink-primary"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteGroupId(group.key)}
                        className="text-ink-tertiary/30 transition-colors hover:text-apple-red"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )
                  }
                >
                  {group.sessions.map(renderSessionItem)}
                </CollapsibleGroup>
              ))}

              {ungroupedSessions.length > 0 && (
                <div className="px-2 pt-2">
                  <div className="px-2 pb-2">
                    <p className="text-[11px] font-semibold text-ink-tertiary">未归档</p>
                    <p className="mt-1 text-[10px] leading-4 text-ink-tertiary/80">可在对话顶部关联到具体研究方向。</p>
                  </div>
                  <div className="space-y-1.5">
                    {ungroupedSessions.map(renderSessionItem)}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
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
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center text-white"
                style={{
                  background: "linear-gradient(145deg, #111827, #334155)",
                  boxShadow: "4px 4px 10px rgba(15,23,42,0.24)",
                }}
              >
                <BrainCircuit className="w-5 h-5" />
              </div>
              <div>
                <span className="font-semibold text-sm text-ink-primary">{MAIN_ASSISTANT_WORKSPACE_NAME}</span>
                <p className="text-xs text-ink-tertiary mt-0.5">{MAIN_ASSISTANT_STATUS_DESCRIPTION}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {currentSession && (
                <Select
                  value={selectedInterestId}
                  onChange={(value) => void handleSessionInterestChange(value)}
                  disabled={updatingSessionContext}
                  className="min-w-[160px]"
                  options={[
                    { value: "", label: "未归档" },
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
                  background: "#F2EAEA",
                  boxShadow: "inset 2px 2px 5px rgba(180,59,48,0.14), inset -2px -2px 5px rgba(255,255,255,0.8)",
                }}
              >
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span className="break-all">{loadError}</span>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-4 pb-12">
                <img
                  src={appLogo}
                  alt="小妍"
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
              <div
                key={message.id}
                className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}
              >
                <div
                  className="w-8 h-8 rounded-2xl flex-shrink-0 flex items-center justify-center"
                  style={
                    message.role === "user"
                      ? {
                          background: "linear-gradient(145deg, #1A8AFF, #0062CC)",
                          boxShadow: "3px 3px 8px rgba(0,62,204,0.35), -2px -2px 6px rgba(58,155,255,0.2)",
                        }
                      : {
                          background: "linear-gradient(145deg, #111827, #334155)",
                          boxShadow: "3px 3px 8px rgba(15,23,42,0.2)",
                        }
                  }
                >
                  {message.role === "user"
                    ? <User className="w-4 h-4 text-white" />
                    : <Bot className="w-4 h-4 text-white" />}
                </div>

                <div className="max-w-[78%] flex flex-col gap-2">
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
                              background: "#F8EFE0",
                              boxShadow: "inset 2px 2px 5px rgba(204,162,84,0.25), inset -2px -2px 5px rgba(255,255,255,0.7)",
                            }}
                          >
                            {parsed.thought && (
                              <details open>
                                <summary className="cursor-pointer text-xs font-semibold text-[#9A6A00]">模型推理过程</summary>
                                <div className="mt-2 whitespace-pre-wrap text-xs leading-5 text-[#5A4A2F]">
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

                        <div
                          className="rounded-3xl px-4 py-3 text-sm"
                          style={{
                            background: "linear-gradient(145deg, #F2F6FA, #E0E4E8)",
                            boxShadow: "var(--rc-chip-shadow)",
                            color: "#1C1C1E",
                          }}
                        >
                          <MarkdownRenderer
                            content={parsed.answer || (sending && isActiveAssistant ? `${MAIN_ASSISTANT_NAME} 正在整理最终答复...` : "…")}
                            onLinkClick={openLink}
                          />
                        </div>
                      </>
                    );
                  })()}

                  {message.role === "user" && (() => {
                    const parsedUserMessage = parseCopilotMessageContent(message.content);

                    return (
                      <div
                        className="rounded-3xl px-4 py-3 text-sm"
                        style={{
                          background: "linear-gradient(145deg, #1A8AFF, #0062CC)",
                          boxShadow: "4px 4px 10px rgba(0,62,204,0.3), -3px -3px 8px rgba(58,155,255,0.2)",
                          color: "#FFFFFF",
                        }}
                      >
                        {parsedUserMessage.attachments.length > 0 && (
                          <div className="mb-3 flex flex-wrap gap-2">
                            {parsedUserMessage.attachments.map((attachment, index) => (
                              <span
                                key={`${attachment.name}-${index}`}
                                className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-[11px] font-medium"
                                style={{ background: "rgba(255,255,255,0.18)", color: "#FFFFFF" }}
                              >
                                <MessageSquare className="w-3 h-3" />
                                {attachment.name}
                              </span>
                            ))}
                          </div>
                        )}
                        <p className="whitespace-pre-wrap leading-relaxed">
                          {parsedUserMessage.text || DEFAULT_ATTACHMENT_PROMPT}
                        </p>
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
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <div className="p-4 pt-3 flex gap-3 items-end">
            <div className="flex-1 space-y-2">
              {/* 技能选择器 */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setSkillPickerOpen((prev) => !prev); }}
                    data-open={skillPickerOpen}
                    className="rc-dropdown-trigger inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-medium transition-all duration-150"
                    style={{
                      color: skillPickerOpen ? "#007AFF" : "#636366",
                    }}
                  >
                    <Zap className="w-3 h-3" />
                    技能
                  </button>

                  {skillPickerOpen && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      onMouseLeave={() => setHoveredSkillId(null)}
                      className="absolute bottom-full mb-2 left-0 z-20 flex items-start gap-2"
                    >
                      {/* 左：技能列表 */}
                      <div
                        className="rc-dropdown-menu w-44 max-h-[420px] flex-shrink-0 overflow-y-auto rounded-2xl py-2"
                      >
                        <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-ink-tertiary">技能库</p>
                        <button
                          type="button"
                          onMouseEnter={() => setHoveredSkillId(null)}
                          onClick={() => { setSelectedSkillId(null); setSkillPickerOpen(false); setHoveredSkillId(null); }}
                          className="w-full text-left px-3 py-2 text-xs transition-colors duration-100 flex items-center gap-2"
                          style={{
                            color: !selectedSkillId ? "#007AFF" : "#3C3C43",
                            background: !selectedSkillId ? "rgba(0,122,255,0.08)" : "transparent",
                            fontWeight: !selectedSkillId ? 600 : 400,
                          }}
                        >
                          <X className="w-3 h-3 flex-shrink-0 opacity-50" />
                          不使用技能
                        </button>
                        {skills.length === 0 ? (
                          <p className="px-3 py-2 text-xs text-ink-tertiary">暂无已启用技能</p>
                        ) : (
                          skills.map((skill) => (
                            <button
                              key={skill.id}
                              type="button"
                              onMouseEnter={() => setHoveredSkillId(skill.id)}
                              onClick={() => { setSelectedSkillId(skill.id); setSkillPickerOpen(false); setHoveredSkillId(null); }}
                              className="w-full text-left px-3 py-2 text-xs transition-colors duration-100 flex items-center gap-2"
                              style={{
                                color: selectedSkillId === skill.id ? "#007AFF" : "#3C3C43",
                                background: (hoveredSkillId === skill.id || selectedSkillId === skill.id)
                                  ? "rgba(0,122,255,0.08)"
                                  : "transparent",
                                fontWeight: selectedSkillId === skill.id ? 600 : 400,
                              }}
                            >
                              <Zap className="w-3 h-3 flex-shrink-0 opacity-60" />
                              <span className="truncate">{skill.title}</span>
                            </button>
                          ))
                        )}
                      </div>

                      {/* 右：预览面板 */}
                      <div
                        className="rc-dropdown-menu flex w-56 flex-shrink-0 flex-col gap-2 self-start rounded-2xl p-3"
                      >
                        {previewSkill ? (
                          <>
                            <div className="flex items-start gap-2">
                              <div
                                className="w-7 h-7 rounded-xl flex-shrink-0 flex items-center justify-center mt-0.5"
                                style={{ background: "rgba(0,122,255,0.12)", color: "#007AFF" }}
                              >
                                <Zap className="w-3.5 h-3.5" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-ink-primary leading-tight">{previewSkill.title}</p>
                                <p className="text-[10px] font-mono text-ink-tertiary mt-0.5">/{previewSkill.name}</p>
                              </div>
                            </div>

                            {previewSkill.description ? (
                              <p className="text-[11px] leading-[1.6] text-ink-secondary">{previewSkill.description}</p>
                            ) : null}

                            {previewSkill.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {previewSkill.tags.map((tag) => (
                                  <span
                                    key={tag}
                                    className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                                    style={{ background: "rgba(0,122,255,0.1)", color: "#007AFF" }}
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}

                            <div
                              className="rounded-xl px-2.5 py-2 overflow-y-auto"
                              style={{ background: "rgba(0,0,0,0.04)", maxHeight: 160 }}
                            >
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-tertiary mb-1">指令预览</p>
                              <p className="whitespace-pre-wrap break-words text-[11px] leading-[1.6] text-ink-secondary">{previewSkill.prompt}</p>
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full gap-2 py-6 text-center">
                            <Zap className="w-6 h-6 text-ink-tertiary opacity-30" />
                            <p className="text-xs text-ink-tertiary">悬停技能查看详情</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {selectedSkillId && (() => {
                  const skill = skills.find((s) => s.id === selectedSkillId);
                  if (!skill) return null;
                  return (
                    <div
                      className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-medium"
                      style={{ background: "rgba(0,122,255,0.1)", color: "#007AFF" }}
                    >
                      <Zap className="w-3 h-3" />
                      {skill.title}
                      <button
                        type="button"
                        onClick={() => setSelectedSkillId(null)}
                        className="ml-0.5 hover:opacity-60 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })()}

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => void pickAttachments()}
                    disabled={sending || uploadingAttachments}
                    className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-medium transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50"
                    style={{
                      color: "#636366",
                      background: "var(--rc-surface)",
                      boxShadow: "var(--rc-inset-shadow)",
                    }}
                  >
                    <MessageSquare className="w-3 h-3" />
                    {uploadingAttachments ? "读取文件中" : "上传文件"}
                  </button>

                  {attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="inline-flex max-w-full items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-medium"
                      style={{ background: "rgba(0,122,255,0.1)", color: "#007AFF" }}
                    >
                      <MessageSquare className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate max-w-[220px]">{attachment.name}</span>
                      <button
                        type="button"
                        onClick={() => removeAttachment(attachment.id)}
                        className="ml-0.5 hover:opacity-60 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <textarea
                rows={3}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void handleSend();
                  }
                }}
                placeholder={MAIN_ASSISTANT_INPUT_PLACEHOLDER}
                className="w-full rounded-3xl px-5 py-3 text-sm text-ink-primary placeholder:text-ink-tertiary outline-none border-0 resize-none transition-shadow duration-150"
                style={{
                  background: "var(--rc-surface)",
                  boxShadow: "var(--rc-inset-shadow)",
                }}
              />
            </div>
            <button
              onClick={() => void handleSend()}
              disabled={(!input.trim() && attachments.length === 0) || sending || uploadingAttachments}
              className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 text-white transition-all duration-150 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: "linear-gradient(145deg, #1A8AFF, #0062CC)",
                boxShadow: (input.trim() || attachments.length > 0) && !sending && !uploadingAttachments
                  ? "4px 4px 10px rgba(0,62,204,0.4), -3px -3px 8px rgba(58,155,255,0.25)"
                  : "none",
              }}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
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
          background: "linear-gradient(145deg, #F2F6FA, var(--rc-surface))",
          boxShadow: "var(--rc-chip-shadow)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink-tertiary">
          移动到主题
        </div>
        <button
          className="w-full px-3 py-1.5 text-left text-ink-secondary transition-colors hover:bg-nm-dark/8 hover:text-ink-primary"
          onClick={() => void handleMoveSession(contextMenu.session, "")}
        >
          未归档
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
