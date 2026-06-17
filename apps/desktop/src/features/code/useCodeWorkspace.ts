import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  codeApi,
  formatErrorMessage,
  type CodeSession,
  type CodeMessage,
  type CodeToolStatus,
} from "../../lib/client";
import { useCodeFileSystem } from "./useCodeFileSystem";
import { CODE_TOOLS } from "./shared";
import type { OpenFile } from "./shared";

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
  tool_id: string;
  model: string | null;
}

interface ErrorEvent {
  session_id: string;
  request_id: string;
  error: string;
}

/** 按 CODE_TOOLS 顺序挑选第一个已安装的工具作为默认。 */
function pickDefaultTool(tools: CodeToolStatus[]): string | null {
  for (const def of CODE_TOOLS) {
    if (tools.find((t) => t.id === def.id && t.installed)) return def.id;
  }
  return tools.find((t) => t.installed)?.id ?? null;
}

export function useCodeWorkspace() {
  // ── File system ──────────────────────────────────────────────
  const fs = useCodeFileSystem();
  const [workingDir, setWorkingDir] = useState<string | null>(null);
  const [openFile, setOpenFile] = useState<OpenFile | null>(null);

  // ── Chat ─────────────────────────────────────────────────────
  const [sessions, setSessions] = useState<CodeSession[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [chatLoading, setChatLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [input, setInput] = useState("");
  const [toast, setToast] = useState("");

  // ── Tools / model ────────────────────────────────────────────
  const [tools, setTools] = useState<CodeToolStatus[]>([]);
  const [toolsLoaded, setToolsLoaded] = useState(false);
  const [activeTool, setActiveToolState] = useState<string | null>(null);
  const [activeModel, setActiveModel] = useState("");

  const streamingRef = useRef("");
  const unlistenersRef = useRef<UnlistenFn[]>([]);
  const selectedIdRef = useRef<string | null>(null);

  const selected = sessions.find((s) => s.id === selectedId) ?? null;
  const anyToolInstalled = useMemo(() => tools.some((t) => t.installed), [tools]);

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
        const { session_id, message_id, full_content, tool_id, model } = event.payload;

        const assistantMsg: CodeMessage = {
          id: message_id,
          role: "assistant",
          content: full_content,
          tool_id,
          model,
          created_at: new Date().toISOString(),
        };

        setSessions((prev) =>
          prev.map((s) =>
            s.id === session_id
              ? {
                  ...s,
                  messages: [...s.messages, assistantMsg],
                  tool_id,
                  model,
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

  // ── Detect tools ─────────────────────────────────────────────
  useEffect(() => {
    codeApi
      .detectTools()
      .then((result) => {
        const list = result.tools ?? [];
        setTools(list);
        setActiveToolState((cur) => cur ?? pickDefaultTool(list));
      })
      .catch(() => setTools([]))
      .finally(() => setToolsLoaded(true));
  }, []);

  // ── Load sessions ────────────────────────────────────────────
  const loadSessions = useCallback(async () => {
    try {
      const result = await codeApi.listSessions();
      setSessions(result.sessions ?? []);
    } catch (err) {
      console.warn("Failed to load code sessions:", err);
    }
  }, []);

  useEffect(() => {
    setChatLoading(true);
    loadSessions().finally(() => setChatLoading(false));
  }, [loadSessions]);

  // ── Tool / model selection ───────────────────────────────────
  const persistSelection = useCallback(
    (toolId: string | null, model: string) => {
      if (!selectedId) return;
      void codeApi
        .updateSession(selectedId, { toolId: toolId ?? undefined, model })
        .catch(() => {});
    },
    [selectedId],
  );

  const setActiveTool = useCallback(
    (toolId: string) => {
      // 切换工具时重置模型为「默认」，因为模型与工具一一对应。
      setActiveToolState(toolId);
      setActiveModel("");
      persistSelection(toolId, "");
    },
    [persistSelection],
  );

  const changeActiveModel = useCallback(
    (model: string) => {
      setActiveModel(model);
      persistSelection(activeTool, model);
    },
    [activeTool, persistSelection],
  );

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
      const session = await codeApi.createSession(undefined, workingDir ?? undefined);
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
    // 恢复该会话最近使用、且当前仍安装的工具/模型。
    if (session.tool_id && tools.find((t) => t.id === session.tool_id && t.installed)) {
      setActiveToolState(session.tool_id);
      setActiveModel(session.model ?? "");
    }
  }

  // ── Send ─────────────────────────────────────────────────────
  async function handleSend() {
    if (!input.trim() || sending) return;
    if (!activeTool) {
      showToast("未检测到可用的代码工具，请先在本机安装。");
      return;
    }
    const toolStatus = tools.find((t) => t.id === activeTool);
    if (!toolStatus?.installed) {
      showToast("当前工具未安装，请切换到已安装的工具。");
      return;
    }

    // 没有会话时自动新建一个，保证「选目录 → 输入 → 发送」开箱即用。
    let targetId = selectedId;
    if (!targetId) {
      try {
        const session = await codeApi.createSession(undefined, workingDir ?? undefined);
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

    // 若打开了文件，附带当前文件名作为上下文提示。
    const effectiveContent = openFile ? `[当前文件: ${openFile.name}]\n\n${content}` : content;

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
        effectiveContent,
        activeTool,
        activeModel || undefined,
        workingDir ?? undefined,
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

    // Tools / model
    tools,
    toolsLoaded,
    anyToolInstalled,
    activeTool,
    setActiveTool,
    activeModel,
    setActiveModel: changeActiveModel,

    // UI
    treeOpen,
    setTreeOpen,
    chatCollapsed,
    setChatCollapsed,
  };
}
