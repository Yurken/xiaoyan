import { listen, type EventCallback, type EventName, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow, type DragDropEvent } from "@tauri-apps/api/window";

function makeIdempotent(unlisten: UnlistenFn): UnlistenFn {
  let called = false;
  return () => {
    if (called) return;
    called = true;
    try {
      unlisten();
    } catch {
      // 已注销或 listener 已被清理，忽略
    }
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
export async function safeOnDragDrop(handler: (event: DragDropEvent) => void): Promise<UnlistenFn> {
  const unlisten = await getCurrentWindow().onDragDropEvent(handler);
  return makeIdempotent(unlisten);
}
