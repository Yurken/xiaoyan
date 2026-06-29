import { useCallback, useEffect, useRef, useState } from "react";
import { usePersistentState } from "../../hooks/usePersistentStringState";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  codeApi,
  experimentApi,
  formatErrorMessage,
  settingsApi,
  type CodeSession,
  type CodeMessage,
} from "../../lib/client";
import type { AppSettings } from "@research-copilot/types";
import { useCodeFileSystem } from "./useCodeFileSystem";
import type { CodeModelOption, OpenFile } from "./shared";

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

interface UseCodeWorkspaceOptions {
  workingDir?: string | null;
  onWorkingDirChange?: (dir: string) => void;
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
    ? (dir: string) => options.onWorkingDirChange?.(dir)
    : setInternalWorkingDir;
  const [openFile, setOpenFile] = useState<OpenFile | null>(null);
  const workingDirRestoredRef = useRef<string | null>(null);

  // ── Chat ─────────────────────────────────────────────────────
  const [sessions, setSessions] = useState<CodeSession[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [chatLoading, setChatLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [input, setInput] = useState("");
  const [toast, setToast] = useState("");

  const streamingRef = useRef("");
  const unlistenersRef = useRef<UnlistenFn[]>([]);
  const selectedIdRef = useRef<string | null>(null);

  const selected = sessions.find((s) => s.id === selectedId) ?? null;

  // ── Settings / model ─────────────────────────────────────────
  const [currentModel, setCurrentModel] = useState<string>("");
  const [modelOptions, setModelOptions] = useState<CodeModelOption[]>([]);
  const [activeModelOptionId, setActiveModelOptionId] = useState("");

  useEffect(() => {
    settingsApi
      .get()
      .then((settings) => {
        applySettingsModelState(settings);
      })
      .catch(() => setCurrentModel(""));
  }, []);

  function applySettingsModelState(settings: AppSettings) {
    const options = buildCodeModelOptions(settings);
    const active = optionIdForProvider(settings.llm_provider, resolveCurrentModel(settings));
    setCurrentModel(resolveCurrentModel(settings));
    setModelOptions(options);
    setActiveModelOptionId(active);
  }

  async function changeModelOption(optionId: string) {
    const option = modelOptions.find((item) => item.id === optionId);
    if (!option) return;

    setCurrentModel(option.model);
    setActiveModelOptionId(option.id);

    const modelKey = modelKeyForProvider(option.provider);
    try {
      await settingsApi.update({
        llm_provider: option.provider,
        [modelKey]: option.model,
      });
    } catch (err) {
      showToast(formatErrorMessage(err));
    }
  }

  // ── UI ───────────────────────────────────────────────────────
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
      });

      const unlistenError = await listen<ErrorEvent>("code:error", (event) => {
        if (!mounted || event.payload.session_id !== selectedIdRef.current) return;
        showToast(event.payload.error);
        streamingRef.current = "";
        setStreamingContent("");
        setSending(false);
      });

      unlistenersRef.current = [unlistenStream, unlistenDone, unlistenError];
    }

    setup();
    return () => {
      mounted = false;
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
        await applyWorkingDir(picked);
      }
    } catch (err) {
      showToast(formatErrorMessage(err));
    }
  }

  async function applyWorkingDir(dir: string) {
    setWorkingDir(dir);
    await fs.listDir(dir);
    if (selectedId) {
      await codeApi.updateSession(selectedId, { workingDir: dir }).catch(() => {});
    }
    await experimentApi.update(experimentId, { defaultWorkingDir: dir }).catch(() => {});
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
      void applyWorkingDir(session.working_dir);
    }
  }

  // ── Send ─────────────────────────────────────────────────────
  async function handleSend() {
    if (!input.trim() || sending) return;

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

    const content = input.trim();
    setInput("");
    setSending(true);
    streamingRef.current = "";
    setStreamingContent("");

    const userMsg: CodeMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content,
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
      );
    } catch (err) {
      showToast(formatErrorMessage(err));
      setSending(false);
    }
  }

  return {
    // File system
    workingDir,
    setWorkingDir: applyWorkingDir,
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
    streamingContent,
    input,
    setInput,
    toast,
    handleCreateSession,
    handleDeleteSession,
    handleSend,

    // Settings / model
    currentModel,
    modelOptions,
    activeModelOptionId,
    changeModelOption,

    // UI
    treeOpen,
    setTreeOpen,
    chatCollapsed,
    setChatCollapsed,
  };
}

function resolveCurrentModel(settings: AppSettings): string {
  switch (settings.llm_provider) {
    case "openai":
      return settings.openai_chat_model || "OpenAI";
    case "anthropic":
      return settings.anthropic_chat_model || "Anthropic";
    case "openai_compatible":
      return settings.openai_compatible_chat_model || "OpenAI Compatible";
    default:
      return "小妍";
  }
}

function buildCodeModelOptions(settings: AppSettings): CodeModelOption[] {
  return [
    {
      provider: "openai" as const,
      providerLabel: "OpenAI",
      model: settings.openai_chat_model || "gpt-4o-mini",
    },
    {
      provider: "anthropic" as const,
      providerLabel: "Anthropic",
      model: settings.anthropic_chat_model || "claude-3-5-haiku-20241022",
    },
    {
      provider: "openai_compatible" as const,
      providerLabel: "OpenAI-Compatible",
      model: settings.openai_compatible_chat_model || "deepseek-chat",
    },
  ].map((item) => ({
    ...item,
    id: optionIdForProvider(item.provider, item.model),
    label: `${item.providerLabel} · ${item.model}`,
  }));
}

function optionIdForProvider(provider: AppSettings["llm_provider"], model: string): string {
  return `${provider}:${model}`;
}

function modelKeyForProvider(
  provider: AppSettings["llm_provider"],
): "openai_chat_model" | "anthropic_chat_model" | "openai_compatible_chat_model" {
  if (provider === "openai") return "openai_chat_model";
  if (provider === "anthropic") return "anthropic_chat_model";
  return "openai_compatible_chat_model";
}
