import { describe, expect, it, vi } from "vitest";
import { PdfRenderQueue, getPdfRenderQueue, runPdfBackgroundTask } from "../../../features/reader/pdfRenderQueue";
import { retainPdfPages, resolveCanvasOutputScale, MAX_CANVAS_PIXELS, MAX_CANVAS_SIDE } from "../../../features/reader/pdfRenderingShared";

const tick = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function deferred() { let resolve!: () => void; const promise = new Promise<void>((r) => { resolve = r; }); return { promise, resolve }; }

describe("PDF scheduling and retention", () => {
  it("dispatches visible work before queued prefetch and bounds concurrency", async () => {
    const queue = new PdfRenderQueue(2);
    const gate = deferred();
    const started: string[] = [];
    queue.enqueue(() => 100, async () => { started.push("prefetch"); });
    queue.enqueue(() => 0, async () => { started.push("visible-a"); await gate.promise; });
    queue.enqueue(() => 1, async () => { started.push("visible-b"); await gate.promise; });
    await tick();
    expect(started).toEqual(["visible-a", "visible-b"]);
    gate.resolve(); await tick();
    expect(started).toEqual(["visible-a", "visible-b", "prefetch"]);
  });
  it("cancel removes queued work but does not release a running slot before settlement", async () => {
    const queue = new PdfRenderQueue(1);
    const gate = deferred();
    let runningSignal!: AbortSignal;
    const cancel = queue.enqueue(() => 0, async (signal) => { runningSignal = signal; await gate.promise; });
    await tick();
    const stale = vi.fn(); const next = vi.fn();
    const cancelStale = queue.enqueue(() => 0, async () => { stale(); });
    queue.enqueue(() => 1, async () => { next(); });
    cancelStale(); cancel(); await tick();
    expect(runningSignal.aborted).toBe(true);
    expect(next).not.toHaveBeenCalled();
    gate.resolve(); await tick();
    expect(stale).not.toHaveBeenCalled(); expect(next).toHaveBeenCalledOnce();
  });
  it("reader and thumbnails share a document queue, cancelled pending background tasks settle", async () => {
    const document = {}; expect(getPdfRenderQueue(document)).toBe(getPdfRenderQueue(document));
    const queue = new PdfRenderQueue(1); const gate = deferred();
    queue.enqueue(() => 0, () => gate.promise); await tick();
    const controller = new AbortController(); const task = vi.fn();
    const pending = runPdfBackgroundTask(queue, controller.signal, task);
    controller.abort(); await pending; gate.resolve(); await tick();
    expect(task).not.toHaveBeenCalled();
  });
  it("evicts the least recent pages while pinning the active window", () => {
    let retained = new Set<number>();
    for (let page = 1; page <= 100; page++) retained = retainPdfPages(new Set([page]), retained);
    expect([...retained]).toEqual([93, 94, 95, 96, 97, 98, 99, 100]);
    retained = retainPdfPages(new Set([94]), retained);
    retained = retainPdfPages(new Set([101]), retained);
    expect(retained.has(94)).toBe(true); expect(retained.has(93)).toBe(false);
  });
  it("oversized pages stay within bitmap allocation limits, including scales below one", () => {
    for (const [width, height] of [[600, 800], [10000, 20000], [300, 50000]]) {
      const scale = resolveCanvasOutputScale({ width, height }, 3);
      expect(Math.floor(width * scale)).toBeLessThanOrEqual(MAX_CANVAS_SIDE);
      expect(Math.floor(height * scale)).toBeLessThanOrEqual(MAX_CANVAS_SIDE);
      expect(Math.floor(width * scale) * Math.floor(height * scale)).toBeLessThanOrEqual(MAX_CANVAS_PIXELS);
    }
  });
});
