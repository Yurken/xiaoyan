import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, BookOpenCheck, FileText, FlaskConical, Loader2, MessageSquare, Send, StickyNote, Upload } from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import { Badge, Button, Card, Input, MarkdownRenderer, Textarea } from "@research-copilot/ui";
import { CcfRatingBadge, VenueTypeBadge } from "../../components/CcfBadges";
import ExternalLink from "../../components/ExternalLink";
import { apiClient, formatErrorMessage } from "../../lib/client";
import { openLink } from "../../lib/links";
import type { AgentPlanStep, AgentRun, ChatMessage, ChatSession, KnowledgeNote, Paper, ResearchInterest } from "@research-copilot/types";

interface ResearchWorkbenchProps {
  interest: ResearchInterest;
}

function upsertRun(runs: AgentRun[], next: AgentRun) {
  const index = runs.findIndex((item) => item.id === next.id);
  if (index === -1) {
    return [...runs, next];
  }
  return runs.map((item) => (item.id === next.id ? next : item));
}

function paperStatusBadge(status: string) {
  if (status === "analyzed") return <Badge variant="success">已分析</Badge>;
  if (status === "reproduced") return <Badge variant="success">已复现</Badge>;
  if (status === "analyzing") return <Badge variant="info">处理中</Badge>;
  if (status === "failed" || status === "error") return <Badge variant="danger">失败</Badge>;
  if (status === "parsed") return <Badge variant="info">已解析</Badge>;
  return <Badge variant="default">已上传</Badge>;
}

function runStatusBadge(status?: AgentRun["status"]) {
  if (status === "done") return <Badge variant="success">完成</Badge>;
  if (status === "failed") return <Badge variant="danger">失败</Badge>;
  if (status === "running") return <Badge variant="info">运行中</Badge>;
  return <Badge variant="default">等待中</Badge>;
}

