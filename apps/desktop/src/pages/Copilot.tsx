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
  Sparkles,
  Trash2,
  User,
  XCircle,
} from "lucide-react";
import { MarkdownRenderer } from "@research-copilot/ui";
import ExternalLink from "../components/ExternalLink";
import { apiClient, formatErrorMessage } from "../lib/client";
import { openLink } from "../lib/links";
import type { AgentPlanStep, AgentRun, ChatMessage, ChatSession, ResearchInterest } from "@research-copilot/types";

function upsertRun(runs: AgentRun[], next: AgentRun) {
  const index = runs.findIndex((item) => item.id === next.id);
  if (index === -1) {
    return [...runs, next];
  }
  return runs.map((item) => (item.id === next.id ? next : item));
}

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
    label: status === "running" ? "执行中" : "等待中",
  };
}

function interestFolderName(interest: ResearchInterest) {
  return interest.folder_name?.trim() || interest.topic;
}

export default function Copilot() {
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
  const bottomRef = useRef<HTMLDivElement>(null);

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

  const sessionGroups = useMemo(() => {
    const grouped = interests.map((interest) => ({
      key: interest.id,
      title: interestFolderName(interest),
      sessions: sessions.filter((session) => session.context_type === "interest" && session.context_id === interest.id),
    }));
    const generalSessions = sessions.filter((session) => session.context_type !== "interest" || !session.context_id);

    return [
      {
        key: "__general__",
        title: "未归档对话",
        sessions: generalSessions,
      },
      ...grouped,
    ];
  }, [interests, sessions]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

  const handleNewChat = () => {
    setCurrentSession(null);
    setMessages([]);
    setPlan([]);
    setAgentRuns([]);
    setRequestId(undefined);
    setLoadError("");
    setActiveAssistantId(null);
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

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    const text = input.trim();
    const assistantId = `${Date.now()}_a`;

    setInput("");
    setSending(true);
    setLoadError("");
    setPlan([]);
    setAgentRuns([]);
    setRequestId(undefined);
    setActiveAssistantId(assistantId);

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: text,
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
        message: text,
        context_type: currentSession?.id ? undefined : (selectedInterestId ? "interest" : undefined),
        context_id: currentSession?.id ? undefined : (selectedInterestId || undefined),
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
          setAgentRuns((prev) => upsertRun(prev, chunk.value));
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
          const errorText = chunk.value || "请求失败";
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
      const message = `请求失败：${formatErrorMessage(error)}`;
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

  const activeRequestId =
    requestId ||
    [...agentRuns].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]?.request_id;

  const displayedRuns = [...agentRuns]
    .filter((run) => !activeRequestId || run.request_id === activeRequestId)
    .sort((a, b) => a.order_index - b.order_index);

  const artifacts = displayedRuns.flatMap((run) => run.artifacts ?? []);

  return (
    <div className="flex h-full" style={{ background: "linear-gradient(180deg, #F3F6FA 0%, #E8ECF0 100%)" }}>
      <div
        className="w-56 flex-shrink-0 flex flex-col"
        style={{
          background: "linear-gradient(180deg, #F0F4F8 0%, #E8ECF0 100%)",
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
            新建多 agent 对话
          </button>
          <div className="mt-2">
            <label className="mb-1 ml-1 block text-[11px] font-medium text-ink-tertiary">新对话主题文件夹</label>
            <select
              value={selectedInterestId}
              onChange={(event) => setSelectedInterestId(event.target.value)}
              className="w-full rounded-2xl border-0 px-3 py-2 text-xs text-ink-primary outline-none"
              style={{ background: "#E8ECF0", boxShadow: "inset 2px 2px 5px #C8CDD3, inset -2px -2px 5px #FFFFFF" }}
            >
              <option value="">未归档</option>
              {interests.map((interest) => (
                <option key={interest.id} value={interest.id}>
                  {interestFolderName(interest)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-1">
          {sessions.length === 0 && interests.length === 0 && (
            <div className="flex flex-col items-center py-8 gap-2">
              <MessageSquare className="w-8 h-8 text-ink-tertiary opacity-40" />
              <p className="text-xs text-ink-tertiary">暂无对话记录</p>
            </div>
          )}
          {sessionGroups.filter((group) => group.key === "__general__" || group.sessions.length > 0).map((group) => (
            <div key={group.key} className="space-y-1">
              <div className="px-3 pt-2 text-[11px] font-semibold text-ink-tertiary">{group.title}</div>
              {group.sessions.length === 0 ? (
                <div className="px-3 py-1.5 text-[11px] text-ink-tertiary/80">暂无会话</div>
              ) : (
                group.sessions.map((session) => (
                  <div
                    key={session.id}
                    className="group flex items-start gap-2 rounded-2xl px-3 py-2.5 text-xs transition-all duration-150"
                    style={
                      currentSession?.id === session.id
                        ? {
                            background: "#E8ECF0",
                            boxShadow: "inset 3px 3px 6px #C8CDD3, inset -3px -3px 6px #FFFFFF",
                            color: "#007AFF",
                          }
                        : { color: "#3C3C43" }
                    }
                  >
                    <button className="min-w-0 flex-1 text-left" onClick={() => void loadSession(session)}>
                      <div className="truncate font-medium">{session.title || "新对话"}</div>
                      <div className="mt-1 text-[11px] opacity-70">
                        {new Date(session.updated_at || session.created_at).toLocaleDateString("zh-CN")}
                      </div>
                    </button>
                    <button
                      onClick={() => void handleDeleteSession(session.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-ink-tertiary hover:text-apple-red"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 min-w-0 flex">
        <div className="flex-1 flex flex-col min-w-0 bg-nm-bg">
          <div
            className="h-14 flex items-center px-5 justify-between"
            style={{
              background: "linear-gradient(180deg, #F0F4F8, #E8ECF0)",
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
                <span className="font-semibold text-sm text-ink-primary">Copilot 协同台</span>
                <p className="text-xs text-ink-tertiary mt-0.5">调度 agent 与专项 agent 协同工作</p>
              </div>
            </div>
            <div
              className="px-3 py-1.5 rounded-full text-xs font-medium"
              style={{
                background: "#E8ECF0",
                color: sending ? "#FF9500" : "#34C759",
                boxShadow: "inset 2px 2px 5px #C8CDD3, inset -2px -2px 5px #FFFFFF",
              }}
            >
              {sending ? "运行中" : "就绪"}
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

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-4 pb-12">
                <div
                  className="w-20 h-20 rounded-[28px] flex items-center justify-center"
                  style={{
                    background: "linear-gradient(145deg, #F59E0B, #F97316)",
                    boxShadow: "6px 6px 14px rgba(249,115,22,0.28), -4px -4px 10px rgba(255,214,153,0.25)",
                  }}
                >
                  <Sparkles className="w-9 h-9 text-white" />
                </div>
                <div className="text-center max-w-md">
                  <p className="font-semibold text-ink-primary">多 agent 研究助手</p>
                  <p className="text-sm text-ink-tertiary mt-2 leading-6">
                    发送问题后，系统会自动拆解为检索、规划、综述、论文解析和复现等链路，并把每一步显示在右侧。
                  </p>
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
                                <summary className="cursor-pointer text-xs font-semibold text-[#9A6A00]">模型思考过程</summary>
                                <div className="mt-2 whitespace-pre-wrap text-xs leading-5 text-[#5A4A2F]">
                                  {parsed.thought}
                                </div>
                              </details>
                            )}

                            {planForBubble.length > 0 && (
                              <div className={parsed.thought ? "mt-3" : ""}>
                                <div className="mb-2 text-xs font-semibold text-ink-secondary">拆解步骤</div>
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
                                          background: "#E8ECF0",
                                          boxShadow: "inset 2px 2px 5px #C8CDD3, inset -2px -2px 5px #FFFFFF",
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
                            boxShadow: "4px 4px 10px #C8CDD3, -4px -4px 10px #FFFFFF",
                            color: "#1C1C1E",
                          }}
                        >
                          <MarkdownRenderer
                            content={parsed.answer || (sending && isActiveAssistant ? "正在整理最终回答..." : "…")}
                            onLinkClick={openLink}
                          />
                        </div>
                      </>
                    );
                  })()}

                  {message.role === "user" && (
                    <div
                      className="rounded-3xl px-4 py-3 text-sm"
                      style={{
                        background: "linear-gradient(145deg, #1A8AFF, #0062CC)",
                        boxShadow: "4px 4px 10px rgba(0,62,204,0.3), -3px -3px 8px rgba(58,155,255,0.2)",
                        color: "#FFFFFF",
                      }}
                    >
                      <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                    </div>
                  )}
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
                              background: "#E8ECF0",
                              boxShadow: "inset 2px 2px 5px #C8CDD3, inset -2px -2px 5px #FFFFFF",
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

          <div className="p-4 flex gap-3 items-end">
            <div className="flex-1">
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
                placeholder="输入问题… 系统会自动选择合适的 agent 链路"
                className="w-full rounded-3xl px-5 py-3 text-sm text-ink-primary placeholder:text-ink-tertiary outline-none border-0 resize-none transition-shadow duration-150"
                style={{
                  background: "#E8ECF0",
                  boxShadow: "inset 2px 2px 5px #C8CDD3, inset -2px -2px 5px #FFFFFF",
                }}
              />
            </div>
            <button
              onClick={() => void handleSend()}
              disabled={!input.trim() || sending}
              className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 text-white transition-all duration-150 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: "linear-gradient(145deg, #1A8AFF, #0062CC)",
                boxShadow: input.trim() && !sending
                  ? "4px 4px 10px rgba(0,62,204,0.4), -3px -3px 8px rgba(58,155,255,0.25)"
                  : "none",
              }}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div
          className="w-[340px] flex-shrink-0 p-4 space-y-4"
          style={{
            background: "linear-gradient(180deg, #EEF2F6 0%, #E6EBF1 100%)",
            boxShadow: "-4px 0 10px rgba(0,0,0,0.04)",
          }}
        >
          <div
            className="rounded-3xl p-4"
            style={{
              background: "linear-gradient(145deg, #F2F6FA, #E0E4E8)",
              boxShadow: "4px 4px 10px #C8CDD3, -4px -4px 10px #FFFFFF",
            }}
          >
            <div className="text-xs uppercase tracking-[0.22em] text-ink-tertiary">任务总览</div>
            <div className="mt-1 text-base font-semibold text-ink-primary">调度视图</div>
            {activeRequestId && (
              <div className="mt-3 rounded-2xl px-3 py-2 text-[11px] text-white break-all"
                style={{ background: "linear-gradient(145deg, #111827, #334155)" }}>
                {activeRequestId}
              </div>
            )}
          </div>

          <div
            className="rounded-3xl p-4"
            style={{
              background: "linear-gradient(145deg, #F2F6FA, #E0E4E8)",
              boxShadow: "4px 4px 10px #C8CDD3, -4px -4px 10px #FFFFFF",
            }}
          >
            <div className="text-sm font-semibold text-ink-primary mb-3">计划分解</div>
            <div className="space-y-3">
              {plan.length === 0 ? (
                <p className="text-xs text-ink-tertiary leading-5">发送问题后，调度 agent 会在这里显示拆解步骤。</p>
              ) : (
                plan.map((step, index) => (
                  <div
                    key={`${step.agent_name}-${index}`}
                    className="rounded-2xl px-3 py-3"
                    style={{
                      background: "#E8ECF0",
                      boxShadow: "inset 2px 2px 5px #C8CDD3, inset -2px -2px 5px #FFFFFF",
                    }}
                  >
                    <div className="text-sm font-semibold text-ink-primary">{index + 1}. {step.title}</div>
                    <div className="text-xs text-apple-blue mt-1">{step.agent_name}</div>
                    <p className="text-xs text-ink-tertiary mt-2 leading-5">{step.goal}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div
            className="rounded-3xl p-4"
            style={{
              background: "linear-gradient(145deg, #F2F6FA, #E0E4E8)",
              boxShadow: "4px 4px 10px #C8CDD3, -4px -4px 10px #FFFFFF",
            }}
          >
            <div className="text-sm font-semibold text-ink-primary mb-3">执行时间线</div>
            <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
              {displayedRuns.length === 0 ? (
                <p className="text-xs text-ink-tertiary leading-5">还没有 agent 运行记录。</p>
              ) : (
                displayedRuns.map((run) => {
                  const tone = runTone(run.status);
                  return (
                    <div
                      key={run.id}
                      className="rounded-2xl px-3 py-3"
                      style={{
                        background: "#E8ECF0",
                        boxShadow: "inset 2px 2px 5px #C8CDD3, inset -2px -2px 5px #FFFFFF",
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold text-ink-primary">{run.step_name}</div>
                          <div className="text-xs text-ink-tertiary mt-1">{run.agent_name}</div>
                        </div>
                        <div
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium"
                          style={{ color: tone.color, background: tone.background }}
                        >
                          {tone.icon}
                          {tone.label}
                        </div>
                      </div>
                      {(run.summary || run.error) && (
                        <p className="text-xs text-ink-tertiary mt-3 leading-5">{run.error || run.summary}</p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div
            className="rounded-3xl p-4"
            style={{
              background: "linear-gradient(145deg, #F2F6FA, #E0E4E8)",
              boxShadow: "4px 4px 10px #C8CDD3, -4px -4px 10px #FFFFFF",
            }}
          >
            <div className="text-sm font-semibold text-ink-primary mb-3">结构化产物</div>
            <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
              {artifacts.length === 0 ? (
                <p className="text-xs text-ink-tertiary leading-5">当前对话暂无结构化产物。</p>
              ) : (
                artifacts.slice(0, 4).map((artifact) => (
                  <div
                    key={artifact.id}
                    className="rounded-2xl px-3 py-3"
                    style={{
                      background: "#E8ECF0",
                      boxShadow: "inset 2px 2px 5px #C8CDD3, inset -2px -2px 5px #FFFFFF",
                    }}
                  >
                    <div className="text-sm font-semibold text-ink-primary">{artifact.title}</div>
                    <div className="mt-2 line-clamp-5 text-xs text-ink-tertiary">
                      <MarkdownRenderer content={artifact.content} className="text-xs leading-5" onLinkClick={openLink} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
