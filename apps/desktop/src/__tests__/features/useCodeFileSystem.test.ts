import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { useCodeFileSystem } from "../../features/code/useCodeFileSystem";

describe("code filesystem root requests", () => {
  it("keeps the newer root when an older listing resolves last", async () => {
    let finish!: (result: unknown) => void;
    const old = new Promise((resolve) => { finish = resolve; });
    vi.mocked(invoke).mockImplementation(async (_, args) => {
      if ((args as { path: string }).path === "/old") return old;
      return { entries: [{ name: "new.ts", path: "/new/new.ts", is_dir: false }] };
    });
    const hook = renderHook(() => useCodeFileSystem());
    let listing!: Promise<unknown>;
    act(() => { listing = hook.result.current.listDir("/old"); });
    await act(async () => { await hook.result.current.listDir("/new"); });
    await act(async () => {
      finish({ entries: [{ name: "old.ts", path: "/old/old.ts", is_dir: false }] });
      await listing;
    });
    expect(hook.result.current.entries.map((entry) => entry.name)).toEqual(["new.ts"]);
  });

  it("does not restore files after the working directory is cleared", async () => {
    let finish!: (result: unknown) => void;
    vi.mocked(invoke).mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const hook = renderHook(() => useCodeFileSystem());
    let listing!: Promise<unknown>;
    act(() => { listing = hook.result.current.listDir("/old"); });
    act(() => { hook.result.current.setEntries([]); });
    await act(async () => {
      finish({ entries: [{ name: "old.ts", path: "/old/old.ts", is_dir: false }] });
      await listing;
    });
    expect(hook.result.current.entries).toEqual([]);
    expect(hook.result.current.loading).toBe(false);
  });
});
