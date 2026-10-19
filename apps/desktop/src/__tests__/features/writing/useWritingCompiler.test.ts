import { StrictMode, createElement, type PropsWithChildren } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWritingCompiler } from "../../../features/writing/useWritingCompiler";
import { useWritingFeedback } from "../../../features/writing/useWritingFeedback";
import {
  LATEX_INSTALL_SUPPORT,
  isLatexCompilerMissing,
  type WritingCompileSummary,
} from "../../../features/writing/shared";
import { getInvokeMock, resetInvokeMock } from "../../mocks/tauri";

type CompilerOptions = Parameters<typeof useWritingCompiler>[0];
type Completion = "success" | "failure" | "rejection";

function options(draftId = "draft-a", overrides: Partial<CompilerOptions> = {}): CompilerOptions {
  return {
    draftId,
    projectName: `project-${draftId}`,
    mainTex: `\\section{${draftId}}`,
    bibtex: "@article{example, title={Example}}",
    texFiles: [{ path: "sections/intro.tex", content: "Introduction" }],
    notes: "Compile the current snapshot",
    imageAssets: [{
      id: "image-1",
      fileName: "figure.png",
      projectPath: "figures/figure.png",
      storedPath: "/synthetic/assets/figure.png",
      createdAt: "2026-10-16T00:00:00Z",
    }],
    onMessage: vi.fn(),
    onError: vi.fn(),
    clearStatus: vi.fn(),
    ...overrides,
  };
}

function summary(name: string, overrides: Partial<WritingCompileSummary> = {}): WritingCompileSummary {
  return {
    success: true,
    pdfPath: `/synthetic/compile/${name}/main.pdf`,
    workDir: `/synthetic/compile/${name}`,
    engine: "xelatex",
    log: `Compiled ${name}`,
    ...overrides,
  };
}

function storageKey(draftId: string) {
  return `rc:writing:compile:v1:${draftId}`;
}

