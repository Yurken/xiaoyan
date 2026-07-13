import { invoke } from "@tauri-apps/api/core";
import { safeListen } from "./tauriEvent";

export type TranslationStreamChunk =
  | { type: "delta"; value: string }
  | { type: "done" }
  | { type: "error"; value: string };

function createTranslationRequestId() {
  return globalThis.crypto?.randomUUID?.() ?? `translation-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function* streamTranslation(
  body: { text: string; targetLang: string; sourceLang?: string; model?: string },
  signal?: AbortSignal,
): AsyncGenerator<TranslationStreamChunk> {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

  const requestId = createTranslationRequestId();
  const queue: TranslationStreamChunk[] = [];
  let done = false;
  let backendStarted = false;
  let resolve: (() => void) | null = null;
  let unlisteners: Array<() => void> = [];
  const cancelBackend = () => {
    invoke("translate_cancel", { requestId }).catch((error) => console.debug("Cancel translation failed:", error));
  };
  const onAbort = () => {
    done = true;
    resolve?.();
    resolve = null;
    cancelBackend();
  };
  const enqueue = (chunk: TranslationStreamChunk) => {
    queue.push(chunk);
    resolve?.();
    resolve = null;
  };
  const wait = () => new Promise<void>((finish) => {
    if (queue.length > 0 || done) return finish();
    resolve = finish;
  });

  try {
    signal?.addEventListener("abort", onAbort);
    unlisteners = await Promise.all([
      safeListen<{ request_id: string; delta: string }>("translation:delta", (event) => {
        if (event.payload.request_id === requestId) enqueue({ type: "delta", value: event.payload.delta });
      }),
      safeListen<{ request_id: string }>("translation:done", (event) => {
        if (event.payload.request_id === requestId) {
          enqueue({ type: "done" });
          done = true;
          resolve?.();
          resolve = null;
        }
      }),
      safeListen<{ request_id: string; error: string }>("translation:error", (event) => {
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

    await invoke("translate_stream", {
      text: body.text,
      targetLang: body.targetLang,
      sourceLang: body.sourceLang ?? null,
      model: body.model ?? null,
      requestId,
    });
    backendStarted = true;

    while (true) {
      await wait();
      while (queue.length > 0) {
        const chunk = queue.shift();
        if (chunk) yield chunk;
      }
      if (done) break;
    }
  } finally {
    signal?.removeEventListener("abort", onAbort);
    if (backendStarted && !done) cancelBackend();
    unlisteners.forEach((unlisten) => unlisten());
  }
}
