import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import CodeHarnessTabPanel from "../../features/code-harness/CodeHarnessTabPanel";
import { useCodeHarnessActivity } from "../../features/code-harness/useCodeHarnessActivity";

function ActivityProbe() {
  const active = useCodeHarnessActivity();
  return <span data-testid="activity">{active ? "active" : "idle"}</span>;
}

function TabbedWorkspace() {
  const [tab, setTab] = useState("other");
  return (
    <div>
      <button type="button" onClick={() => setTab("code")}>
        open-code
      </button>
      <button type="button" onClick={() => setTab("other")}>
        open-other
      </button>
      {tab === "other" ? <div data-testid="other-tab">其他页签</div> : null}
      <CodeHarnessTabPanel active={tab === "code"} className="flex-1">
        <div data-testid="code-page">
          代码页
          <ActivityProbe />
        </div>
      </CodeHarnessTabPanel>
    </div>
  );
}

describe("CodeHarnessTabPanel", () => {
  it("未打开的页签不挂载内容", () => {
    render(<TabbedWorkspace />);

    expect(screen.queryByTestId("code-page")).not.toBeInTheDocument();
  });

  it("切走页签后内容保留在 DOM 中并标记为隐藏", async () => {
    const user = userEvent.setup();
    render(<TabbedWorkspace />);

    await user.click(screen.getByText("open-code"));
    const codePage = screen.getByTestId("code-page");
    expect(screen.getByTestId("activity")).toHaveTextContent("active");

    await user.click(screen.getByText("open-other"));
    await waitFor(() => expect(screen.getByTestId("activity")).toHaveTextContent("idle"));
    expect(screen.getByTestId("code-page")).toBe(codePage);
    expect(codePage.parentElement).toHaveClass("hidden");
    expect(codePage.parentElement).toHaveAttribute("data-active", "false");

    await user.click(screen.getByText("open-code"));
    await waitFor(() => expect(screen.getByTestId("activity")).toHaveTextContent("active"));
    expect(screen.getByTestId("code-page")).toBe(codePage);
    expect(codePage.parentElement).toHaveAttribute("data-active", "true");
  });
});