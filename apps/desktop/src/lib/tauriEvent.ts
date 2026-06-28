import {
  listen,
  TauriEvent,
  type EventCallback,
  type EventName,
  type UnlistenFn,
} from "@tauri-apps/api/event";
import { PhysicalPosition } from "@tauri-apps/api/dpi";
import { getCurrentWindow, type DragDropEvent } from "@tauri-apps/api/window";

type AsyncCapableUnlistenFn = UnlistenFn | (() => Promise<void>);

function ignoreUnlistenError(unlisten: AsyncCapableUnlistenFn) {
  try {
    const result = unlisten();
    if (result && typeof (result as Promise<void>).catch === "function") {
      void (result as Promise<void>).catch(() => {
        // 已注销或 listener 已被清理，忽略
      });
    }
  } catch {
    // 已注销或 listener 已被清理，忽略
  }
}

function makeIdempotent(unlisten: AsyncCapableUnlistenFn): UnlistenFn {
  let called = false;
  return () => {
    if (called) return;
    called = true;
    ignoreUnlistenError(unlisten);
  };
}

/**
 * 与 @tauri-apps/api/event 的 listen 行为一致，但返回的 unlisten 函数是幂等的：
 * 重复调用不会报错，也不会重复向 Tauri 发起注销。
 *
 * 这主要用于避免 React StrictMode 下 effect 重复执行/清理时，
 * 对同一个 listener 调用两次 unlisten 而抛出 `listeners[eventId].handlerId`。
 */
export async function safeListen<T>(event: EventName, handler: EventCallback<T>): Promise<UnlistenFn> {
  const unlisten = await listen<T>(event, handler);
  return makeIdempotent(unlisten);
}

/**
 * getCurrentWindow().onDragDropEvent 的幂等包装。
 */
export async function safeOnDragDrop(handler: EventCallback<DragDropEvent>): Promise<UnlistenFn> {
  const currentWindow = getCurrentWindow();
  const cleanups = await Promise.all([
    currentWindow.listen<{
      paths: string[];
      position: { x: number; y: number };
    }>(TauriEvent.DRAG_ENTER, (event) => {
      handler({
        ...event,
        payload: {
          type: "enter",
          paths: event.payload.paths,
          position: new PhysicalPosition(event.payload.position),
        },
      });
    }),
    currentWindow.listen<{ position: { x: number; y: number } }>(TauriEvent.DRAG_OVER, (event) => {
      handler({
        ...event,
        payload: {
          type: "over",
          position: new PhysicalPosition(event.payload.position),
        },
      });
    }),
    currentWindow.listen<{
      paths: string[];
      position: { x: number; y: number };
    }>(TauriEvent.DRAG_DROP, (event) => {
      handler({
        ...event,
        payload: {
          type: "drop",
          paths: event.payload.paths,
          position: new PhysicalPosition(event.payload.position),
        },
      });
    }),
    currentWindow.listen(TauriEvent.DRAG_LEAVE, (event) => {
      handler({
        ...event,
        payload: { type: "leave" },
      });
    }),
  ]);

  return makeIdempotent(() => {
    cleanups.forEach((cleanup) => ignoreUnlistenError(cleanup));
  });
}
