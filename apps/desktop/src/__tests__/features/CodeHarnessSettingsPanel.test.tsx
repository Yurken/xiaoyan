import { describe, expect, it, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import CodeHarnessSettingsPanel from "../../features/code-harness/CodeHarnessSettingsPanel";
import { readCodeHarnessProvider } from "../../features/code-harness/shared";

describe("CodeHarnessSettingsPanel", () => {
  beforeEach(() => localStorage.clear());

  it("only offers DSH while other integrations remain dormant", () => {
    render(
      <MemoryRouter>
        <CodeHarnessSettingsPanel />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: /DeepSeek Harness/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("button", { name: /Codex|OpenCode|Pi/ })).not.toBeInTheDocument();
    expect(readCodeHarnessProvider()).toBe("dsh");
  });

  it("falls back to DSH for a previously selected provider", () => {
    localStorage.setItem("rc:code-harness-provider", "opencode");
    render(<MemoryRouter><CodeHarnessSettingsPanel /></MemoryRouter>);
    expect(readCodeHarnessProvider()).toBe("dsh");
    expect(screen.getByRole("button", { name: /DeepSeek Harness/ })).toHaveAttribute("aria-pressed", "true");
  });
});
