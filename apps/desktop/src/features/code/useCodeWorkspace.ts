import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePersistentState } from "../../hooks/usePersistentStringState";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  codeApi,
  experimentApi,
  formatErrorMessage,
  settingsApi,
  type CodeSession,
  type CodeMessage,
  type CodeToolCall,
  type CodeToolResult,
} from "../../lib/client";
import type { AppSettings } from "@research-copilot/types";
import { useCodeFileSystem } from "./useCodeFileSystem";
import type { CodeAgentMode, CodeFileAttachment, CodeModelOption, OpenFile } from "./shared";
import { readAttachmentFile } from "./shared";

interface StreamEvent {
  session_id: string;
  request_id: string;
  chunk: string;
}

interface DoneEvent {
  session_id: string;
  request_id: string;
  message_id: string;
  full_content: string;
}

interface ErrorEvent {
  session_id: string;
  request_id: string;
  error: string;
}

interface ToolCallEvent {
  session_id: string;
  request_id: string;
  message_id: string;
  tool_call: CodeToolCall;
}

interface ToolResultEvent {
  session_id: string;
  request_id: string;
  message_id: string;
  result: CodeToolResult;
}

interface UseCodeWorkspaceOptions {
  workingDir?: string | null;
  onWorkingDirChange?: (dir: string | null) => void;
}

