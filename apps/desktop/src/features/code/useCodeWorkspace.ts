import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePersistentState } from "../../hooks/usePersistentStringState";
import {
  codeApi,
  experimentApi,
  formatErrorMessage,
  type CodeSession,
  type CodeMessage,
} from "../../lib/client";
import { useCodeFileSystem } from "./useCodeFileSystem";
import { useCodeAttachments } from "./useCodeAttachments";
import { useCodeContextPack } from "./useCodeContextPack";
import { useCodeModelOptions } from "./useCodeModelOptions";
import { useCodeRequest } from "./useCodeRequest";
import type { CodeAgentMode, OpenFile } from "./shared";
import { buildCodePromptContent } from "./codeMessageContent";

function generateMessageId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`;
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
  const defaultDirAutoRestoredRef = useRef(false);

  // ── Chat ─────────────────────────────────────────────────────
  const [sessions, setSessions] = useState<CodeSession[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [chatLoading, setChatLoading] = useState(true);
  const [creatingSession, setCreatingSession] = useState(false);
  const [input, setInput] = useState("");
  const [toast, setToast] = useState("");
  const [agentMode, setAgentMode] = useState<CodeAgentMode>("build");

  const selected = sessions.find((s) => s.id === selectedId) ?? null;

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

  const attachmentsController = useCodeAttachments({ onToast: showToast });
  const modelOptionsController = useCodeModelOptions({ onToast: showToast });
  const contextPack = useCodeContextPack({
    workingDir,
    currentFile: openFile?.path ?? null,
    onInputChange: setInput,
    onToast: showToast,
  });

  const request = useCodeRequest({ experimentId, setSessions, onError: showToast });
  const {
    sending, taskStartedAt, requestId, streamingContent, permissionRequests,
    setPermissionRequests, cancelActiveStream,
  } = request;

  // 恢复/同步工作目录：当 workingDir 变化时重新加载文件树；
  // 非受控模式下只在初始化时从 experiment 的 defaultWorkingDir 自动恢复一次。
  useEffect(() => {
    if (workingDirRestoredRef.current === workingDir) return;

    async function restore() {
      if (workingDir) {
        workingDirRestoredRef.current = workingDir;
        await fs.listDir(workingDir);
        return;
      }

      // workingDir 被显式清空时，同步清空文件树。
      workingDirRestoredRef.current = null;
      fs.setEntries([]);

      if (isControlled || defaultDirAutoRestoredRef.current) return;

      try {
        const exp = await experimentApi.get(experimentId);
        if (exp.defaultWorkingDir) {
          setInternalWorkingDir(exp.defaultWorkingDir);
          await fs.listDir(exp.defaultWorkingDir);
        }
      } catch {
        // 离线或 experiment 不存在时忽略
      }
    }

    // 标记已做过初始化恢复判断，避免用户手动清空后被再次覆盖。
    defaultDirAutoRestoredRef.current = true;
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
      setOpenFile({ path, name, content, originalContent: content, dirty: false });
    }
  }

  function updateFileContent(value: string) {
    setOpenFile((prev) => (prev ? { ...prev, content: value, dirty: value !== prev.originalContent } : null));
  }

  async function saveOpenFile() {
    if (!openFile || !openFile.dirty) return;
    const ok = await fs.writeFile(openFile.path, openFile.content);
    if (ok) {
      setOpenFile((prev) => (prev ? { ...prev, originalContent: prev.content, dirty: false } : null));
      showToast("文件已保存");
    }
  }

  function closeOpenFile() {
    setOpenFile(null);
  }

  // ── Session operations ───────────────────────────────────────
  async function handleCreateSession() {
    if (creatingSession) return;
    // 当前已选中空会话时，避免重复创建。
    if (selected?.messages.length === 0) return;

    cancelActiveStream();
    setCreatingSession(true);
    try {
      const session = await codeApi.createSession(experimentId, undefined, workingDir ?? undefined);
      setSessions((prev) => [session, ...prev]);
      setSelectedId(session.id);
    } catch (err) {
      showToast(formatErrorMessage(err));
    } finally {
      setCreatingSession(false);
    }
  }

  async function handleDeleteSession(id: string) {
    if (selectedId === id) cancelActiveStream();
    try {
      await codeApi.deleteSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (selectedId === id) setSelectedId(null);
    } catch (err) {
      showToast(formatErrorMessage(err));
    }
  }

  function selectSession(session: CodeSession) {
    if (selectedId !== session.id) cancelActiveStream();
    setSelectedId(session.id);
    if (session.working_dir) {
      // Only load the session's working directory without mutating the session's
      // working_dir or reordering the project list.
      changeWorkingDir(session.working_dir);
    }
  }

  async function resolvePermission(permissionId: string, approved: boolean, message?: string) {
    setPermissionRequests((prev) => prev.filter((item) => item.id !== permissionId));
    try {
      await codeApi.resolvePermission(permissionId, approved, message);
    } catch (err) {
      showToast(formatErrorMessage(err));
    }
  }

  // ── Send ─────────────────────────────────────────────────────
  async function handleSend(skillPrompt?: string) {
    if (!input.trim() || sending) return;
    const rawContent = input.trim();
    setInput("");
    attachmentsController.clearAttachments();
    await sendUserContent(rawContent, { skillPrompt });
  }

  async function sendUserContent(
    rawContent: string,
    options?: { skillPrompt?: string; skipAttachments?: boolean },
  ) {
    if (!rawContent.trim() || sending) return;

    const activeRequestId = request.begin();
    if (!activeRequestId) return;

    // 没有会话时自动新建一个，保证「选目录 → 输入 → 发送」开箱即用。
    let targetId = selectedId;
    if (!targetId) {
      try {
        const session = await codeApi.createSession(experimentId, undefined, workingDir ?? undefined);
        setSessions((prev) => [session, ...prev]);
        if (!request.isCurrent(activeRequestId)) return;
        setSelectedId(session.id);
        targetId = session.id;
      } catch (err) {
        if (request.isCurrent(activeRequestId)) {
          request.finish();
          showToast(formatErrorMessage(err));
        }
        return;
      }
    }
    if (!request.bindSession(activeRequestId, targetId)) return;

    const promptContent = buildCodePromptContent({
      displayContent: rawContent,
      skillPrompt: options?.skillPrompt,
      attachments: options?.skipAttachments ? [] : attachmentsController.attachments,
    });

    const userMessageId = generateMessageId();
    const userMsg: CodeMessage = {
      id: userMessageId,
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

    await request.send(activeRequestId, () => codeApi.sendMessage(
      targetId,
      rawContent,
      promptContent,
      workingDir ?? undefined,
      openFile?.name ?? undefined,
      agentMode,
      userMessageId,
      activeRequestId,
      modelOptionsController.currentModel || undefined,
    ));
  }

  async function handleEditAndResend(messageId: string, newText: string) {
    if (sending) return;
    const trimmed = newText.trim();
    if (!trimmed) return;

    const session = selected;
    if (!session) return;
    const idx = session.messages.findIndex((m) => m.id === messageId && m.role === "user");
    if (idx < 0) return;

    // 乐观更新：截断本地消息到目标消息之前
    const truncated = session.messages.slice(0, idx);
    setSessions((prev) =>
      prev.map((s) =>
        s.id === session.id
          ? { ...s, messages: truncated, updated_at: new Date().toISOString() }
          : s,
      ),
    );

    try {
      await codeApi.editMessage(session.id, messageId);
    } catch (err) {
      showToast(formatErrorMessage(err));
      // 失败时回滚：重新加载会话
      void codeApi.getSession(session.id).then((s) => {
        setSessions((prev) =>
          prev.map((item) => (item.id === s.id ? s : item)),
        );
      }).catch(() => {});
      return;
    }

    await sendUserContent(trimmed, { skipAttachments: true });
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
    taskStartedAt,
    creatingSession,
    requestId,
    streamingContent,
    input,
    setInput,
    toast,
    permissionRequests,
    resolvePermission,
    handleCreateSession,
    handleDeleteSession,
    handleSend,
    handleEditAndResend,
    cancelActiveStream,
    agentMode,
    setAgentMode,
    attachments: attachmentsController.attachments,
    pickAttachments: attachmentsController.pickAttachments,
    pickFromDrop: attachmentsController.pickFromDrop,
    removeAttachment: attachmentsController.removeAttachment,
    contextPack,

    // Settings / model
    currentModel: modelOptionsController.currentModel,
    modelOptions: modelOptionsController.modelOptions,
    activeModelOptionId: modelOptionsController.activeModelOptionId,
    changeModelOption: modelOptionsController.changeModelOption,
    modelsLoading: modelOptionsController.modelsLoading,
    modelsError: modelOptionsController.modelsError,

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
