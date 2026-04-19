"use client";

import { useEffect, useRef, useState, Suspense, type KeyboardEvent, type MouseEvent } from "react";
import { useSearchParams } from "next/navigation";
import {
  Bot,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  MessageSquare,
  Plus,
  Radar,
  Send,
  Sparkles,
  Trash2,
  User,
  XCircle,
} from "lucide-react";
import { Badge, Button, Card, MarkdownRenderer } from "@research-copilot/ui";
import {
  MAIN_ASSISTANT_INPUT_PLACEHOLDER,
  MAIN_ASSISTANT_NAME,
  MAIN_ASSISTANT_PANEL_TITLE,
  MAIN_ASSISTANT_STATUS_DESCRIPTION,
  MAIN_ASSISTANT_WELCOME_DESCRIPTION,
  MAIN_ASSISTANT_WELCOME_TITLE,
  toCapabilityModelName,
} from "@research-copilot/types";
import { chatApi } from "@/lib/client";
import type { AgentPlanStep, AgentRun, ChatMessage, ChatSession } from "@research-copilot/types";

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

function runStatusLabel(status: AgentRun["status"]) {
  if (status === "done") return "已完成";
  if (status === "failed") return "失败";
  if (status === "running") return "处理中";
  return "待处理";
}

function runStatusTone(status: AgentRun["status"]) {
  if (status === "done") return "bg-emerald-100 text-emerald-700";
  if (status === "failed") return "bg-rose-100 text-rose-700";
  if (status === "running") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-600";
}

function runStatusIcon(status: AgentRun["status"]) {
  if (status === "done") return <CheckCircle2 className="h-4 w-4" />;
  if (status === "failed") return <XCircle className="h-4 w-4" />;
  return <Clock3 className="h-4 w-4" />;
}

