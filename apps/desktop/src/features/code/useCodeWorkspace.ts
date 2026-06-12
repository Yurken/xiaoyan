import { useCallback, useEffect, useRef, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { opencodeApi, formatErrorMessage, type OpenCodeSession, type OpenCodeMessage } from "../../lib/client";
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
  used_fallback: boolean;
}

interface ErrorEvent {
  session_id: string;
  request_id: string;
  error: string;
}

export function useCodeWorkspace() {
  // ── File system ──────────────────────────────────────────────
  const fs = useCodeFileSystem();
  const [workingDir, setWorkingDir] = useState<string | null>(null);
  const [openFile, setOpenFile] = useState<OpenFile | null>(null);

  // ── Chat ─────────────────────────────────────────────────────
  const [sessions, setSessions] = useState<OpenCodeSession[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [chatLoading, setChatLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [input, setInput] = useState("");
  const [toast, setToast] = useState("");
  const [installed, setInstalled] = useState<boolean | null>(null);

  const streamingRef = useRef("");
  const unlistenersRef = useRef<UnlistenFn[]>([]);

  const selected = sessions.find((s) => s.id === selectedId) ?? null;

  // ── UI ───────────────────────────────────────────────────────
  const [treeOpen, setTreeOpen] = useState(true);
  const [chatCollapsed, setChatCollapsed] = useState(false);

  // ── Event listeners ──────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    async function setup() {
      const unlistenStream = await listen<StreamEvent>("opencode:stream", (event) => {
        if (!mounted) return;
        const { session_id, chunk } = event.payload;
        if (session_id !== selectedId) return;
        streamingRef.current += chunk;
        setStreamingContent(streamingRef.current);
      });

      const unlistenDone = await listen<DoneEvent>("opencode:done", (event) => {
        if (!mounted) return;
        const { session_id, message_id, full_content } = event.payload;
        if (session_id !== selectedId) return;

        const assistantMsg: OpenCodeMessage = {
          id: message_id,
          role: "assistant",
          content: full_content,
          created_at: new Date().toISOString(),
        };

        setSessions((prev) =>
          prev.map((s) =>
            s.id === session_id
              ? { ...s, messages: [...s.messages, assistantMsg], updated_at: new Date().toISOString() }
              : s
          )
        );

        streamingRef.current = "";
        setStreamingContent("");
        setSending(false);
      });

      const unlistenError = await listen<ErrorEvent>("opencode:error", (event) => {
        if (!mounted) return;
        if (event.payload.session_id !== selectedId) return;
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
  }, [selectedId]);

  // ── Detect OpenCode ──────────────────────────────────────────
  useEffect(() => {
    opencodeApi.detect()
      .then((result) => setInstalled(result.installed))
      .catch(() => setInstalled(false));
  }, []);

  // ── Load sessions ────────────────────────────────────────────
  const loadSessions = useCallback(async () => {
    try {
      const result = await opencodeApi.listSessions();
      setSessions(result.sessions ?? []);
    } catch (err) {
      console.warn("Failed to load opencode sessions:", err);
    }
  }, []);

  useEffect(() => {
    setChatLoading(true);
    loadSessions().finally(() => setChatLoading(false));
  }, [loadSessions]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  // ── Working directory ────────────────────────────────────────
  async function chooseWorkingDir() {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({ directory: true });
      if (selected && typeof selected === "string") {
        setWorkingDir(selected);
        await fs.listDir(selected);
        // Update session working dir if a session is selected
        if (selectedId) {
          await opencodeApi.updateSession(selectedId, undefined, selected);
        }
      }
    } catch (err) {
      showToast(formatErrorMessage(err));
    }
  }

  async function setWorkingDirForSession(dir: string) {
    setWorkingDir(dir);
    await fs.listDir(dir);
    if (selectedId) {
      await opencodeApi.updateSession(selectedId, undefined, dir);
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
    setOpenFile((prev) => {
      if (!prev) return null;
      return { ...prev, content: value, dirty: value !== prev.content };
    });
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

  // ── Chat operations ──────────────────────────────────────────
  async function handleCreateSession() {
    try {
      const session = await opencodeApi.createSession(undefined, workingDir ?? undefined);
      setSessions((prev) => [session, ...prev]);
      setSelectedId(session.id);
    } catch (err) {
      showToast(formatErrorMessage(err));
    }
  }

  async function handleDeleteSession(id: string) {
    try {
      await opencodeApi.deleteSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (selectedId === id) setSelectedId(null);
    } catch (err) {
      showToast(formatErrorMessage(err));
    }
  }

  async function handleSend() {
    if (!input.trim() || sending || !selectedId) return;

    const content = input.trim();
    setInput("");
    setSending(true);
    streamingRef.current = "";
    setStreamingContent("");

    // Include current file context if a file is open
    let effectiveContent = content;
    if (openFile) {
      effectiveContent = `[当前文件: ${openFile.name}]\n\n${content}`;
    }

    const userMsg: OpenCodeMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content,
      created_at: new Date().toISOString(),
    };

    setSessions((prev) =>
      prev.map((s) =>
        s.id === selectedId
          ? { ...s, messages: [...s.messages, userMsg], updated_at: new Date().toISOString() }
          : s
      )
    );

    try {
      await opencodeApi.sendMessage(selectedId, effectiveContent, workingDir ?? undefined);
    } catch (err) {
      showToast(formatErrorMessage(err));
      setSending(false);
    }
  }

  return {
    // File system
    workingDir,
    setWorkingDir: setWorkingDirForSession,
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
    setSelectedId,
    chatLoading,
    sending,
    streamingContent,
    input,
    setInput,
    toast,
    installed,
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