export function useCodeWorkspace(experimentId: string, options?: UseCodeWorkspaceOptions) {
  // ── File system ──────────────────────────────────────────────
  const fs = useCodeFileSystem();
  const isControlled = options?.workingDir !== undefined;
  const [internalWorkingDir, setInternalWorkingDir] = usePersistentState<string | null>(
    `rc:experiment:${experimentId}:code:working-dir`,
    null,
  );
  const workingDir = isControlled ? options.workingDir : internalWorkingDir;
  const setWorkingDir = isControlled
    ? (dir: string | null) => options.onWorkingDirChange?.(dir)
    : setInternalWorkingDir;
  const [openFile, setOpenFile] = useState<OpenFile | null>(null);
  const workingDirRestoredRef = useRef<string | null>(null);

  // ── Chat ─────────────────────────────────────────────────────
  const [sessions, setSessions] = useState<CodeSession[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [chatLoading, setChatLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState("");
  const [input, setInput] = useState("");
  const [toast, setToast] = useState("");
  const [agentMode, setAgentMode] = useState<CodeAgentMode>("build");
  const [attachments, setAttachments] = useState<CodeFileAttachment[]>([]);

  const streamingRef = useRef("");
  const unlistenersRef = useRef<UnlistenFn[]>([]);
  const selectedIdRef = useRef<string | null>(null);
  const requestIdRef = useRef<string | null>(null);

  const selected = sessions.find((s) => s.id === selectedId) ?? null;

  // ── Settings / model ─────────────────────────────────────────
  const [currentModel, setCurrentModel] = useState<string>("");
  const [modelOptions, setModelOptions] = useState<CodeModelOption[]>([]);
  const [activeModelOptionId, setActiveModelOptionId] = useState("");
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState("");

  const loadModelOptions = useCallback(async (provider: AppSettings["llm_provider"], settings: AppSettings) => {
    setModelsLoading(true);
    setModelsError("");
    try {
      const remoteModels = await settingsApi.listModels(settings);
      const options: CodeModelOption[] = remoteModels.map((model) => ({
        id: `${provider}:${model}`,
        provider,
        providerLabel: providerLabelForProvider(provider),
        model,
        label: model,
      }));
      setModelOptions(options);

      const current = resolveReproductionModel(settings);
      const matchId = options.find((o) => o.model === current)?.id ?? options[0]?.id ?? "";
      setCurrentModel(current || (options[0]?.model ?? ""));
      setActiveModelOptionId(matchId);
    } catch (err) {
      setModelsError(formatErrorMessage(err));
      // Fallback: build from settings keys if API list fails
      const options = buildCodeModelOptions(settings);
      setModelOptions(options);
      const current = resolveReproductionModel(settings);
      setCurrentModel(current || (options[0]?.model ?? ""));
      setActiveModelOptionId(options.find((o) => o.model === current)?.id ?? options[0]?.id ?? "");
    } finally {
      setModelsLoading(false);
    }
  }, []);

  useEffect(() => {
    settingsApi
      .get()
      .then((settings) => {
        loadModelOptions(settings.llm_provider, settings);
      })
      .catch(() => setCurrentModel(""));
  }, [loadModelOptions]);

  async function changeModelOption(optionId: string) {
    const option = modelOptions.find((item) => item.id === optionId);
    if (!option) return;

    setCurrentModel(option.model);
    setActiveModelOptionId(option.id);

    try {
      await settingsApi.update({
        // Only change the reproduction (构域) role models,
        // leaving the global provider / chat model and other role models unchanged.
        paper_reproduction_model: option.model,
        multi_agent_reproduction_model: option.model,
      });
    } catch (err) {
      showToast(formatErrorMessage(err));
    }
  }

  // ── UI ───────────────────────────────────────────────────────
  const recentWorkingDirs = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    const sorted = [...sessions].sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    );
    for (const s of sorted) {
      if (s.working_dir && !seen.has(s.working_dir)) {
        seen.add(s.working_dir);
        result.push(s.working_dir);
      }
    }
    return result;
  }, [sessions]);

  const [treeOpen, setTreeOpen] = useState(true);
  const [chatCollapsed, setChatCollapsed] = useState(false);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  // 让事件回调始终读到最新 selectedId，避免重复注册监听。
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  // ── Event listeners（仅注册一次）─────────────────────────────
  useEffect(() => {
    let mounted = true;

    async function setup() {
      const unlistenStream = await listen<StreamEvent>("code:stream", (event) => {
        if (!mounted || event.payload.session_id !== selectedIdRef.current) return;
        if (!requestIdRef.current) {
          requestIdRef.current = event.payload.request_id;
          setRequestId(event.payload.request_id);
        }
        streamingRef.current += event.payload.chunk;
        setStreamingContent(streamingRef.current);
      });

      const unlistenDone = await listen<DoneEvent>("code:done", (event) => {
        if (!mounted || event.payload.session_id !== selectedIdRef.current) return;
        const { session_id, message_id, full_content } = event.payload;

        const assistantMsg: CodeMessage = {
          id: message_id,
          role: "assistant",
          content: full_content,
          tool_calls: undefined,
          tool_results: undefined,
          tool_call_id: null,
          tool_id: null,
          model: null,
          created_at: new Date().toISOString(),
        };

        setSessions((prev) =>
          prev.map((s) =>
            s.id === session_id
              ? {
                  ...s,
                  messages: [...s.messages, assistantMsg],
                  updated_at: new Date().toISOString(),
                }
              : s,
          ),
        );

        streamingRef.current = "";
        setStreamingContent("");
        setSending(false);
        setRequestId(null);
        requestIdRef.current = null;
      });

      const unlistenToolCall = await listen<ToolCallEvent>("code:tool_call", (event) => {
        if (!mounted || event.payload.session_id !== selectedIdRef.current) return;
        const { session_id, message_id, tool_call } = event.payload;

        streamingRef.current = "";
        setStreamingContent("");

        setSessions((prev) =>
          prev.map((s) => {
            if (s.id !== session_id) return s;
            const messages = [...s.messages];
            const existingIndex = messages.findIndex((msg) => msg.id === message_id);

            if (existingIndex >= 0) {
              const existing = messages[existingIndex];
              const toolCalls = existing.tool_calls ?? [];
              const alreadyPresent = toolCalls.some((item) => item.id === tool_call.id);
              messages[existingIndex] = {
                ...existing,
                tool_calls: alreadyPresent ? toolCalls : [...toolCalls, tool_call],
              };
            } else {
              messages.push({
                id: message_id,
                role: "assistant",
                content: "",
                tool_calls: [tool_call],
                tool_results: undefined,
                tool_call_id: null,
                tool_id: null,
                model: null,
                created_at: new Date().toISOString(),
              });
            }

            return { ...s, messages, updated_at: new Date().toISOString() };
          }),
        );
      });

      const unlistenToolResult = await listen<ToolResultEvent>("code:tool_result", (event) => {
        if (!mounted || event.payload.session_id !== selectedIdRef.current) return;
        const { session_id, message_id, result } = event.payload;

        const toolMsg: CodeMessage = {
          id: message_id,
          role: "tool",
          content: result.output,
          tool_calls: undefined,
          tool_results: [result],
          tool_call_id: result.tool_call_id,
          tool_id: null,
          model: null,
          created_at: new Date().toISOString(),
        };

        setSessions((prev) =>
          prev.map((s) =>
            s.id === session_id
              ? {
                  ...s,
                  messages: [...s.messages, toolMsg],
                  updated_at: new Date().toISOString(),
                }
              : s,
          ),
        );
      });

      const unlistenError = await listen<ErrorEvent>("code:error", (event) => {
        if (!mounted || event.payload.session_id !== selectedIdRef.current) return;
        showToast(event.payload.error);
        streamingRef.current = "";
        setStreamingContent("");
        setSending(false);
        setRequestId(null);
        requestIdRef.current = null;
      });

      const unlistenTitle = await listen<{ session_id: string }>("code:title_changed", (_event) => {
        if (!mounted) return;
        loadSessions();
      });

      unlistenersRef.current = [
        unlistenStream,
        unlistenDone,
        unlistenToolCall,
        unlistenToolResult,
        unlistenError,
        unlistenTitle,
      ];
    }

    setup();
    return () => {
      mounted = false;
      cancelActiveStream();
      unlistenersRef.current.forEach((fn) => fn());
      unlistenersRef.current = [];
    };
  }, []);

  // 恢复/同步工作目录：当 workingDir 变化时重新加载文件树；
  // 非受控模式下还会从 experiment 的 defaultWorkingDir 自动恢复。
  useEffect(() => {
    if (workingDirRestoredRef.current === workingDir) return;

    async function restore() {
      if (workingDir) {
        workingDirRestoredRef.current = workingDir;
        await fs.listDir(workingDir);
        return;
      }

      if (isControlled) return;

      try {
        const exp = await experimentApi.get(experimentId);
        if (exp.defaultWorkingDir) {
          workingDirRestoredRef.current = exp.defaultWorkingDir;
          setInternalWorkingDir(exp.defaultWorkingDir);
          await fs.listDir(exp.defaultWorkingDir);
        }
      } catch {
        // 离线或 experiment 不存在时忽略
      }
    }

    void restore();
  }, [isControlled, experimentId, workingDir, fs, setInternalWorkingDir]);

  // ── Load sessions ────────────────────────────────────────────
  const loadSessions = useCallback(async () => {
    try {
      const result = await codeApi.listSessions(experimentId);
      setSessions(result.sessions ?? []);
    } catch (err) {
      console.warn("Failed to load code sessions:", err);
    }
  }, [experimentId]);

  useEffect(() => {
    setChatLoading(true);
    loadSessions().finally(() => setChatLoading(false));
  }, [loadSessions]);

  // ── Working directory ────────────────────────────────────────
  async function chooseWorkingDir() {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const picked = await open({ directory: true });
      if (picked && typeof picked === "string") {
        changeWorkingDir(picked);
      }
    } catch (err) {
      showToast(formatErrorMessage(err));
    }
  }

  function changeWorkingDir(dir: string | null) {
    setWorkingDir(dir);
    if (dir) {
      void fs.listDir(dir);
    }
  }

  // ── File operations ──────────────────────────────────────────
  async function openFileByPath(path: string, name: string) {
    const content = await fs.readFile(path);
    if (content !== null) {
      setOpenFile({ path, name, content, dirty: false });
    }
  }

  function updateFileContent(value: string) {
    setOpenFile((prev) => (prev ? { ...prev, content: value, dirty: value !== prev.content } : null));
  }

  async function saveOpenFile() {
    if (!openFile || !openFile.dirty) return;
    const ok = await fs.writeFile(openFile.path, openFile.content);
    if (ok) {
      setOpenFile((prev) => (prev ? { ...prev, dirty: false } : null));
      showToast("文件已保存");
    }
  }

  function closeOpenFile() {
    setOpenFile(null);
  }

  // ── Session operations ───────────────────────────────────────
  async function handleCreateSession() {
    try {
      const session = await codeApi.createSession(experimentId, undefined, workingDir ?? undefined);
      setSessions((prev) => [session, ...prev]);
      setSelectedId(session.id);
    } catch (err) {
      showToast(formatErrorMessage(err));
    }
  }

  async function handleDeleteSession(id: string) {
    try {
      await codeApi.deleteSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (selectedId === id) setSelectedId(null);
    } catch (err) {
      showToast(formatErrorMessage(err));
    }
  }

  function selectSession(session: CodeSession) {
    setSelectedId(session.id);
    if (session.working_dir) {
      // Only load the session's working directory without mutating the session's
      // working_dir or reordering the project list.
      changeWorkingDir(session.working_dir);
    }
  }

  // ── File attachments ────────────────────────────────────────
  async function pickAttachments() {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const picked = await open({ multiple: true, directory: false });
      if (!picked) return;
      const paths = Array.isArray(picked) ? picked : [picked];
      const MAX_ATTACH = 5;
      const remaining = MAX_ATTACH - attachments.length;
      if (remaining <= 0) {
        showToast(`最多附加 ${MAX_ATTACH} 个文件`);
        return;
      }
      const toAdd = paths.slice(0, remaining);
      const newAttachments: CodeFileAttachment[] = [];
      for (const p of toAdd) {
        const result = await readAttachmentFile(p);
        if (result) {
          newAttachments.push({ id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, ...result });
        }
      }
      if (newAttachments.length > 0) {
        setAttachments((prev) => [...prev, ...newAttachments]);
      }
    } catch (err) {
      showToast(formatErrorMessage(err));
    }
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  // ── Cancel ────────────────────────────────────────────────────
  function cancelActiveStream() {
    const rid = requestIdRef.current;
    if (rid) {
      requestIdRef.current = null;
      setRequestId(null);
      void codeApi.cancelMessage(rid);
    }
    setSending(false);
    streamingRef.current = "";
    setStreamingContent("");
  }

  // ── Send ─────────────────────────────────────────────────────
  async function handleSend(skillPrompt?: string) {
    if (!input.trim() || sending) return;

    // 取消上一次请求（如果还在进行中）
    cancelActiveStream();

    // 没有会话时自动新建一个，保证「选目录 → 输入 → 发送」开箱即用。
    let targetId = selectedId;
    if (!targetId) {
      try {
        const session = await codeApi.createSession(experimentId, undefined, workingDir ?? undefined);
        setSessions((prev) => [session, ...prev]);
        setSelectedId(session.id);
        selectedIdRef.current = session.id; // 立即同步，避免流式事件被过滤掉
        targetId = session.id;
      } catch (err) {
        showToast(formatErrorMessage(err));
        return;
      }
    }

    const rawContent = input.trim();
    let content = skillPrompt ? `${skillPrompt}\n\n---\n\n${rawContent}` : rawContent;

    // 注入附件文件内容
    if (attachments.length > 0) {
      const fileContext = attachments
        .map((a, i) => {
          const trunc = a.truncated ? "\n[内容已截断]" : "";
          return `[文件 ${i + 1}] ${a.name}\n路径：${a.path}\n\`\`\`\n${a.content}${trunc}\n\`\`\``;
        })
        .join("\n\n---\n\n");
      content = `${content}\n\n<file-context>\n以下是用户附加的文件内容，请结合这些内容回答问题：\n\n${fileContext}\n</file-context>`;
    }

    setInput("");
    setAttachments([]);
    setSending(true);
    setRequestId(null);
    requestIdRef.current = null;
    streamingRef.current = "";
    setStreamingContent("");

    const userMsg: CodeMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: rawContent,
      created_at: new Date().toISOString(),
    };
    setSessions((prev) =>
      prev.map((s) =>
        s.id === targetId
          ? { ...s, messages: [...s.messages, userMsg], updated_at: new Date().toISOString() }
          : s,
      ),
    );

    try {
      await codeApi.sendMessage(
        targetId,
        content,
        workingDir ?? undefined,
        openFile?.name ?? undefined,
        agentMode,
      );
    } catch (err) {
      showToast(formatErrorMessage(err));
      setSending(false);
    }
  }

  return {
    // File system
    workingDir,
    setWorkingDir: changeWorkingDir,
    chooseWorkingDir,
    openFile,
    openFileByPath,
    updateFileContent,
    saveOpenFile,
    closeOpenFile,
    fs,

    // Chat
    sessions,
    selected,
    selectedId,
    selectSession,
    chatLoading,
    sending,
    requestId,
    streamingContent,
    input,
    setInput,
    toast,
    handleCreateSession,
    handleDeleteSession,
    handleSend,
    cancelActiveStream,
    agentMode,
    setAgentMode,
    attachments,
    pickAttachments,
    removeAttachment,

    // Settings / model
    currentModel,
    modelOptions,
    activeModelOptionId,
    changeModelOption,
    modelsLoading,
    modelsError,

    // Working dir
    recentWorkingDirs,
    changeWorkingDir,

    // UI
    treeOpen,
    setTreeOpen,
    chatCollapsed,
    setChatCollapsed,
  };
}

function resolveReproductionModel(settings: AppSettings): string {
  return settings.multi_agent_reproduction_model || settings.paper_reproduction_model || "";
}

function providerLabelForProvider(provider: AppSettings["llm_provider"]): string {
  switch (provider) {
    case "openai": return "OpenAI";
    case "anthropic": return "Anthropic";
    case "openai_compatible": return "OpenAI-Compatible";
    default: return provider;
  }
}

function buildCodeModelOptions(settings: AppSettings): CodeModelOption[] {
  const candidates: { provider: AppSettings["llm_provider"]; providerLabel: string; model: string }[] = [
    { provider: "openai", providerLabel: "OpenAI", model: settings.openai_chat_model },
    { provider: "anthropic", providerLabel: "Anthropic", model: settings.anthropic_chat_model },
    { provider: "openai_compatible", providerLabel: "OpenAI-Compatible", model: settings.openai_compatible_chat_model },
  ];

  return candidates
    .filter((c) => c.model)
    .map((item) => ({
      id: `${item.provider}:${item.model}`,
      provider: item.provider,
      providerLabel: item.providerLabel,
      model: item.model,
      label: item.model,
    }));
}


