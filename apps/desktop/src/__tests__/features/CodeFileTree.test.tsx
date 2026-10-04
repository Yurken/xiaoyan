import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { ExperimentCodeToolsPanel } from "../../features/experiment/ExperimentCodeToolsPanel";
import { useCodeFileSystem } from "../../features/code/useCodeFileSystem";
import type { useCodeGit } from "../../features/code/useCodeGit";

const directories = {
  "/one": [
    { name: "src", path: "/one/src", is_dir: true },
    { name: "README.md", path: "/one/README.md", is_dir: false },
  ],
  "/one/src": [{ name: "main.ts", path: "/one/src/main.ts", is_dir: false }],
  "/two": [{ name: "new.ts", path: "/two/new.ts", is_dir: false }],
};
const git = { refresh: vi.fn(), snapshot: null } as unknown as ReturnType<typeof useCodeGit>;

function Workspace({ root }: { root: string }) {
  const fileSystem = useCodeFileSystem();
  const { listDir } = fileSystem;
  useEffect(() => { void listDir(root); }, [listDir, root]);
  return <ExperimentCodeToolsPanel workingDir={root} width={320} fileSystem={fileSystem}
    openFile={null} onOpenFile={vi.fn()} git={git} onCollapse={vi.fn()} />;
}

beforeEach(() => {
  vi.mocked(invoke).mockImplementation(async (name, args) => {
    if (name === "code_list_dir") {
      const path = (args as { path: keyof typeof directories }).path;
      return { entries: directories[path] ?? [] };
    }
    return undefined;
  });
});
afterEach(() => { vi.useRealTimers(); });

describe("code file tree navigation", () => {
  it("keeps root files visible when expanding a child directory", async () => {
    render(<Workspace root="/one" />);
    await screen.findByRole("button", { name: "src" });
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "src" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    expect(screen.getByRole("button", { name: "README.md" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "src" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "main.ts" })).toBeInTheDocument();
  });

  it("resets navigation and expanded children when changing the working directory", async () => {
    const view = render(<Workspace root="/one" />);
    await screen.findByRole("button", { name: "src" });
    fireEvent.doubleClick(screen.getByRole("button", { name: "src" }));
    await screen.findByRole("button", { name: "main.ts" });
    view.rerender(<Workspace root="/two" />);
    await screen.findByRole("button", { name: "new.ts" });
    expect(screen.queryByRole("button", { name: "main.ts" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "src" })).not.toBeInTheDocument();
  });

  it("ignores a previous directory navigation that resolves after switching roots", async () => {
    const view = render(<Workspace root="/one" />);
    await screen.findByRole("button", { name: "src" });
    let finish!: (value: unknown) => void;
    const pending = new Promise((resolve) => { finish = resolve; });
    vi.mocked(invoke).mockImplementation(async (name, args) => {
      if (name !== "code_list_dir") return undefined;
      const path = (args as { path: keyof typeof directories }).path;
      return path === "/one/src" ? pending : { entries: directories[path] ?? [] };
    });
    fireEvent.doubleClick(screen.getByRole("button", { name: "src" }));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("code_list_dir", { path: "/one/src" }));
    view.rerender(<Workspace root="/two" />);
    await act(async () => { finish({ entries: directories["/one/src"] }); });
    await screen.findByRole("button", { name: "new.ts" });
    expect(screen.queryByRole("button", { name: "main.ts" })).not.toBeInTheDocument();
  });

  it("clears expanded directories when revisiting a previous root", async () => {
    const view = render(<Workspace root="/one" />);
    await screen.findByRole("button", { name: "src" });
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "src" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    expect(screen.getByRole("button", { name: "main.ts" })).toBeInTheDocument();
    vi.useRealTimers();
    view.rerender(<Workspace root="/two" />);
    await screen.findByRole("button", { name: "new.ts" });
    view.rerender(<Workspace root="/one" />);
    await screen.findByRole("button", { name: "README.md" });
    expect(screen.queryByRole("button", { name: "main.ts" })).not.toBeInTheDocument();
  });
});