export default function ResearchWorkbench({ interest }: ResearchWorkbenchProps) {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [notes, setNotes] = useState<KnowledgeNote[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [plan, setPlan] = useState<AgentPlanStep[]>([]);
  const [agentRuns, setAgentRuns] = useState<AgentRun[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshingSession, setRefreshingSession] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [error, setError] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const activeRequestId = useMemo(() => {
    return [...agentRuns]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0]?.request_id;
  }, [agentRuns]);

  const displayedRuns = useMemo(() => {
    return [...agentRuns]
      .filter((run) => !activeRequestId || run.request_id === activeRequestId)
      .sort((a, b) => a.order_index - b.order_index);
  }, [agentRuns, activeRequestId]);

  const refreshSessions = async () => {
    const all = await apiClient.chat.listSessions();
    const related = all.filter((session) => session.context_type === "interest" && session.context_id === interest.id);
    setSessions(related);
    return related;
  };

  const refreshWorkspace = async () => {
    const [relatedPapers, allNotes, relatedSessions] = await Promise.all([
      apiClient.papers.list(0, 50, interest.id),
      apiClient.knowledge.listNotes(),
      refreshSessions(),
    ]);

    setPapers(relatedPapers);
    setNotes(allNotes.filter((note) => note.research_interest_id === interest.id));

    if (selectedSessionId && !relatedSessions.some((session) => session.id === selectedSessionId)) {
      setSelectedSessionId(relatedSessions[0]?.id ?? null);
    } else if (!selectedSessionId && relatedSessions.length > 0) {
      setSelectedSessionId(relatedSessions[0].id);
    }
  };

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError("");
    setMessages([]);
    setPlan([]);
    setAgentRuns([]);
    setSelectedSessionId(null);

    Promise.all([
      apiClient.papers.list(0, 50, interest.id),
      apiClient.knowledge.listNotes(),
      apiClient.chat.listSessions(),
    ])
      .then(([relatedPapers, allNotes, allSessions]) => {
        if (cancelled) return;
        const relatedSessions = allSessions.filter((session) => session.context_type === "interest" && session.context_id === interest.id);
        setPapers(relatedPapers);
        setNotes(allNotes.filter((note) => note.research_interest_id === interest.id));
        setSessions(relatedSessions);
        setSelectedSessionId(relatedSessions[0]?.id ?? null);
        setLoading(false);
      })
      .catch((nextError) => {
        if (!cancelled) {
          setError(formatErrorMessage(nextError));
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [interest.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const unlisten = listen<{ paper_id: string; status: string }>("paper:status", (event) => {
      setPapers((prev) =>
        prev.map((paper) =>
          paper.id === event.payload.paper_id ? { ...paper, status: event.payload.status } : paper
        )
      );
    });

    return () => {
      void unlisten.then((cleanup) => cleanup());
    };
  }, []);

  useEffect(() => {
    if (sending) {
      return;
    }
    if (!selectedSessionId) {
      setMessages([]);
      setPlan([]);
      setAgentRuns([]);
      return;
    }

    let cancelled = false;
    setRefreshingSession(true);

    Promise.all([
      apiClient.chat.getSession(selectedSessionId),
      apiClient.chat.listAgentRuns(selectedSessionId),
    ])
      .then(([session, runs]) => {
        if (cancelled) return;
        setMessages(session.messages ?? []);
        setPlan([]);
        setAgentRuns(runs);
        setError("");
      })
      .catch((nextError) => {
        if (!cancelled) {
          setError(formatErrorMessage(nextError));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setRefreshingSession(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedSessionId, sending]);

  const handleUpload = async () => {
    try {
      setError("");
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        multiple: false,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (!selected) return;

      const selectedPath =
        typeof selected === "string"
          ? selected
          : typeof selected === "object" && selected !== null && "path" in selected
            ? String((selected as { path: unknown }).path)
            : "";

      if (!selectedPath) {
        throw new Error("未识别的文件路径，请重新选择 PDF 文件");
      }

      setUploading(true);
      await apiClient.papers.upload(selectedPath, interest.id);
      await refreshWorkspace();
    } catch (nextError) {
      setError(formatErrorMessage(nextError));
    } finally {
      setUploading(false);
    }
  };

  const handleAnalyze = async (paperId: string) => {
    try {
      setError("");
      setPapers((prev) => prev.map((paper) => (paper.id === paperId ? { ...paper, status: "analyzing" } : paper)));
      await apiClient.papers.analyze(paperId);
    } catch (nextError) {
      setError(formatErrorMessage(nextError));
      setPapers((prev) => prev.map((paper) => (paper.id === paperId ? { ...paper, status: "failed" } : paper)));
    }
  };

  const handleReproduce = async (paperId: string) => {
    try {
      setError("");
      setPapers((prev) => prev.map((paper) => (paper.id === paperId ? { ...paper, status: "analyzing" } : paper)));
      await apiClient.papers.reproduce(paperId);
    } catch (nextError) {
      setError(formatErrorMessage(nextError));
      setPapers((prev) => prev.map((paper) => (paper.id === paperId ? { ...paper, status: "failed" } : paper)));
    }
  };

  const handleSaveNote = async () => {
    if (!noteTitle.trim() || !noteContent.trim()) return;

    try {
      setSavingNote(true);
      setError("");
      const nextNote = await apiClient.knowledge.createNote({
        title: noteTitle.trim(),
        content: noteContent.trim(),
        research_interest_id: interest.id,
      });
      setNotes((prev) => [nextNote, ...prev]);
      setNoteTitle("");
      setNoteContent("");
    } catch (nextError) {
      setError(formatErrorMessage(nextError));
    } finally {
      setSavingNote(false);
    }
  };

  const handleNewSession = () => {
    setSelectedSessionId(null);
    setMessages([]);
    setPlan([]);
    setAgentRuns([]);
    setError("");
  };

  const handleSend = async () => {
    if (!chatInput.trim() || sending) return;
    const text = chatInput.trim();
    const assistantId = `${Date.now()}_assistant`;

    setChatInput("");
    setSending(true);
    setError("");
    setPlan([]);
    setAgentRuns([]);

    const userMessage: ChatMessage = {
      id: `${Date.now()}_user`,
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage, assistantMessage]);

    try {
      let nextSessionId = selectedSessionId ?? undefined;

      for await (const chunk of apiClient.chat.stream({
        session_id: selectedSessionId ?? undefined,
        message: text,
        context_type: "interest",
        context_id: interest.id,
      })) {
        if (chunk.type === "session_id") {
          nextSessionId = chunk.value;
          setSelectedSessionId(chunk.value);
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
              message.id === assistantId ? { ...message, content: message.content + chunk.value } : message
            )
          );
        }
        if (chunk.type === "sources") {
          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantId ? { ...message, sources: chunk.value } : message
            )
          );
        }
        if (chunk.type === "error") {
          const nextError = chunk.value || "请求失败";
          setError(nextError);
          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantId ? { ...message, content: nextError } : message
            )
          );
        }
      }

      await refreshSessions();

      if (nextSessionId) {
        const [session, runs] = await Promise.all([
          apiClient.chat.getSession(nextSessionId),
          apiClient.chat.listAgentRuns(nextSessionId),
        ]);
        setMessages(session.messages ?? []);
        setAgentRuns(runs);
      }
    } catch (nextError) {
      const message = `请求失败：${formatErrorMessage(nextError)}`;
      setError(message);
      setMessages((prev) =>
        prev.map((item) => (item.id === assistantId ? { ...item, content: message } : item))
      );
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-14">
        <Loader2 className="h-6 w-6 animate-spin text-apple-blue" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card padding="md" className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-apple-blue/10 px-3 py-1 text-[11px] font-semibold text-apple-blue">
              <BookOpenCheck className="h-3.5 w-3.5" />
              路线工作台
            </div>
            <p className="mt-3 text-sm font-semibold text-ink-primary">{interest.topic}</p>
            <p className="mt-1 text-xs leading-5 text-ink-tertiary">
              规划完成后，继续在同一个研究上下文里上传论文、发起 Copilot 对话并沉淀笔记。
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { label: "论文", value: papers.length },
              { label: "会话", value: sessions.length },
              { label: "笔记", value: notes.length },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl px-3 py-2"
                style={{ background: "#E8ECF0", boxShadow: "inset 2px 2px 5px #C8CDD3, inset -2px -2px 5px #FFFFFF" }}
              >
                <p className="text-[11px] uppercase tracking-wide text-ink-tertiary">{item.label}</p>
                <p className="mt-1 text-lg font-semibold text-ink-primary">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-2xl border border-apple-red/10 bg-[#F7ECEA] px-3 py-2 text-sm text-apple-red">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span className="break-all">{error}</span>
          </div>
        )}
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_1.35fr_0.95fr]">
        <Card padding="sm" className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-apple-blue" />
              <div>
                <p className="text-sm font-semibold text-ink-primary">关联论文</p>
                <p className="text-[11px] text-ink-tertiary">上传到当前路线，后续分析与复现都留在这里。</p>
              </div>
            </div>
            <Button size="sm" onClick={() => void handleUpload()} loading={uploading}>
              <Upload className="h-4 w-4" />
              上传 PDF
            </Button>
          </div>

          {papers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-nm-dark/10 bg-white/25 px-4 py-8 text-center text-xs text-ink-tertiary">
              还没有关联论文，适合先导入一篇与你当前路线最贴近的 PDF。
            </div>
          ) : (
            <div className="space-y-3">
              {papers.slice(0, 5).map((paper) => (
                <div key={paper.id} className="rounded-2xl border border-nm-dark/10 bg-white/35 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <ExternalLink
                          href={paper.paper_url}
                          className="truncate text-sm font-semibold text-ink-primary hover:text-apple-blue hover:underline"
                        >
                          {paper.title}
                        </ExternalLink>
                        <CcfRatingBadge rating={paper.ccf_rating} />
                        <VenueTypeBadge type={paper.ccf_type} />
                      </div>
                      <p className="mt-1 text-[11px] text-ink-tertiary">
                        {new Date(paper.updated_at || paper.created_at).toLocaleDateString("zh-CN")}
                      </p>
                      {(paper.venue || paper.ccf_area) && (
                        <p className="mt-1 text-[11px] leading-5 text-ink-secondary">
                          {paper.venue ? (
                            <ExternalLink
                              href={paper.venue_url}
                              className="text-[11px] text-ink-secondary hover:text-apple-blue hover:underline"
                            >
                              {paper.venue}
                            </ExternalLink>
                          ) : "未识别来源"}
                          {paper.ccf_area ? ` · ${paper.ccf_area}` : ""}
                        </p>
                      )}
                    </div>
                    {paperStatusBadge(paper.status)}
                  </div>

                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => void handleAnalyze(paper.id)} disabled={paper.status === "analyzing"}>
                      {paper.status === "analyzing" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                      分析
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => void handleReproduce(paper.id)} disabled={paper.status === "analyzing"}>
                      <FlaskConical className="h-3.5 w-3.5" />
                      复现
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card padding="sm" className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-[#34C759]" />
              <div>
                <p className="text-sm font-semibold text-ink-primary">路线 Copilot</p>
                <p className="text-[11px] text-ink-tertiary">围绕这条路线继续追问下一步、论文优先级和实验推进。</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {sessions.length > 0 && (
                <select
                  value={selectedSessionId ?? ""}
                  onChange={(event) => setSelectedSessionId(event.target.value || null)}
                  className="max-w-[220px] rounded-2xl border-0 px-3 py-2 text-xs text-ink-primary outline-none"
                  style={{ background: "#E8ECF0", boxShadow: "inset 2px 2px 5px #C8CDD3, inset -2px -2px 5px #FFFFFF" }}
                >
                  <option value="">新会话</option>
                  {sessions.map((session) => (
                    <option key={session.id} value={session.id}>
                      {session.title || "新会话"}
                    </option>
                  ))}
                </select>
              )}
              <Button size="sm" variant="secondary" onClick={handleNewSession}>
                新会话
              </Button>
            </div>
          </div>

          {(plan.length > 0 || displayedRuns.length > 0) && (
            <div className="rounded-2xl border border-nm-dark/10 bg-white/35 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-tertiary">当前 Agent 过程</p>
              <div className="mt-3 space-y-2">
                {plan.map((step) => {
                  const matchedRun = displayedRuns.find((run) => run.agent_name === step.agent_name);
                  return (
                    <div key={step.agent_name} className="flex items-start justify-between gap-3 rounded-2xl bg-white/55 px-3 py-2">
                      <div>
                        <p className="text-xs font-semibold text-ink-primary">{step.title}</p>
                        <p className="mt-1 text-[11px] text-ink-tertiary">{matchedRun?.summary || step.goal}</p>
                      </div>
                      {runStatusBadge(matchedRun?.status)}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="min-h-[320px] rounded-2xl border border-nm-dark/10 bg-white/30 p-3">
            {refreshingSession ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-apple-blue" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <p className="text-sm font-medium text-ink-primary">从当前路线继续推进</p>
                <p className="mt-2 max-w-md text-xs leading-6 text-ink-tertiary">
                  例如：下一阶段先读哪些论文？上传这篇 PDF 后该怎么安排复现？结合当前基础，路线要怎么收紧？
                </p>
              </div>
            ) : (
              <div className="max-h-[320px] space-y-3 overflow-y-auto pr-1">
                {messages.map((message) => (
                  <div key={message.id} className={message.role === "user" ? "ml-auto max-w-[85%]" : "max-w-[90%]"}>
                    <div
                      className={`rounded-2xl px-4 py-3 text-sm ${
                        message.role === "user" ? "bg-apple-blue text-white" : "bg-white/75 text-ink-primary"
                      }`}
                    >
                      {message.role === "assistant" ? (
                        <MarkdownRenderer content={message.content || "…"} className="text-sm leading-7" onLinkClick={openLink} />
                      ) : (
                        <p className="whitespace-pre-wrap leading-6">{message.content}</p>
                      )}
                    </div>
                    {message.role === "assistant" && message.sources && message.sources.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {message.sources.map((source, index) => (
                          <ExternalLink
                            key={`${source.source}-${index}`}
                            href={source.url}
                            title={source.content}
                            className="rounded-full px-2.5 py-1 text-[11px] text-ink-tertiary"
                          >
                            <span
                              style={{
                                background: "#E8ECF0",
                                boxShadow: "inset 2px 2px 5px #C8CDD3, inset -2px -2px 5px #FFFFFF",
                              }}
                              className="inline-flex rounded-full px-2.5 py-1 hover:text-apple-blue"
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
            )}
          </div>

          <div className="flex gap-2">
            <Input
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void handleSend();
                }
              }}
              placeholder="继续围绕这条路线提问…"
            />
            <Button onClick={() => void handleSend()} loading={sending}>
              <Send className="h-4 w-4" />
              发送
            </Button>
          </div>
        </Card>

        <Card padding="sm" className="space-y-4">
          <div className="flex items-center gap-2">
            <StickyNote className="h-4 w-4 text-[#9A6A00]" />
            <div>
              <p className="text-sm font-semibold text-ink-primary">路线笔记</p>
              <p className="text-[11px] text-ink-tertiary">把对话结论、论文观察和待办沉淀到当前研究方向。</p>
            </div>
          </div>

          <div className="grid gap-3 rounded-2xl border border-nm-dark/10 bg-white/30 p-3">
            <Input
              label="标题"
              value={noteTitle}
              onChange={(event) => setNoteTitle(event.target.value)}
              placeholder="例如：下一阶段优先阅读列表"
            />
            <Textarea
              label="内容"
              value={noteContent}
              onChange={(event) => setNoteContent(event.target.value)}
              placeholder="记录这里的决策、观察、论文差异或下一步动作。"
              rows={5}
            />
            <Button onClick={() => void handleSaveNote()} loading={savingNote}>
              保存到当前路线
            </Button>
          </div>

          {notes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-nm-dark/10 bg-white/25 px-4 py-8 text-center text-xs text-ink-tertiary">
              还没有路线笔记，适合把对话结论或论文观察先记下来。
            </div>
          ) : (
            <div className="space-y-3">
              {notes.slice(0, 4).map((note) => (
                <div key={note.id} className="rounded-2xl border border-nm-dark/10 bg-white/35 p-3">
                  <p className="text-sm font-semibold text-ink-primary">{note.title}</p>
                  <p className="mt-2 line-clamp-4 text-xs leading-6 text-ink-secondary">{note.content}</p>
                  <p className="mt-3 text-[11px] text-ink-tertiary">
                    {new Date(note.updated_at || note.created_at).toLocaleDateString("zh-CN")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
