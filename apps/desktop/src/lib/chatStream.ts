import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type {
  AgentPlanStep,
  AgentRun,
  ChatMessage,
  ChatMode,
  ChatStreamChunk,
} from "@research-copilot/types";

function createChatRequestId() {
  return globalThis.crypto?.randomUUID?.() ?? `chat-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function* streamChat(
  body: {
    session_id?: string;
    message: string;
    context_type?: string;
    context_id?: string;
    chat_mode?: ChatMode;
    tag?: string;
  },
  signal?: AbortSignal
): AsyncGenerator<ChatStreamChunk> {
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }

  const requestId = createChatRequestId();
  const queue: ChatStreamChunk[] = [];
  let done = false;
  let backendStarted = false;
  let resolve: (() => void) | null = null;
  let unlisteners: Array<() => void> = [];

  const cancelBackend = () => {
    invoke("chat_cancel", { requestId }).catch(() => {});
  };

  const onAbort = () => {
    done = true;
    resolve?.();
    resolve = null;
    cancelBackend();
  };

  const enqueue = (chunk: ChatStreamChunk) => {
    queue.push(chunk);
    resolve?.();
    resolve = null;
  };

  const wait = () =>
    new Promise<void>((finish) => {
      if (queue.length > 0 || done) return finish();
      resolve = finish;
    });

  try {
    signal?.addEventListener("abort", onAbort);

    unlisteners = await Promise.all([
      listen<{ request_id: string; plan: AgentPlanStep[] }>("chat:plan", (event) => {
        if (event.payload.request_id === requestId) {
          enqueue({ type: "plan", value: event.payload.plan });
        }
      }),
      listen<{ request_id: string; value: AgentRun }>("chat:agent_start", (event) => {
        if (event.payload.request_id === requestId) {
          enqueue({ type: "agent_start", value: event.payload.value });
        }
      }),
      listen<{ request_id: string; value: AgentRun }>("chat:agent_complete", (event) => {
        if (event.payload.request_id === requestId) {
          enqueue({ type: "agent_complete", value: event.payload.value });
        }
      }),
      listen<{ request_id: string; value: AgentRun }>("chat:agent_error", (event) => {
        if (event.payload.request_id === requestId) {
          enqueue({ type: "agent_error", value: event.payload.value });
        }
      }),
      listen<{ request_id: string; delta: string }>("chat:delta", (event) => {
        if (event.payload.request_id === requestId) {
          enqueue({ type: "delta", value: event.payload.delta });
        }
      }),
      listen<{ request_id: string; query: string }>("chat:searching", (event) => {
        if (event.payload.request_id === requestId) {
          enqueue({ type: "searching", query: event.payload.query });
        }
      }),
      listen<{ request_id: string; value: NonNullable<ChatMessage["sources"]> }>("chat:sources", (event) => {
        if (event.payload.request_id === requestId) {
          enqueue({ type: "sources", value: event.payload.value });
        }
      }),
      listen<{ request_id: string }>("chat:done", (event) => {
        if (event.payload.request_id === requestId) {
          enqueue({ type: "done" });
          done = true;
          resolve?.();
          resolve = null;
        }
      }),
      listen<{ request_id: string; tool_name: string; tool_id: string; result: string; result_id?: string }>("chat:tool_result", (event) => {
        if (event.payload.request_id === requestId) {
          enqueue({
            type: "tool_result",
            tool_name: event.payload.tool_name,
            tool_id: event.payload.tool_id,
            result: event.payload.result,
            result_id: event.payload.result_id,
          });
        }
      }),
      listen<{ request_id: string; error: string }>("chat:error", (event) => {
        if (event.payload.request_id === requestId) {
          enqueue({ type: "error", value: event.payload.error });
          done = true;
          resolve?.();
          resolve = null;
        }
      }),
    ]);

    if (signal?.aborted) {
      onAbort();
      throw new DOMException("Aborted", "AbortError");
    }

    const { session_id } = await invoke<{ request_id: string; session_id: string }>("chat_stream", {
      requestId,
      message: body.message,
      sessionId: body.session_id ?? null,
      contextType: body.context_type ?? null,
      contextId: body.context_id ?? null,
      chatMode: body.chat_mode ?? null,
      tag: body.tag ?? null,
    });
    backendStarted = true;

    yield { type: "request_id", value: requestId };
    yield { type: "session_id", value: session_id };

    while (true) {
      await wait();
      while (queue.length > 0) {
        yield queue.shift()!;
      }
      if (done) break;
    }
  } finally {
    signal?.removeEventListener("abort", onAbort);
    if (backendStarted && !done) {
      cancelBackend();
    }
    unlisteners.forEach((cleanup) => cleanup());
  }
}
