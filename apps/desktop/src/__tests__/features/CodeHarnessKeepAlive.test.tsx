import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, NavLink, Route, Routes } from "react-router-dom";
import CodeHarnessKeepAlive from "../../features/code-harness/CodeHarnessKeepAlive";

const mockMountCounts = vi.hoisted(() => ({ dsh: 0, codex: 0, opencode: 0, pi: 0 }));

vi.mock("../../pages/Code", async () => {
  const { useEffect } = await import("react");
  return {
    default: function MockDshPage() {
      useEffect(() => {
        mockMountCounts.dsh += 1;
      }, []);
      return <div data-testid="dsh-page" />;
    },
  };
});
vi.mock("../../pages/Codex", async () => {
  const { useEffect } = await import("react");
  return {
    default: function MockCodexPage() {
      useEffect(() => {
        mockMountCounts.codex += 1;
      }, []);
      return <div data-testid="codex-page" />;
    },
  };
});
vi.mock("../../pages/OpenCode", async () => {
  const { useEffect } = await import("react");
  return {
    default: function MockOpenCodePage() {
      useEffect(() => {
        mockMountCounts.opencode += 1;
      }, []);
      return <div data-testid="opencode-page" />;
    },
  };
});
vi.mock("../../pages/PiWeb", async () => {
  const { useEffect } = await import("react");
  return {
    default: function MockPiPage() {
      useEffect(() => {
        mockMountCounts.pi += 1;
      }, []);
      return <div data-testid="pi-page" />;
    },
  };
});

function HarnessNavigation() {
  return (
    <nav>
      <NavLink to="/code">go-dsh</NavLink>
      <NavLink to="/codex">go-codex</NavLink>
      <NavLink to="/settings">go-settings</NavLink>
    </nav>
  );
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <HarnessNavigation />
      <Routes>
        {/* 与 App / FocusLayout 一致：路由只声明路径，页面由常驻宿主渲染。 */}
        <Route path="/code" element={null} />
        <Route path="/codex" element={null} />
        <Route path="/opencode" element={null} />
        <Route path="/pi" element={null} />
        <Route path="/settings" element={<div data-testid="settings-page" />} />
      </Routes>
      <CodeHarnessKeepAlive />
    </MemoryRouter>,
  );
}

function providerSlot(container: HTMLElement, provider: string) {
  return container.querySelector(`[data-provider="${provider}"]`);
}

describe("CodeHarnessKeepAlive", () => {
  beforeEach(() => {
    mockMountCounts.dsh = 0;
    mockMountCounts.codex = 0;
    mockMountCounts.opencode = 0;
    mockMountCounts.pi = 0;
  });

  it("未访问代码 Harness 时宿主不挂载任何页面", () => {
    const { container } = renderAt("/settings");

    expect(screen.getByTestId("settings-page")).toBeInTheDocument();
    expect(container.querySelectorAll("[data-provider]")).toHaveLength(0);
    expect(mockMountCounts).toEqual({ dsh: 0, codex: 0, opencode: 0, pi: 0 });
  });

  it("切走再回来只隐藏页面，不重新挂载内嵌应用", async () => {
    const user = userEvent.setup();
    const { container } = renderAt("/code");

    const dshPage = await screen.findByTestId("dsh-page");
    expect(providerSlot(container, "dsh")).toHaveAttribute("data-active", "true");

    await user.click(screen.getByText("go-settings"));
    expect(await screen.findByTestId("settings-page")).toBeInTheDocument();
    expect(providerSlot(container, "dsh")).toHaveAttribute("data-active", "false");
    expect(providerSlot(container, "dsh")).toHaveClass("invisible");
    // 同一个 DOM 节点仍在：iframe 没有被卸载，也就不会重新加载。
    expect(screen.getByTestId("dsh-page")).toBe(dshPage);

    await user.click(screen.getByText("go-dsh"));
    await waitFor(() => expect(providerSlot(container, "dsh")).toHaveAttribute("data-active", "true"));
    expect(screen.getByTestId("dsh-page")).toBe(dshPage);
    expect(mockMountCounts.dsh).toBe(1);
  });

  it("切换到另一个 Harness 时双方都保持挂载", async () => {
    const user = userEvent.setup();
    const { container } = renderAt("/code");

    await screen.findByTestId("dsh-page");
    await user.click(screen.getByText("go-codex"));

    const codexPage = await screen.findByTestId("codex-page");
    expect(providerSlot(container, "codex")).toHaveAttribute("data-active", "true");
    expect(providerSlot(container, "dsh")).toHaveAttribute("data-active", "false");
    expect(mockMountCounts).toMatchObject({ dsh: 1, codex: 1 });

    await user.click(screen.getByText("go-dsh"));
    await waitFor(() => expect(providerSlot(container, "dsh")).toHaveAttribute("data-active", "true"));
    expect(providerSlot(container, "codex")).toHaveAttribute("data-active", "false");
    expect(screen.getByTestId("codex-page")).toBe(codexPage);
    expect(mockMountCounts).toMatchObject({ dsh: 1, codex: 1 });
  });
});