function deferred() {
  let resolve!: (value: WritingCompileSummary) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<WritingCompileSummary>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function mockCompileQueue(...jobs: ReturnType<typeof deferred>[]) {
  // Keep the actual writingApi adapter: only its native invoke boundary is mocked.
  const queue = [...jobs];
  getInvokeMock().mockImplementation((command: string) => {
    if (command !== "writing_compile_pdf") throw new Error(`Unexpected invoke: ${command}`);
    const next = queue.shift();
    if (!next) throw new Error("Unexpected additional compilation");
    return next.promise;
  });
}

function startCompile(compilePdf: () => Promise<void>) {
  let job!: Promise<void>;
  act(() => { job = compilePdf(); });
  return job;
}

async function finishCompile(
  gate: ReturnType<typeof deferred>,
  job: Promise<void>,
  value: WritingCompileSummary,
) {
  await act(async () => {
    gate.resolve(value);
    await job;
  });
}

async function settleOldCompile(
  gate: ReturnType<typeof deferred>,
  job: Promise<void>,
  completion: Completion,
) {
  await act(async () => {
    if (completion === "rejection") gate.reject(new Error("Old draft native failure"));
    else gate.resolve(summary("old-a", completion === "failure" ? {
      success: false, pdfPath: null, log: "Old draft compilation failed",
    } : {}));
    await job;
  });
}

// setup.ts supplies vi.fn storage methods; restore their implementations as well
// as clearing data so a deliberate quota/access failure cannot leak to other tests.
const storageMocks = {
  getItem: vi.mocked(localStorage.getItem),
  setItem: vi.mocked(localStorage.setItem),
  removeItem: vi.mocked(localStorage.removeItem),
};
const originalStorage = {
  getItem: storageMocks.getItem.getMockImplementation()!,
  setItem: storageMocks.setItem.getMockImplementation()!,
  removeItem: storageMocks.removeItem.getMockImplementation()!,
};

function resetStorage() {
  storageMocks.getItem.mockReset().mockImplementation(originalStorage.getItem);
  storageMocks.setItem.mockReset().mockImplementation(originalStorage.setItem);
  storageMocks.removeItem.mockReset().mockImplementation(originalStorage.removeItem);
  localStorage.clear();
}

function useCompilerWithInstallNotice(input: CompilerOptions) {
  const compiler = useWritingCompiler(input);
  return {
    ...compiler,
    showLatexInstallNotice: isLatexCompilerMissing(compiler.compileResult),
  };
}

function StrictWrapper({ children }: PropsWithChildren) {
  return createElement(StrictMode, null, children);
}

describe("useWritingCompiler", () => {
  beforeEach(() => {
    resetInvokeMock();
    resetStorage();
  });
  afterEach(() => {
    cleanup();
    resetStorage();
    resetInvokeMock();
  });

  it("安装请求通过真实子 hook 防重入，切文稿保留 busy 且旧反馈不干扰编译状态", async () => {
    let finishInstaller!: () => void;
    const installer = new Promise<void>((resolve) => { finishInstaller = resolve; });
    const compiled = summary("a-before-switch");
    getInvokeMock().mockImplementation((command: string) => {
      if (command === "writing_open_mactex_installer") return installer;
      if (command === "writing_compile_pdf") return Promise.resolve(compiled);
      if (command === "writing_open_mactex_download_page") return Promise.resolve();
      throw new Error(`Unexpected invoke: ${command}`);
    });
    const { result, rerender } = renderHook((input: CompilerOptions) => {
      const feedback = useWritingFeedback(input.draftId);
      const compiler = useWritingCompiler({
        ...input,
        onMessage: feedback.showMessage,
        onError: feedback.showError,
        clearStatus: feedback.clearStatus,
      });
      return { ...compiler, message: feedback.message, error: feedback.error };
    }, { initialProps: options() });
    let first!: Promise<void>;
    let duplicate!: Promise<void>;
    act(() => {
      first = result.current.openLatexInstaller();
      duplicate = result.current.openLatexInstaller();
    });
    expect(getInvokeMock()).toHaveBeenCalledTimes(1);
    expect(result.current.latexInstallerStatus).toBe("opening");

    await act(async () => { await result.current.compilePdf(); });
    expect(result.current.compileStatus).toBe("ready");
    expect(result.current.compileResult).toEqual(compiled);
    expect(result.current.latexInstallerStatus).toBe("opening");

    rerender(options("draft-b"));
    expect(result.current.compileStatus).toBe("idle");
    expect(result.current.compileResult).toBeNull();
    expect(result.current.latexInstallerStatus).toBe("opening");
    await act(async () => { await result.current.openLatexInstaller(); });
    expect(getInvokeMock().mock.calls.filter(([command]) =>
      command === "writing_open_mactex_installer")).toHaveLength(1);
    await act(async () => { finishInstaller(); await Promise.all([first, duplicate]); });
    expect(result.current.latexInstallerStatus).toBe("idle");
    expect(result.current.message).toBe("");
    expect(result.current.error).toBe("");
    expect(result.current.compileResult).toBeNull();

    await act(async () => { await result.current.openLatexDownloadPage(); });
    expect(getInvokeMock()).toHaveBeenLastCalledWith("writing_open_mactex_download_page");
    expect(result.current.message).toBe(LATEX_INSTALL_SUPPORT.installGuideOpenedMessage);
  });

  it("编译成功保存当前文稿结果并把完整点击快照传给原生接口", async () => {
    const gate = deferred();
    mockCompileQueue(gate);
    const input = options();
    const { result } = renderHook(() => useWritingCompiler(input));
    expect(result.current.compileStatus).toBe("idle");
    expect(result.current.compileResult).toBeNull();

    const job = startCompile(result.current.compilePdf);
    expect(result.current.compileStatus).toBe("compiling");
    expect(result.current.compileResult).toBeNull();
    const request = {
      projectName: input.projectName, mainTex: input.mainTex, bibtex: input.bibtex,
      texFiles: input.texFiles, notes: input.notes, imageAssets: input.imageAssets,
    };
    expect(getInvokeMock()).toHaveBeenCalledWith("writing_compile_pdf", { request });
    expect(input.clearStatus).toHaveBeenCalledTimes(1);

    const compiled = summary("a");
    await finishCompile(gate, job, compiled);
    expect(result.current.compileStatus).toBe("ready");
    expect(result.current.compileResult).toEqual(compiled);
    expect(JSON.parse(localStorage.getItem(storageKey(input.draftId))!)).toEqual(compiled);
    expect(input.onError).not.toHaveBeenCalled();
  });

  it.each([false, true])("切到 B 的每次 render 只呈现 B 的缓存（有缓存：%s）", (hasBCache) => {
    const cachedA = summary("cached-a");
    const cachedB = hasBCache ? summary("cached-b") : null;
    localStorage.setItem(storageKey("draft-a"), JSON.stringify(cachedA));
    if (cachedB) localStorage.setItem(storageKey("draft-b"), JSON.stringify(cachedB));
    const renders: Array<{ draftId: string; result: WritingCompileSummary | null; status: string }> = [];
    const { result, rerender } = renderHook((input: CompilerOptions) => {
      const compiler = useWritingCompiler(input);
      renders.push({ draftId: input.draftId, result: compiler.compileResult, status: compiler.compileStatus });
      return compiler;
    }, { initialProps: options() });
    expect(result.current.compileResult).toEqual(cachedA);

    rerender(options("draft-b"));
    const bRenders = renders.filter((render) => render.draftId === "draft-b");
    expect(bRenders.length).toBeGreaterThan(0);
    for (const render of bRenders) {
      expect(render.result).toEqual(cachedB);
      expect(render.status).toBe("idle");
    }
    expect(getInvokeMock()).not.toHaveBeenCalled();
  });

  describe.each(["compiling", "ready", "failed"] as const)("切换后 B 状态为 %s", (bStatus) => {
    it.each(["success", "failure", "rejection"] as const)(
      "A 迟到的 %s 不改变 B 的状态、结果、提示或任一缓存",
      async (completion) => {
        const oldA = deferred();
        const currentB = deferred();
        mockCompileQueue(oldA, currentB);
        const inputA = options();
        const inputB = options("draft-b");
        const { result, rerender } = renderHook(useWritingCompiler, { initialProps: inputA });
        const oldJob = startCompile(result.current.compilePdf);
        rerender(inputB);
        const bJob = startCompile(result.current.compilePdf);
        const bResult = summary("current-b", bStatus === "failed" ? {
          success: false, pdfPath: null, log: "Current B compilation failed",
        } : {});
        if (bStatus !== "compiling") await finishCompile(currentB, bJob, bResult);
        // A different owner may have refreshed A's cache since this view left A.
        const preservedA = summary("preserved-a");
        localStorage.setItem(storageKey("draft-a"), JSON.stringify(preservedA));
        storageMocks.setItem.mockClear();
        storageMocks.removeItem.mockClear();

        await settleOldCompile(oldA, oldJob, completion);
        expect(result.current.compileStatus).toBe(bStatus);
        expect(result.current.compileResult).toEqual(bStatus === "compiling" ? null : bResult);
        expect(storageMocks.setItem).not.toHaveBeenCalled();
        expect(storageMocks.removeItem).not.toHaveBeenCalled();
        expect(JSON.parse(localStorage.getItem(storageKey("draft-a"))!)).toEqual(preservedA);
        expect(localStorage.getItem(storageKey("draft-b"))).toBe(
          bStatus === "compiling" ? null : JSON.stringify(bResult),
        );
        expect(inputA.onError).not.toHaveBeenCalled();
        expect(inputB.onError).toHaveBeenCalledTimes(bStatus === "failed" ? 1 : 0);
        if (bStatus === "failed") {
          expect(inputB.onError).toHaveBeenLastCalledWith("PDF 编译失败，请展开编译日志查看具体错误。");
        }
        expect(inputA.onMessage).not.toHaveBeenCalled();
        expect(inputB.onMessage).not.toHaveBeenCalled();
        expect(inputA.clearStatus).toHaveBeenCalledTimes(1);
        expect(inputB.clearStatus).toHaveBeenCalledTimes(1);

        if (bStatus === "compiling") {
          await finishCompile(currentB, bJob, bResult);
          expect(result.current.compileStatus).toBe("ready");
          expect(result.current.compileResult).toEqual(bResult);
          expect(JSON.parse(localStorage.getItem(storageKey("draft-b"))!)).toEqual(bResult);
        }
      },
    );
  });

  it.each(["success", "rejection"] as const)("A→B→A 后旧 A 的 %s 不覆盖新 A", async (completion) => {
    const oldA = deferred();
    const newA = deferred();
    mockCompileQueue(oldA, newA);
    const input = options();
    const { result, rerender } = renderHook(useWritingCompiler, { initialProps: input });
    const oldJob = startCompile(result.current.compilePdf);
    rerender(options("draft-b"));
    rerender(input);
    const newJob = startCompile(result.current.compilePdf);
    const current = summary("new-a");
    await finishCompile(newA, newJob, current);
    storageMocks.setItem.mockClear();

    await settleOldCompile(oldA, oldJob, completion);
    expect(result.current.compileStatus).toBe("ready");
    expect(result.current.compileResult).toEqual(current);
    expect(JSON.parse(localStorage.getItem(storageKey("draft-a"))!)).toEqual(current);
    expect(storageMocks.setItem).not.toHaveBeenCalled();
    expect(input.onError).not.toHaveBeenCalled();
  });

  it.each(["success", "failure", "rejection"] as const)(
    "卸载后迟到的 %s 不再写缓存或报告错误",
    async (completion) => {
      const gate = deferred();
      mockCompileQueue(gate);
      const input = options();
      const { result, unmount } = renderHook(() => useWritingCompiler(input));
      const job = startCompile(result.current.compilePdf);
      unmount();
      storageMocks.setItem.mockClear();
      storageMocks.removeItem.mockClear();

      await settleOldCompile(gate, job, completion);
      expect(storageMocks.setItem).not.toHaveBeenCalled();
      expect(storageMocks.removeItem).not.toHaveBeenCalled();
      expect(input.onError).not.toHaveBeenCalled();
      expect(input.onMessage).not.toHaveBeenCalled();
      expect(input.clearStatus).toHaveBeenCalledTimes(1);
    },
  );

  it.each([false, true])("同步重复编译只发一次，完成后可以再次编译（StrictMode：%s）", async (strict) => {
    const first = deferred();
    const second = deferred();
    mockCompileQueue(first, second);
    const input = options();
    const { result } = renderHook(() => useWritingCompiler(input), {
      wrapper: strict ? StrictWrapper : undefined,
    });
    let firstJob!: Promise<void>;
    let duplicate!: Promise<void>;
    act(() => {
      firstJob = result.current.compilePdf();
      duplicate = result.current.compilePdf();
    });
    await duplicate;
    expect(getInvokeMock()).toHaveBeenCalledTimes(1);
    expect(input.clearStatus).toHaveBeenCalledTimes(1);
    expect(result.current.compileStatus).toBe("compiling");
    await finishCompile(first, firstJob, summary("first"));

    const secondJob = startCompile(result.current.compilePdf);
    expect(getInvokeMock()).toHaveBeenCalledTimes(2);
    expect(result.current.compileResult).toBeNull();
    const secondResult = summary("second");
    await finishCompile(second, secondJob, secondResult);
    expect(result.current.compileStatus).toBe("ready");
    expect(result.current.compileResult).toEqual(secondResult);
    expect(input.onError).not.toHaveBeenCalled();
  });

  it("旧文稿闭包在切换或重新进入 A 后都不能发起编译", async () => {
    const gate = deferred();
    mockCompileQueue(gate);
    const input = options();
    const { result, rerender } = renderHook(useWritingCompiler, { initialProps: input });
    const staleCompile = result.current.compilePdf;
    rerender(options("draft-b"));
    await act(async () => { await staleCompile(); });
    rerender(input);
    await act(async () => { await staleCompile(); });
    expect(getInvokeMock()).not.toHaveBeenCalled();
    expect(input.clearStatus).not.toHaveBeenCalled();

    const job = startCompile(result.current.compilePdf);
    await finishCompile(gate, job, summary("fresh-a"));
    expect(getInvokeMock()).toHaveBeenCalledTimes(1);
    expect(result.current.compileStatus).toBe("ready");
  });

  it("同文稿编辑不会取消在途编译，结果对应点击时快照，再编译采用新内容", async () => {
    const first = deferred();
    const second = deferred();
    mockCompileQueue(first, second);
    const initial = options();
    const edited = options("draft-a", {
      projectName: "edited-project", mainTex: "Edited main", bibtex: "Edited bib",
      texFiles: [{ path: "sections/edited.tex", content: "Edited section" }],
      notes: "Edited notes", imageAssets: [],
    });
    const { result, rerender } = renderHook(useWritingCompiler, { initialProps: initial });
    const firstJob = startCompile(result.current.compilePdf);
    rerender(edited);
    expect(result.current.compileStatus).toBe("compiling");
    expect(getInvokeMock()).toHaveBeenCalledTimes(1);
    expect(getInvokeMock()).toHaveBeenNthCalledWith(1, "writing_compile_pdf", {
      request: expect.objectContaining({
        projectName: initial.projectName, mainTex: initial.mainTex, bibtex: initial.bibtex,
        texFiles: initial.texFiles, notes: initial.notes, imageAssets: initial.imageAssets,
      }),
    });
    const originalResult = summary("original-snapshot");
    await finishCompile(first, firstJob, originalResult);
    expect(result.current.compileStatus).toBe("ready");
    expect(result.current.compileResult).toEqual(originalResult);

    const secondJob = startCompile(result.current.compilePdf);
    expect(getInvokeMock()).toHaveBeenNthCalledWith(2, "writing_compile_pdf", {
      request: expect.objectContaining({
        projectName: edited.projectName, mainTex: edited.mainTex, bibtex: edited.bibtex,
        texFiles: edited.texFiles, notes: edited.notes, imageAssets: edited.imageAssets,
      }),
    });
    await finishCompile(second, secondJob, summary("edited-snapshot"));
    expect(result.current.compileResult?.pdfPath).toContain("edited-snapshot");
  });

  it.each(["getItem", "removeItem", "setItem"] as const)(
    "可选缓存 %s 抛错不阻断编译，也不把成功标为失败",
    async (operation) => {
      storageMocks[operation].mockImplementation(() => { throw new Error("Storage unavailable"); });
      const gate = deferred();
      mockCompileQueue(gate);
      const input = options();
      const { result } = renderHook(() => useWritingCompiler(input));
      const job = startCompile(result.current.compilePdf);
      expect(getInvokeMock()).toHaveBeenCalledTimes(1);
      const compiled = summary("storage-unavailable");
      await finishCompile(gate, job, compiled);
      expect(storageMocks[operation]).toHaveBeenCalled();
      expect(result.current.compileStatus).toBe("ready");
      expect(result.current.compileResult).toEqual(compiled);
      expect(input.onError).not.toHaveBeenCalled();
    },
  );

  it.each([
    { name: "缺失字段", value: {} },
    { name: "日志对象", value: { ...summary("bad-log-cache"), log: { message: "Unexpected log shape" } } },
    { name: "数组", value: [] },
  ])("缓存是有效 JSON 但结构为$name时忽略结果，真实安装提示消费者可安全渲染", ({ value }) => {
    localStorage.setItem(storageKey("draft-a"), JSON.stringify(value));
    storageMocks.setItem.mockClear();
    storageMocks.removeItem.mockClear();
    const input = options();
    const { result } = renderHook(useCompilerWithInstallNotice, { initialProps: input });

    expect(result.current.compileStatus).toBe("idle");
    expect(result.current.compileResult).toBeNull();
    expect(storageMocks.setItem).not.toHaveBeenCalled();
    expect(storageMocks.removeItem).not.toHaveBeenCalled();
    expect(localStorage.getItem(storageKey("draft-a"))).toBe(JSON.stringify(value));
    expect(result.current.showLatexInstallNotice).toBe(false);
    expect(input.onError).not.toHaveBeenCalled();
    expect(input.onMessage).not.toHaveBeenCalled();
    expect(getInvokeMock()).not.toHaveBeenCalled();
  });

  it("切换到坏结构缓存的 B 时，每次 render 均丢弃 A 的结果并安全计算安装提示", () => {
    const cachedA = summary("cached-valid-a");
    localStorage.setItem(storageKey("draft-a"), JSON.stringify(cachedA));
    localStorage.setItem(storageKey("draft-b"), JSON.stringify({
      ...summary("cached-invalid-b"), log: { message: "Invalid log" },
    }));
    const renders: Array<{
      draftId: string; result: WritingCompileSummary | null; status: string; notice: boolean;
    }> = [];
    const { result, rerender } = renderHook((input: CompilerOptions) => {
      const compiler = useCompilerWithInstallNotice(input);
      renders.push({
        draftId: input.draftId, result: compiler.compileResult,
        status: compiler.compileStatus, notice: compiler.showLatexInstallNotice,
      });
      return compiler;
    }, { initialProps: options() });
    expect(result.current.compileResult).toEqual(cachedA);

    rerender(options("draft-b"));
    const bRenders = renders.filter((render) => render.draftId === "draft-b");
    expect(bRenders.length).toBeGreaterThan(0);
    for (const render of bRenders) {
      expect(render.result).toBeNull();
      expect(render.status).toBe("idle");
      expect(render.notice).toBe(false);
    }
    expect(JSON.parse(localStorage.getItem(storageKey("draft-a"))!)).toEqual(cachedA);
    expect(getInvokeMock()).not.toHaveBeenCalled();
  });

  it("原生返回坏结构时不进入结果或缓存，显示格式错误且下一次编译可成功", async () => {
    localStorage.setItem(storageKey("draft-a"), JSON.stringify(summary("previous-valid")));
    const invalid = deferred();
    const retry = deferred();
    mockCompileQueue(invalid, retry);
    const input = options();
    const { result } = renderHook(useCompilerWithInstallNotice, { initialProps: input });
    storageMocks.setItem.mockClear();
    const badResult: unknown = {
      ...summary("invalid-native"), log: { message: "Unexpected native log object" },
    };
    await finishCompile(invalid, startCompile(result.current.compilePdf), badResult as WritingCompileSummary);

    expect(result.current.compileStatus).toBe("failed");
    expect(result.current.compileResult).toBeNull();
    expect(result.current.showLatexInstallNotice).toBe(false);
    expect(storageMocks.setItem).not.toHaveBeenCalled();
    expect(localStorage.getItem(storageKey("draft-a"))).toBeNull();
    expect(input.onError).toHaveBeenCalledWith("编译器返回的结果格式无效，请重新编译。");
    expect(input.onMessage).not.toHaveBeenCalled();

    const valid = summary("retry-valid-native");
    await finishCompile(retry, startCompile(result.current.compilePdf), valid);
    expect(getInvokeMock()).toHaveBeenCalledTimes(2);
    expect(result.current.compileStatus).toBe("ready");
    expect(result.current.compileResult).toEqual(valid);
    expect(JSON.parse(localStorage.getItem(storageKey("draft-a"))!)).toEqual(valid);
    expect(input.onError).toHaveBeenCalledTimes(1);
  });

  it("旧文稿返回坏结构时完全忽略，不污染当前结果、反馈或任一缓存", async () => {
    const old = deferred();
    mockCompileQueue(old);
    const inputA = options();
    const inputB = options("draft-b");
    const cachedB = summary("current-valid-b");
    localStorage.setItem(storageKey("draft-b"), JSON.stringify(cachedB));
    const { result, rerender } = renderHook(useCompilerWithInstallNotice, { initialProps: inputA });
    const oldJob = startCompile(result.current.compilePdf);
    rerender(inputB);
    const preservedA = summary("externally-refreshed-a");
    localStorage.setItem(storageKey("draft-a"), JSON.stringify(preservedA));
    storageMocks.setItem.mockClear();
    storageMocks.removeItem.mockClear();

    await finishCompile(old, oldJob, {} as unknown as WritingCompileSummary);
    expect(result.current.compileStatus).toBe("idle");
    expect(result.current.compileResult).toEqual(cachedB);
    expect(result.current.showLatexInstallNotice).toBe(false);
    expect(storageMocks.setItem).not.toHaveBeenCalled();
    expect(storageMocks.removeItem).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem(storageKey("draft-a"))!)).toEqual(preservedA);
    expect(JSON.parse(localStorage.getItem(storageKey("draft-b"))!)).toEqual(cachedB);
    for (const input of [inputA, inputB]) {
      expect(input.onError).not.toHaveBeenCalled();
      expect(input.onMessage).not.toHaveBeenCalled();
    }
  });

  it.each([
    {
      name: "普通失败",
      value: summary("cached-failed", { success: false, pdfPath: null, log: "Undefined control sequence" }),
      notice: false,
    },
    {
      name: "日志提示缺编译器",
      value: summary("cached-missing", {
        success: false, pdfPath: null, engine: "future-engine", log: "未找到 LaTeX 编译器，请检查安装。",
      }),
      notice: true,
    },
  ])("有效$name缓存仍保留完整日志和安装提示，加载状态保持 idle", ({ value, notice }) => {
    localStorage.setItem(storageKey("draft-a"), JSON.stringify(value));
    const input = options();
    const { result } = renderHook(useCompilerWithInstallNotice, { initialProps: input });

    expect(result.current.compileStatus).toBe("idle");
    expect(result.current.compileResult).toEqual(value);
    expect(result.current.compileResult?.log).toBe(value.log);
    expect(result.current.showLatexInstallNotice).toBe(notice);
    expect(input.onError).not.toHaveBeenCalled();
    expect(input.onMessage).not.toHaveBeenCalled();
    expect(getInvokeMock()).not.toHaveBeenCalled();
  });

  it("缓存 JSON 损坏时仍可正常编译", async () => {
    localStorage.setItem(storageKey("draft-a"), "{broken");
    const gate = deferred();
    mockCompileQueue(gate);
    const { result } = renderHook(() => useWritingCompiler(options()));
    expect(result.current.compileResult).toBeNull();
    const job = startCompile(result.current.compilePdf);
    await finishCompile(gate, job, summary("recovered"));
    expect(result.current.compileStatus).toBe("ready");
  });

  it.each([
    { name: "缺少 LaTeX", value: summary("missing", { success: false, pdfPath: null, engine: "not-found" }),
      error: LATEX_INSTALL_SUPPORT.missingCompilerMessage },
    { name: "一般编译失败", value: summary("failed", { success: false, pdfPath: null, log: "Undefined control sequence" }),
      error: "PDF 编译失败，请展开编译日志查看具体错误。" },
    { name: "成功标记但缺少 PDF", value: summary("missing-pdf", { pdfPath: null }),
      error: "PDF 编译失败，请展开编译日志查看具体错误。" },
  ])("$name 保存日志并显示相应错误，随后允许重试", async ({ value, error }) => {
    const failed = deferred();
    const retry = deferred();
    mockCompileQueue(failed, retry);
    const input = options();
    const { result } = renderHook(() => useWritingCompiler(input));
    await finishCompile(failed, startCompile(result.current.compilePdf), value);
    expect(result.current.compileStatus).toBe("failed");
    expect(result.current.compileResult).toEqual(value);
    expect(input.onError).toHaveBeenCalledWith(error);
    expect(JSON.parse(localStorage.getItem(storageKey("draft-a"))!)).toEqual(value);

    const job = startCompile(result.current.compilePdf);
    await finishCompile(retry, job, summary("retry"));
    expect(getInvokeMock()).toHaveBeenCalledTimes(2);
    expect(result.current.compileStatus).toBe("ready");
  });

  it("原生拒绝时清除旧结果并显示错误，随后允许重试", async () => {
    localStorage.setItem(storageKey("draft-a"), JSON.stringify(summary("cached")));
    const failed = deferred();
    const retry = deferred();
    mockCompileQueue(failed, retry);
    const input = options();
    const { result } = renderHook(() => useWritingCompiler(input));
    const job = startCompile(result.current.compilePdf);
    await act(async () => {
      failed.reject(new Error("Native compilation unavailable"));
      await job;
    });
    expect(result.current.compileStatus).toBe("failed");
    expect(result.current.compileResult).toBeNull();
    expect(localStorage.getItem(storageKey("draft-a"))).toBeNull();
    expect(input.onError).toHaveBeenCalledWith("Native compilation unavailable");
    await finishCompile(retry, startCompile(result.current.compilePdf), summary("retry"));
    expect(result.current.compileStatus).toBe("ready");
  });

  it("真实编译与反馈组合：切换清空 A 错误，旧 A 回调不能清除或覆盖 B 错误", async () => {
    const first = deferred();
    const second = deferred();
    mockCompileQueue(first, second);
    const { result, rerender } = renderHook((draftId: string) => {
      const feedback = useWritingFeedback(draftId);
      const compiler = useWritingCompiler(options(draftId, {
        onMessage: feedback.showMessage, onError: feedback.showError, clearStatus: feedback.clearStatus,
      }));
      return { feedback, compiler };
    }, { initialProps: "draft-a" });
    const oldFeedback = result.current.feedback;
    await finishCompile(first, startCompile(result.current.compiler.compilePdf),
      summary("missing-a", { success: false, pdfPath: null, engine: "not-found" }));
    expect(result.current.feedback.error).toBe(LATEX_INSTALL_SUPPORT.missingCompilerMessage);
    rerender("draft-b");
    expect(result.current.feedback.error).toBe("");

    const bJob = startCompile(result.current.compiler.compilePdf);
    await act(async () => {
      second.reject(new Error("Current B failure"));
      await bJob;
    });
    expect(result.current.feedback.error).toBe("Current B failure");
    act(() => {
      oldFeedback.clearStatus();
      oldFeedback.showError("Late A error");
      oldFeedback.showMessage("Late A message");
    });
    expect(result.current.feedback.error).toBe("Current B failure");
    expect(result.current.feedback.message).toBe("");
  });
});
