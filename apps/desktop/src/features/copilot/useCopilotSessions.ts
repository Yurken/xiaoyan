import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearPersistentValue,
  readPersistentValue,
  writePersistentValue,
} from "../../hooks/usePersistentStringState";
import { apiClient, formatErrorMessage } from "../../lib/client";
import type { ChatSession, ResearchInterest } from "@research-copilot/types";

export const COPILOT_LAST_SESSION_KEY = "rc:copilot:last-session-id";

export function useCopilotSessions() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [interests, setInterests] = useState<ResearchInterest[]>([]);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [loadError, setLoadError] = useState("");
  const [selectedInterestId, setSelectedInterestId] = useState("");
  const [updatingSessionContext, setUpdatingSessionContext] = useState(false);
  const [confirmDeleteGroupId, setConfirmDeleteGroupId] = useState<string | null>(null);
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; session: ChatSession } | null>(null);
  const [menuSessionId, setMenuSessionId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const loadSessionRequestRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    setLoadError("");
    setSessionsLoaded(false);
    apiClient.chat.listSessions()
      .then((data) => {
        if (!cancelled) {
          setSessions(data);
          setSessionsLoaded(true);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(formatErrorMessage(error));
          setSessions([]);
          setSessionsLoaded(true);
        }
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiClient.knowledge.listInterests()
      .then((data) => { if (!cancelled) setInterests(data); })
      .catch(() => { if (!cancelled) setInterests([]); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [contextMenu]);

  useEffect(() => {
    if (!menuSessionId) return;
    const handler = () => setMenuSessionId(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [menuSessionId]);

  const syncSession = (updatedSession: ChatSession) => {
    setSessions((prev) => [updatedSession, ...prev.filter((s) => s.id !== updatedSession.id)]);
    setCurrentSession((prev) => (prev?.id === updatedSession.id ? updatedSession : prev));
  };

  const handleNewChat = () => {
    loadSessionRequestRef.current += 1;
    clearPersistentValue(COPILOT_LAST_SESSION_KEY);
    setCurrentSession(null);
    setLoadError("");
  };

  const handleMoveSession = async (session: ChatSession, interestId: string) => {
    setContextMenu(null);
    try {
      const updated = await apiClient.chat.updateSessionContext(session.id, interestId || undefined);
      syncSession(updated);
      if (currentSession?.id === session.id) setSelectedInterestId(interestId);
    } catch (error) {
      setLoadError(formatErrorMessage(error));
    }
  };

  const loadSession = useCallback(async (session: ChatSession) => {
    const requestId = loadSessionRequestRef.current + 1;
    loadSessionRequestRef.current = requestId;
    try {
      setLoadError("");
      const sessionData = await apiClient.chat.getSession(session.id);
      if (loadSessionRequestRef.current !== requestId) {
        return null;
      }
      setCurrentSession(sessionData);
      writePersistentValue(COPILOT_LAST_SESSION_KEY, sessionData.id);
      setSelectedInterestId(
        sessionData.context_type === "interest" && sessionData.context_id ? sessionData.context_id : ""
      );
      return sessionData;
    } catch (error) {
      if (loadSessionRequestRef.current === requestId) {
        setLoadError(formatErrorMessage(error));
      }
      return null;
    }
  }, []);

  const handleSessionInterestChange = async (nextInterestId: string) => {
    const previousInterestId = selectedInterestId;
    setSelectedInterestId(nextInterestId);
    if (!currentSession) return;
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
      } else if (readPersistentValue(COPILOT_LAST_SESSION_KEY) === sessionId) {
        clearPersistentValue(COPILOT_LAST_SESSION_KEY);
      }
    } catch (error) {
      setLoadError(formatErrorMessage(error));
    }
  };

  const handlePinSession = (sessionId: string) => {
    setSessions((prev) => {
      const idx = prev.findIndex((s) => s.id === sessionId);
      if (idx <= 0) return prev;
      const item = prev[idx];
      const next = [...prev];
      next.splice(idx, 1);
      next.unshift(item);
      return next;
    });
  };

  const startRename = (session: ChatSession) => {
    setRenamingId(session.id);
    setRenameTitle(session.title || "");
    setMenuSessionId(null);
  };

  const commitRename = () => {
    if (renamingId && renameTitle.trim()) {
      setSessions((prev) =>
        prev.map((s) => (s.id === renamingId ? { ...s, title: renameTitle.trim() } : s)),
      );
    }
    setRenamingId(null);
    setRenameTitle("");
  };

  const cancelRename = () => {
    setRenamingId(null);
    setRenameTitle("");
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

  return {
    sessions,
    sessionsLoaded,
    interests,
    currentSession,
    setCurrentSession,
    loadError,
    setLoadError,
    selectedInterestId,
    setSelectedInterestId,
    updatingSessionContext,
    confirmDeleteGroupId,
    setConfirmDeleteGroupId,
    deletingGroupId,
    contextMenu,
    setContextMenu,
    menuSessionId,
    setMenuSessionId,
    renamingId,
    renameTitle,
    setRenameTitle,
    syncSession,
    handleNewChat,
    handleMoveSession,
    loadSession,
    handleSessionInterestChange,
    handleDeleteSession,
    handlePinSession,
    startRename,
    commitRename,
    cancelRename,
    handleDeleteInterestGroup,
  };
}