function MissionControl({
  plan,
  runs,
  requestId,
  sending,
}: {
  plan: AgentPlanStep[];
  runs: AgentRun[];
  requestId?: string;
  sending: boolean;
}) {
  const orderedRuns = [...runs].sort((a, b) => {
    if (a.order_index !== b.order_index) return a.order_index - b.order_index;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
  const artifacts = orderedRuns.flatMap((run) => run.artifacts ?? []);

  return (
    <div className="border-t border-slate-200/80 bg-white/70 p-4 xl:w-[360px] xl:flex-shrink-0 xl:border-l xl:border-t-0 xl:p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">执行总览</div>
          <div className="mt-1 text-lg font-semibold text-slate-950">调度视图</div>
        </div>
        <Badge variant={sending ? "warning" : "success"}>{sending ? "处理中" : "就绪"}</Badge>
      </div>

      {requestId && (
        <div className="mb-4 rounded-2xl bg-slate-950 px-4 py-3 text-xs text-slate-300">
          请求 ID
          <div className="mt-1 truncate font-mono text-[11px] text-white">{requestId}</div>
        </div>
      )}

      <div className="space-y-4">
        <Card variant="flat" className="border border-white/80">
          <div className="mb-3 flex items-center gap-2">
            <Radar className="h-4 w-4 text-brand-600" />
            <h3 className="text-sm font-semibold text-slate-900">计划分解</h3>
          </div>
          {plan.length === 0 ? (
            <p className="text-sm leading-6 text-slate-500">尚未启动任务拆解。发送问题后，小妍会在此展示当前执行链路。</p>
          ) : (
            <div className="space-y-3">
              {plan.map((step, index) => (
                <div key={`${step.agent_name}-${index}`} className="rounded-2xl border border-slate-200 bg-white/80 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-slate-900">{index + 1}. {step.title}</span>
                    <Badge variant="default">{toCapabilityModelName(step.agent_name)}</Badge>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-500">{step.goal}</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card variant="flat" className="border border-white/80">
          <div className="mb-3 flex items-center gap-2">
            <BrainCircuit className="h-4 w-4 text-amber-600" />
            <h3 className="text-sm font-semibold text-slate-900">能力域模型执行时间线</h3>
          </div>
          {orderedRuns.length === 0 ? (
            <p className="text-sm leading-6 text-slate-500">暂无能力域模型运行记录。</p>
          ) : (
            <div className="space-y-3">
              {orderedRuns.map((run) => (
                <div key={run.id} className="rounded-2xl border border-slate-200 bg-white/80 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{run.step_name}</div>
                      <div className="mt-1 text-xs text-slate-400">{toCapabilityModelName(run.agent_name)}</div>
                    </div>
                    <div className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${runStatusTone(run.status)}`}>
                      {runStatusIcon(run.status)}
                      {runStatusLabel(run.status)}
                    </div>
                  </div>
                  {(run.summary || run.error) && (
                    <p className="mt-3 text-xs leading-5 text-slate-500">{run.error || run.summary}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card variant="flat" className="border border-white/80">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-600" />
            <h3 className="text-sm font-semibold text-slate-900">结构化产物</h3>
          </div>
          {artifacts.length === 0 ? (
            <p className="text-sm leading-6 text-slate-500">当前对话暂无结构化产物。</p>
          ) : (
            <div className="space-y-3">
              {artifacts.slice(0, 4).map((artifact) => (
                <div key={artifact.id} className="rounded-2xl border border-slate-200 bg-white/80 p-3">
                  <div className="text-sm font-semibold text-slate-900">{artifact.title}</div>
                  <div className="mt-2 line-clamp-5 whitespace-pre-wrap text-xs leading-5 text-slate-500">
                    {artifact.content}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function XiaoYanContent() {
  const searchParams = useSearchParams();
  const contextType = searchParams.get("context_type") || "general";
  const contextId = searchParams.get("context_id") || undefined;
  const contextTitle = searchParams.get("title") || "";

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [plan, setPlan] = useState<AgentPlanStep[]>([]);
  const [agentRuns, setAgentRuns] = useState<AgentRun[]>([]);
  const [requestId, setRequestId] = useState<string>();
  const [activeAssistantId, setActiveAssistantId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [streamError, setStreamError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadSessions = async () => {
    try {
      const data = await chatApi.listSessions();
      setSessions(data);
    } finally {
      setLoadingSessions(false);
    }
  };

  useEffect(() => {
    void loadSessions();
  }, []);

  const loadSession = async (session: ChatSession) => {
    try {
      const [sessionData, runData] = await Promise.all([
        chatApi.getSession(session.id),
        chatApi.listAgentRuns(session.id),
      ]);
      setCurrentSession(sessionData);
      setMessages(sessionData.messages || []);
      setAgentRuns(runData);
      const latestRequestId = runData[0]?.request_id;
      setRequestId(latestRequestId);
      setPlan([]);
      setStreamError("");
      setActiveAssistantId(null);
    } catch {}
  };

  const handleNewChat = () => {
    setCurrentSession(null);
    setMessages([]);
    setPlan([]);
    setAgentRuns([]);
    setRequestId(undefined);
    setStreamError("");
    setActiveAssistantId(null);
  };

  const handleDeleteSession = async (id: string, event: MouseEvent) => {
    event.stopPropagation();
    try {
      await chatApi.deleteSession(id);
      setSessions((prev) => prev.filter((session) => session.id !== id));
      if (currentSession?.id === id) {
        handleNewChat();
      }
    } catch {}
  };

  const handleSend = async () => {
    if (!input.trim() || sending) return;

    const userMessage = input.trim();
    const assistantId = `${Date.now()}_assistant`;

    setInput("");
    setSending(true);
    setStreamError("");
    setPlan([]);
    setAgentRuns([]);
    setRequestId(undefined);
    setActiveAssistantId(assistantId);

    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        role: "user",
        content: userMessage,
        created_at: new Date().toISOString(),
      },
      {
        id: assistantId,
        role: "assistant",
        content: "",
        created_at: new Date().toISOString(),
      },
    ]);

    try {
      let sessionId = currentSession?.id;

      for await (const chunk of chatApi.stream({
        session_id: currentSession?.id,
        message: userMessage,
        context_type: contextType,
        context_id: contextId,
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
          setStreamError(chunk.value);
          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantId
                ? { ...message, content: chunk.value || "请求未完成，请稍后重试。" }
                : message
            )
          );
        }
      }

      if (sessionId && !currentSession) {
        await loadSessions();
        setCurrentSession({ id: sessionId } as ChatSession);
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : "未知错误";
      setStreamError(text);
      setMessages((prev) =>
        prev.map((message) =>
          message.id === assistantId
            ? { ...message, content: `请求未完成：${text}` }
            : message
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

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className="flex h-full bg-[radial-gradient(circle_at_top_left,_rgba(244,114,182,0.08),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.1),_transparent_24%),linear-gradient(180deg,_#f8fafc_0%,_#eef2f7_100%)]">
      <div className="w-60 flex-shrink-0 border-r border-slate-200 bg-white/80 backdrop-blur">
        <div className="border-b border-slate-200 p-4">
          <Button onClick={handleNewChat} className="w-full justify-center">
            <Plus className="h-4 w-4" />
            新建对话
          </Button>
        </div>
        <div className="space-y-2 p-3">
          {loadingSessions ? (
            <div className="py-8 text-center text-sm text-slate-400">加载中…</div>
          ) : sessions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm leading-6 text-slate-400">
              暂无对话记录
            </div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                onClick={() => loadSession(session)}
                className={`group flex cursor-pointer gap-3 rounded-2xl px-3 py-3 transition-all ${
                  currentSession?.id === session.id
                    ? "bg-slate-950 text-white shadow-[0_18px_32px_rgba(15,23,42,0.16)]"
                    : "bg-white/80 text-slate-600 hover:bg-white"
                }`}
              >
                <MessageSquare className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{session.title}</div>
                  <div className={`mt-1 text-xs ${currentSession?.id === session.id ? "text-slate-300" : "text-slate-400"}`}>
                    {new Date(session.updated_at || session.created_at).toLocaleDateString("zh-CN")}
                  </div>
                </div>
                <button
                  onClick={(event) => void handleDeleteSession(session.id, event)}
                  className={`rounded-full p-1 transition ${
                    currentSession?.id === session.id
                      ? "text-slate-300 hover:bg-white/10 hover:text-white"
                      : "text-slate-400 hover:bg-slate-100 hover:text-rose-500"
                  }`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col xl:flex-row">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="border-b border-slate-200/80 bg-white/70 px-6 py-4 backdrop-blur">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-[0_18px_35px_rgba(15,23,42,0.18)]">
                    <BrainCircuit className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-slate-950">{MAIN_ASSISTANT_PANEL_TITLE}</div>
                    <div className="mt-1 text-sm text-slate-500">{MAIN_ASSISTANT_STATUS_DESCRIPTION}</div>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="default">{contextType === "paper" ? "论文上下文" : "通用科研"}</Badge>
                {contextTitle && <Badge variant="info">{contextTitle}</Badge>}
                <Badge variant={sending ? "warning" : "success"}>{sending ? "编排中" : "就绪"}</Badge>
              </div>
            </div>
          </div>

          {streamError && (
            <div className="px-6 pt-4">
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {streamError}
              </div>
            </div>
          )}

          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
            {messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center">
                <div className="w-full max-w-3xl rounded-[32px] border border-white/80 bg-white/70 p-8 shadow-[0_28px_80px_rgba(15,23,42,0.08)] backdrop-blur">
                  <div className="mb-6 flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                      <Sparkles className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="text-xl font-semibold text-slate-950">{MAIN_ASSISTANT_WELCOME_TITLE}</div>
                      <div className="mt-1 text-sm text-slate-500">{MAIN_ASSISTANT_WELCOME_DESCRIPTION}</div>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    {[
                      contextType === "paper" ? "总结这篇论文的核心创新点和局限" : "帮我规划多模态检索方向的学习路径",
                      contextType === "paper" ? "给出这篇论文的复现实验建议" : "帮我做一个关于图神经网络的文献综述切入点",
                      contextType === "paper" ? "这篇论文最关键的实验设计是什么" : "围绕知识图谱问答，列出值得先读的几篇论文",
                    ].map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => setInput(suggestion)}
                        className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-4 text-left text-sm leading-6 text-slate-600 transition hover:border-brand-200 hover:text-slate-900"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {messages.map((message) => (
              <div key={message.id} className={`flex gap-4 ${message.role === "user" ? "flex-row-reverse" : ""}`}>
                <div
                  className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl ${
                    message.role === "user"
                      ? "bg-brand-600 text-white shadow-[0_16px_30px_rgba(0,122,255,0.2)]"
                      : "bg-slate-950 text-white shadow-[0_16px_30px_rgba(15,23,42,0.16)]"
                  }`}
                >
                  {message.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </div>

                <div className={`max-w-[85%] ${message.role === "user" ? "items-end" : "items-start"} flex flex-col gap-2`}>
                  {message.role === "assistant" && (() => {
                    const parsed = splitThoughtFromContent(message.content || "");
                    const isActiveAssistant = message.id === activeAssistantId;
                    const planForBubble = isActiveAssistant ? plan : [];
                    const runsForBubble = isActiveAssistant ? displayedRuns : [];

                    return (
                      <>
                        {(parsed.thought || planForBubble.length > 0 || runsForBubble.length > 0) && (
                          <div className="w-full rounded-2xl border border-amber-200/80 bg-amber-50/80 px-4 py-3">
                            {parsed.thought && (
                              <details open className="group">
                                <summary className="cursor-pointer list-none text-xs font-semibold tracking-wide text-amber-700">
                                  模型推理过程
                                </summary>
                                <div className="mt-2 whitespace-pre-wrap text-xs leading-6 text-amber-900/90">
                                  {parsed.thought}
                                </div>
                              </details>
                            )}

                            {planForBubble.length > 0 && (
                              <div className={`${parsed.thought ? "mt-3" : ""}`}>
                                <div className="mb-2 text-xs font-semibold tracking-wide text-slate-700">能力域模型执行步骤</div>
                                <div className="space-y-2">
                                  {planForBubble.map((step, index) => {
                                    const run = [...runsForBubble]
                                      .reverse()
                                      .find((item) => item.agent_name === step.agent_name);
                                    const status = run?.status || "pending";

                                    return (
                                      <div key={`${step.agent_name}-${index}`} className="rounded-xl border border-white/70 bg-white/80 px-3 py-2">
                                        <div className="flex items-center justify-between gap-2">
                                          <span className="text-xs font-semibold text-slate-900">{index + 1}. {step.title}</span>
                                          <span className={`rounded-full px-2 py-0.5 text-[11px] ${runStatusTone(status)}`}>
                                            {runStatusLabel(status)}
                                          </span>
                                        </div>
                                        <p className="mt-1 text-[11px] leading-5 text-slate-500">{step.goal}</p>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        <div
                          className="rounded-[28px] border border-white/70 bg-white/85 px-5 py-4 text-slate-900 shadow-[0_20px_45px_rgba(15,23,42,0.08)]"
                        >
                          <MarkdownRenderer content={parsed.answer || (sending && isActiveAssistant ? `${MAIN_ASSISTANT_NAME} 正在整理最终答复...` : "…")} />
                        </div>
                      </>
                    );
                  })()}

                  {message.role === "user" && (
                  <div
                    className="rounded-[28px] bg-brand-600 px-5 py-4 text-white shadow-[0_20px_40px_rgba(0,122,255,0.18)]"
                  >
                    <p className="whitespace-pre-wrap text-sm leading-7">{message.content}</p>
                  </div>
                  )}
                  {message.role === "assistant" && message.sources && message.sources.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {message.sources.map((source, index) => (
                        <span
                          key={`${source.source}-${index}`}
                          title={source.content}
                          className="max-w-[220px] truncate rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs text-slate-500"
                        >
                          {source.source || `来源 ${index + 1}`}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            <div ref={messagesEndRef} />
          </div>

          <div className="border-t border-slate-200/80 bg-white/70 px-6 py-5 backdrop-blur">
            <div className="mx-auto flex w-full max-w-4xl items-end gap-3 rounded-[28px] border border-white/70 bg-white/80 p-3 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
              <textarea
                rows={3}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={MAIN_ASSISTANT_INPUT_PLACEHOLDER}
                className="min-h-[84px] flex-1 resize-none rounded-[24px] border-0 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-900 outline-none"
              />
              <Button onClick={handleSend} disabled={!input.trim() || sending} className="h-12 px-5">
                <Send className="h-4 w-4" />
                发送
              </Button>
            </div>
          </div>
        </div>

        <MissionControl
          plan={plan}
          runs={displayedRuns}
          requestId={activeRequestId}
          sending={sending}
        />
      </div>
    </div>
  );
}

export default function XiaoYanPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">加载中…</div>}>
      <XiaoYanContent />
    </Suspense>
  );
}
