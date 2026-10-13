interface RenderJob {
  priority: () => number;
  run: (signal: AbortSignal) => Promise<void>;
  controller: AbortController;
}

/** One document owns the queue. Cancelled active jobs retain their slot until settled. */
export class PdfRenderQueue {
  private pending: RenderJob[] = [];
  private running = 0;
  private scheduled = false;

  private readonly concurrency: number;

  constructor(concurrency = 2) { this.concurrency = Math.max(1, concurrency); }

  enqueue(priority: () => number, run: RenderJob["run"]) {
    const job = { priority, run, controller: new AbortController() };
    this.pending.push(job);
    this.schedule();
    return () => {
      job.controller.abort();
      this.pending = this.pending.filter((candidate) => candidate !== job);
    };
  }

  private schedule() {
    if (this.scheduled) return;
    this.scheduled = true;
    queueMicrotask(() => {
      this.scheduled = false;
      while (this.running < this.concurrency && this.pending.length) {
        // Read priorities at dispatch time: scrolling can overtake queued prefetch work.
        this.pending.sort((a, b) => a.priority() - b.priority());
        const job = this.pending.shift();
        if (!job) break;
        if (job.controller.signal.aborted) continue;
        this.running++;
        void Promise.resolve().then(() => {
          if (!job.controller.signal.aborted) return job.run(job.controller.signal);
        }).catch((error: unknown) => {
          if (!job.controller.signal.aborted) console.error("[PDF render queue]", error);
        }).finally(() => {
          this.running--;
          this.schedule();
        });
      }
    });
  }
}

// All consumers of one PDF (reader and navigation thumbnails) share the same budget.
const documentQueues = new WeakMap<object, PdfRenderQueue>();
export function getPdfRenderQueue(document: object) {
  let queue = documentQueues.get(document);
  if (!queue) { queue = new PdfRenderQueue(2); documentQueues.set(document, queue); }
  return queue;
}

export function runPdfBackgroundTask(queue: PdfRenderQueue, signal: AbortSignal, task: (signal: AbortSignal) => Promise<void>) {
  if (signal.aborted) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const cancel = queue.enqueue(() => 2_000_000, async (jobSignal) => {
      try { await task(jobSignal); resolve(); }
      catch (error) { reject(error); }
      finally { signal.removeEventListener("abort", abort); }
    });
    const abort = () => { cancel(); resolve(); };
    signal.addEventListener("abort", abort, { once: true });
  });
}
