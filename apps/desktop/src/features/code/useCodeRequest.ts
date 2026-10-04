import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { listen } from "@tauri-apps/api/event";
import { codeApi, formatErrorMessage, type CodeMessage, type CodePermissionRequest, type CodeSession, type CodeToolCall, type CodeToolResult } from "../../lib/client";

interface RequestEvent { session_id: string; request_id: string; }
interface ActiveRequest { id: string; sessionId: string | null; dispatched: boolean; }
interface RequestOptions {
  experimentId: string;
  setSessions: Dispatch<SetStateAction<CodeSession[]>>;
  onError: (message: string) => void;
}

/** Owns one request from preparation through completion, including native listener lifetime. */
export function useCodeRequest({ experimentId, setSessions, onError }: RequestOptions) {
  const [sending, setSending] = useState(false);
  const [taskStartedAt, setTaskStartedAt] = useState<number | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState("");
  const [permissionRequests, setPermissionRequests] = useState<CodePermissionRequest[]>([]);
  const active = useRef<ActiveRequest | null>(null);
  const latestRequest = useRef<string | null>(null);
  const mounted = useRef(true);
  const listenersReady = useRef<Promise<void>>(Promise.resolve());
  const onErrorRef = useRef(onError);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  const finish = useCallback(() => {
    active.current = null;
    if (!mounted.current) return;
    setSending(false);
    setTaskStartedAt(null);
    setRequestId(null);
    setStreamingContent("");
    setPermissionRequests([]);
  }, []);

  const cancelNative = useCallback((id: string) => {
    void codeApi.cancelMessage(id).catch((error) => {
      if (mounted.current && latestRequest.current === id) onErrorRef.current(formatErrorMessage(error));
    });
  }, []);

  const cancelActiveStream = useCallback(() => {
    const request = active.current;
    finish();
    if (request?.dispatched) cancelNative(request.id);
  }, [cancelNative, finish]);

  const isCurrent = useCallback((id: string) => mounted.current && active.current?.id === id, []);

  const begin = useCallback(() => {
    if (!mounted.current || active.current) return null;
    const id = crypto.randomUUID();
    latestRequest.current = id;
    active.current = { id, sessionId: null, dispatched: false };
    setSending(true);
    setTaskStartedAt(Date.now());
    setRequestId(id);
    setStreamingContent("");
    setPermissionRequests([]);
    return id;
  }, []);

  const bindSession = useCallback((id: string, sessionId: string) => {
    if (!isCurrent(id) || !active.current) return false;
    active.current.sessionId = sessionId;
    return true;
  }, [isCurrent]);

  const send = useCallback(async (id: string, action: () => Promise<void>) => {
    try {
      await listenersReady.current;
      if (!isCurrent(id) || !active.current) return;
      active.current.dispatched = true;
      await action();
      // A stop may reach Rust while its command is still preparing the task table.
      // Retry once the command acknowledges registration so the task cannot outlive stop.
      if (!isCurrent(id)) cancelNative(id);
    } catch (error) {
      if (!isCurrent(id)) return;
      finish();
      onErrorRef.current(formatErrorMessage(error));
    }
  }, [cancelNative, finish, isCurrent]);

  useEffect(() => {
    mounted.current = true;
    let disposed = false;
    const cleanups: Array<() => void> = [];
    const accepts = (event: RequestEvent) => !disposed
      && active.current?.id === event.request_id
      && active.current.sessionId === event.session_id;
    const appendMessage = (sessionId: string, message: CodeMessage) => {
      setSessions((previous) => previous.map((session) => session.id === sessionId ? {
        ...session,
        messages: [...session.messages.filter((item) => item.id !== message.id), message],
        updated_at: new Date().toISOString(),
      } : session));
    };
    const subscribe = async <T,>(name: string, handler: (payload: T) => void) => {
      const stop = await listen<T>(name, (event) => {
        if (!disposed) handler(event.payload);
      });
      if (disposed) stop();
      else cleanups.push(stop);
    };
    listenersReady.current = Promise.all([
      subscribe<RequestEvent & { chunk: string }>("code:stream", (event) => {
        if (accepts(event)) setStreamingContent((current) => current + event.chunk);
      }),
      subscribe<RequestEvent & { message_id: string; full_content: string; duration_ms: number; model?: string | null }>("code:done", (event) => {
        if (!accepts(event)) return;
        appendMessage(event.session_id, {
          id: event.message_id, role: "assistant", content: event.full_content,
          model: event.model ?? null, duration_ms: event.duration_ms, created_at: new Date().toISOString(),
        });
        setSessions((previous) => previous.map((session) => session.id === event.session_id
          ? { ...session, model: event.model ?? session.model } : session));
        finish();
      }),
      subscribe<RequestEvent & { message_id: string; tool_call: CodeToolCall }>("code:tool_call", (event) => {
        if (!accepts(event)) return;
        setStreamingContent("");
        setSessions((previous) => previous.map((session) => {
          if (session.id !== event.session_id) return session;
          const messages = [...session.messages];
          const index = messages.findIndex((message) => message.id === event.message_id);
          const message: CodeMessage = index < 0
            ? { id: event.message_id, role: "assistant", content: "", created_at: new Date().toISOString() }
            : messages[index];
          const toolCalls = message.tool_calls ?? [];
          const next = { ...message, tool_calls: toolCalls.some((tool) => tool.id === event.tool_call.id)
            ? toolCalls : [...toolCalls, event.tool_call] };
          if (index < 0) messages.push(next);
          else messages[index] = next;
          return { ...session, messages, updated_at: new Date().toISOString() };
        }));
      }),
      subscribe<RequestEvent & { message_id: string; result: CodeToolResult }>("code:tool_result", (event) => {
        if (!accepts(event)) return;
        appendMessage(event.session_id, {
          id: event.message_id, role: "tool", content: event.result.output,
          tool_results: [event.result], tool_call_id: event.result.tool_call_id, created_at: new Date().toISOString(),
        });
      }),
      subscribe<RequestEvent & { error: string }>("code:error", (event) => {
        if (!accepts(event)) return;
        finish();
        onErrorRef.current(event.error);
      }),
      subscribe<CodePermissionRequest>("code:permission_request", (event) => {
        if (!accepts(event)) return;
        setPermissionRequests((previous) => previous.some((request) => request.id === event.id)
          ? previous : [...previous, event]);
      }),
      subscribe<{ session_id: string }>("code:title_changed", () => {
        void codeApi.listSessions(experimentId).then((result) => {
          if (disposed) return;
          // Title refreshes can race message persistence; retain the live conversation.
          setSessions((previous) => previous.map((session) => {
            const updated = result.sessions?.find((item) => item.id === session.id);
            return updated ? { ...updated, messages: session.messages } : session;
          }));
        }).catch((error) => { if (!disposed) onErrorRef.current(formatErrorMessage(error)); });
      }),
    ]).then(() => undefined);
    // Surface registration errors when sending without leaving an unhandled rejection.
    void listenersReady.current.catch(() => {});
    return () => {
      disposed = true;
      cancelActiveStream();
      latestRequest.current = null;
      mounted.current = false;
      cleanups.forEach((stop) => stop());
    };
  }, [cancelActiveStream, experimentId, finish, setSessions]);

  return {
    sending, taskStartedAt, requestId, streamingContent, permissionRequests,
    setPermissionRequests, begin, isCurrent, bindSession, send, finish, cancelActiveStream,
  };
}
