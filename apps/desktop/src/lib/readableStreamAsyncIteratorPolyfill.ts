/**
 * macOS Tauri 的 WKWebView(旧版 Safari/JSC)未实现 ReadableStream 的异步迭代
 * (ReadableStream.prototype[Symbol.asyncIterator])。pdf.js 的 getTextContent 内部用
 * `for await (const value of readableStream)` 读取文本流，缺该实现会抛
 * "undefined is not a function (near '...value of readableStream...')"，导致整页文本层
 * 渲染失败 —— 表现为无法划词、无批注工具弹窗。
 *
 * 该补丁必须在任何 pdf.js 代码运行前生效，因此在 main.tsx 第一行 import 本模块。
 */
(() => {
  if (typeof ReadableStream === "undefined") return;
  const proto = ReadableStream.prototype as unknown as Record<symbol | string, unknown>;
  const ASYNC_ITERATOR = Symbol.asyncIterator;
  if (typeof proto[ASYNC_ITERATOR] === "function") return;

  function asyncIterator(this: ReadableStream) {
    const reader = this.getReader();
    return {
      async next() {
        return reader.read();
      },
      async return(value?: unknown) {
        try {
          await reader.cancel(value);
        } catch {
          // 取消失败可忽略
        }
        reader.releaseLock();
        return { done: true, value };
      },
      [ASYNC_ITERATOR]() {
        return this;
      },
    };
  }

  try {
    if (typeof proto.values !== "function") {
      Object.defineProperty(proto, "values", { value: asyncIterator, writable: true, configurable: true });
    }
    Object.defineProperty(proto, ASYNC_ITERATOR, { value: proto.values, writable: true, configurable: true });
  } catch {
    proto.values = proto.values ?? asyncIterator;
    proto[ASYNC_ITERATOR] = proto.values;
  }
})();
