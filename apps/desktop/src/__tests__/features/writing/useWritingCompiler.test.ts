import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWritingCompiler } from "../../../features/writing/useWritingCompiler";
import { getInvokeMock, resetInvokeMock } from "../../mocks/tauri";

interface CompileSummary {
  success: boolean;
  pdfPath: string | null;
  workDir: string;
  engine: string;
  log: string;
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => {};
  let reject: (reason?: unknown) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function compilerOptions(overrides: Record<string, unknown> = {}) {
  return {
    draftId: "draft-1",
    projectName: "demo-paper",
    mainTex: "\\section{Intro}",
    bibtex: "",
    texFiles: [],
    notes: "",
    imageAssets: [],
    onMessage: vi.fn(),
    onError: vi.fn(),
    clearStatus: vi.fn(),
    ...overrides,
  };
}

function compileSummary(overrides: Record<string, unknown> = {}): CompileSummary {
  return {
    success: true,
    pdfPath: "/tmp/demo.pdf",
    workDir: "/tmp/work",
    engine: "latexmk",
    log: "success",
    ...overrides,
  };
}

/** 每次 writing_compile_pdf 调用返回一个待决 promise，测试按序 resolve/reject。 */
function mockCompileQueue() {
  const pending: Deferred<CompileSummary>[] = [];
  getInvokeMock().mockImplementation(async (command: string) => {
    if (command === "writing_compile_pdf") {
      const deferred = createDeferred<CompileSummary>();
      pending.push(deferred);
      return deferred.promise;
    }
    throw new Error(`Unmocked invoke: ${command}`);
  });
  return pending;
}

describe("useWritingCompiler", () => {
  beforeEach(() => {
    resetInvokeMock();
    localStorage.clear();
  });
  afterEach(() => vi.useRealTimers());

  it("初次挂载防抖后自动编译，内容未变化时不重复发起", async () => {
    vi.useFakeTimers();
    const compiles = mockCompileQueue();
    const { result, rerender } = renderHook(
      (props) => useWritingCompiler(props as never),
      { initialProps: compilerOptions() },
    );

    expect(result.current.autoCompileEnabled).toBe(true);
    // 防抖窗口内不发起编译。
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(getInvokeMock()).not.toHaveBeenCalled();
    expect(result.current.autoCompilePending).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    expect(getInvokeMock()).toHaveBeenCalledTimes(1);
    expect(result.current.compileStatus).toBe("compiling");
    expect(result.current.autoCompilePending).toBe(false);

    await act(async () => {
      compiles[0].resolve(compileSummary());
    });
    expect(result.current.compileStatus).toBe("ready");
    expect(result.current.previewResult?.pdfPath).toBe("/tmp/demo.pdf");
    expect(result.current.previewStale).toBe(false);

    // 内容未变化：不再发起编译。
    rerender(compilerOptions());
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(getInvokeMock()).toHaveBeenCalledTimes(1);
  });

  it("编译进行中不并发，只补最新一次尾随编译", async () => {
    vi.useFakeTimers();
    const compiles = mockCompileQueue();
    const { result, rerender } = renderHook(
      (props) => useWritingCompiler(props as never),
      { initialProps: compilerOptions() },
    );

    await act(async () => {
      vi.advanceTimersByTime(1200);
    });
    expect(getInvokeMock()).toHaveBeenCalledTimes(1);

    // 飞行中连续修改两次，尾随只保留最新。
    rerender(compilerOptions({ mainTex: "\\section{A}" }));
    await act(async () => {
      vi.advanceTimersByTime(1200);
    });
    rerender(compilerOptions({ mainTex: "\\section{B}" }));
    await act(async () => {
      vi.advanceTimersByTime(1200);
    });
    expect(getInvokeMock()).toHaveBeenCalledTimes(1);

    await act(async () => {
      compiles[0].resolve(compileSummary());
    });
    expect(getInvokeMock()).toHaveBeenCalledTimes(2);
    expect(getInvokeMock()).toHaveBeenLastCalledWith("writing_compile_pdf", {
      request: expect.objectContaining({ mainTex: "\\section{B}" }),
    });
    // 尾随任务立即接续执行。
    expect(result.current.compileStatus).toBe("compiling");

    await act(async () => {
      compiles[1].resolve(compileSummary({ pdfPath: "/tmp/b.pdf" }));
    });
    expect(result.current.compileStatus).toBe("ready");
    expect(result.current.previewResult?.pdfPath).toBe("/tmp/b.pdf");
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(getInvokeMock()).toHaveBeenCalledTimes(2);
  });

  it("便签与项目名变化不触发自动编译", async () => {
    vi.useFakeTimers();
    const compiles = mockCompileQueue();
    const { result, rerender } = renderHook(
      (props) => useWritingCompiler(props as never),
      { initialProps: compilerOptions() },
    );

    await act(async () => {
      vi.advanceTimersByTime(1200);
    });
    await act(async () => {
      compiles[0].resolve(compileSummary());
    });
    expect(getInvokeMock()).toHaveBeenCalledTimes(1);

    rerender(compilerOptions({ notes: "新便签", projectName: "renamed-paper" }));
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(getInvokeMock()).toHaveBeenCalledTimes(1);
    expect(result.current.previewStale).toBe(false);
  });

  it("关闭自动编译清掉待执行任务，偏好持久化且新实例默认不自动", async () => {
    vi.useFakeTimers();
    mockCompileQueue();
    const { result, unmount } = renderHook(
      (props) => useWritingCompiler(props as never),
      { initialProps: compilerOptions() },
    );

    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    act(() => {
      result.current.setAutoCompileEnabled(false);
    });
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(getInvokeMock()).not.toHaveBeenCalled();
    expect(localStorage.getItem("rc:writing:auto-compile:v1")).toBe("false");

    unmount();
    const second = renderHook((props) => useWritingCompiler(props as never), {
      initialProps: compilerOptions(),
    });
    expect(second.result.current.autoCompileEnabled).toBe(false);
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(getInvokeMock()).not.toHaveBeenCalled();

    act(() => {
      second.result.current.setAutoCompileEnabled(true);
    });
    await act(async () => {
      vi.advanceTimersByTime(1200);
    });
    expect(getInvokeMock()).toHaveBeenCalledTimes(1);
  });

  it("自动编译失败保留上一次成功预览且不上报全局错误，手动失败仍上报", async () => {
    vi.useFakeTimers();
    const compiles = mockCompileQueue();
    const onError = vi.fn();
    const { result, rerender } = renderHook(
      (props) => useWritingCompiler(props as never),
      { initialProps: compilerOptions({ onError }) },
    );

    await act(async () => {
      vi.advanceTimersByTime(1200);
    });
    await act(async () => {
      compiles[0].resolve(compileSummary({ pdfPath: "/tmp/ok.pdf" }));
    });
    expect(result.current.previewResult?.pdfPath).toBe("/tmp/ok.pdf");

    rerender(compilerOptions({ onError, mainTex: "\\section{Broken}" }));
    await act(async () => {
      vi.advanceTimersByTime(1200);
    });
    await act(async () => {
      compiles[1].resolve(compileSummary({ success: false, pdfPath: null, log: "! Undefined control sequence" }));
    });
    expect(result.current.compileStatus).toBe("failed");
    expect(result.current.compileResult?.success).toBe(false);
    expect(result.current.previewResult?.pdfPath).toBe("/tmp/ok.pdf");
    expect(result.current.previewStale).toBe(true);
    expect(onError).not.toHaveBeenCalled();

    await act(async () => {
      const pending = result.current.compilePdf();
      compiles[2].resolve(compileSummary({ success: false, pdfPath: null, log: "! Undefined control sequence" }));
      await pending;
    });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(result.current.previewResult?.pdfPath).toBe("/tmp/ok.pdf");
  });

  it("切换草稿后旧任务结果不再落回界面，卸载取消待执行的自动编译", async () => {
    vi.useFakeTimers();
    const compiles = mockCompileQueue();
    const onError = vi.fn();
    const base = compilerOptions({ onError });
    const { result, rerender, unmount } = renderHook(
      (props) => useWritingCompiler(props as never),
      { initialProps: base },
    );

    await act(async () => {
      vi.advanceTimersByTime(1200);
    });
    expect(getInvokeMock()).toHaveBeenCalledTimes(1);

    rerender(compilerOptions({ ...base, draftId: "draft-2" }));
    expect(result.current.compileStatus).toBe("idle");

    // 旧草稿在飞的编译结束：不能覆盖新草稿 UI，也不能触发全局消息。
    await act(async () => {
      compiles[0].resolve(compileSummary({ pdfPath: "/tmp/old.pdf" }));
    });
    expect(result.current.compileStatus).toBe("idle");
    expect(result.current.compileResult).toBeNull();
    expect(result.current.previewResult).toBeNull();
    expect(onError).not.toHaveBeenCalled();

    // 新草稿内容变化重新走自动编译。
    rerender(compilerOptions({ ...base, draftId: "draft-2", mainTex: "\\section{New}" }));
    await act(async () => {
      vi.advanceTimersByTime(1200);
    });
    expect(getInvokeMock()).toHaveBeenCalledTimes(2);
    expect(getInvokeMock()).toHaveBeenLastCalledWith("writing_compile_pdf", {
      request: expect.objectContaining({ mainTex: "\\section{New}" }),
    });

    // 卸载：待执行的定时编译取消，在飞任务静默结束。
    unmount();
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(getInvokeMock()).toHaveBeenCalledTimes(2);
    await act(async () => {
      compiles[1].resolve(compileSummary());
    });
    expect(onError).not.toHaveBeenCalled();
  });

  it("缺少编译器时暂停自动重试，手动可重试且成功后恢复自动编译", async () => {
    vi.useFakeTimers();
    const compiles = mockCompileQueue();
    const onError = vi.fn();
    const missing = compileSummary({
      success: false,
      pdfPath: null,
      engine: "not-found",
      log: "未找到 LaTeX 编译器",
    });
    const { result, rerender } = renderHook(
      (props) => useWritingCompiler(props as never),
      { initialProps: compilerOptions({ onError }) },
    );

    await act(async () => {
      vi.advanceTimersByTime(1200);
    });
    await act(async () => {
      compiles[0].resolve(missing);
    });
    expect(result.current.compileStatus).toBe("failed");
    expect(onError).not.toHaveBeenCalled();

    // 暂停期间内容变化不再自动编译。
    rerender(compilerOptions({ onError, mainTex: "\\section{Again}" }));
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(getInvokeMock()).toHaveBeenCalledTimes(1);

    // 手动重试仍失败：上报全局错误。
    await act(async () => {
      const pending = result.current.compilePdf();
      compiles[1].resolve(missing);
      await pending;
    });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(expect.stringContaining("未找到 LaTeX 编译器"));

    // 手动成功：恢复自动编译，随后编辑再次触发自动编译。
    await act(async () => {
      const pending = result.current.compilePdf();
      compiles[2].resolve(compileSummary({ pdfPath: "/tmp/restored.pdf" }));
      await pending;
    });
    expect(result.current.previewResult?.pdfPath).toBe("/tmp/restored.pdf");

    rerender(compilerOptions({ onError, mainTex: "\\section{Again} v2" }));
    await act(async () => {
      vi.advanceTimersByTime(1200);
    });
    expect(getInvokeMock()).toHaveBeenCalledTimes(4);
  });
});
