import { useCallback, useEffect, useRef, useState } from "react";
import { usePersistentState } from "../../hooks/usePersistentStringState";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  codeApi,
  experimentApi,
  formatErrorMessage,
  type CodeSession,
  type CodeMessage,
} from "../../lib/client";
import { useCodeFileSystem } from "./useCodeFileSystem";
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
}

interface ErrorEvent {
  session_id: string;
  request_id: string;
  error: string;
}

export function useCodeWorkspace(experimentId: string) {
  // ── File system ──────────────────────────────────────────────
  const fs = useCodeFileSystem();
  const [workingDir, setWorkingDir] = usePersistentState<string | null>(
    `rc:experiment:${experimentId}:code:working-dir`,
    null,
  );
  const [openFile, setOpenFile] = useState<OpenFile | null>(null);
  const workingDirRestoredRef = useRef(false);

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

  // 恢复持久化的工作目录：优先使用 localStorage，否则回退到 experiment 的 defaultWorkingDir。
  useEffect(() => {
    if (workingDirRestoredRef.current) return;

    async function restore() {
      if (workingDir) {
        workingDirRestoredRef.current = true;
        await fs.listDir(workingDir);
        return;
      }

      try {
        const exp = await experimentApi.get(experimentId);
        if (exp.defaultWorkingDir) {
          workingDirRestoredRef.current = true;
          setWorkingDir(exp.defaultWorkingDir);
          await fs.listDir(exp.defaultWorkingDir);
        }
      } catch {
        // 离线或 experiment 不存在时忽略
      }
    }

    void restore();
  }, [experimentId, workingDir, fs, setWorkingDir]);

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

    // UI
    treeOpen,
    setTreeOpen,
    chatCollapsed,
    setChatCollapsed,
  };
}
