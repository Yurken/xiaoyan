import { describe, expect, it, vi } from "vitest";
import { userEvent } from "@testing-library/user-event";
import type { SettingsHistoryEntry } from "@research-copilot/types";
import ConfigHistoryManageModal from "../../features/settings/ConfigHistoryManageModal";
import { render, screen } from "../helpers/render";

const entry: SettingsHistoryEntry = {
  id: "history-1",
  name: "小妍 API 配置",
  created_at: "2026-07-14T08:00:00Z",
  llm_provider: "openai",
  chat_model: "gpt-5",
  paper_search_engine: "arxiv",
  multi_agent_enabled: true,
  enabled_agents_count: 3,
};

describe("ConfigHistoryManageModal", () => {
  it("提供不覆盖配置内容的重命名入口", async () => {
    const onRenameHistory = vi.fn().mockResolvedValue(true);
    const onUpdateHistory = vi.fn();
    const user = userEvent.setup();
    render(
      <ConfigHistoryManageModal
        open
        entries={[entry]}
        loading={false}
        loadError=""
        actionError=""
        actionMessage=""
        selectedId={entry.id}
        applyingId={null}
        updatingId={null}
        renamingId={null}
        deletingId={null}
        busy={false}
        setSelectedId={vi.fn()}
        onApplyHistory={vi.fn()}
        onUpdateHistory={onUpdateHistory}
        onRenameHistory={onRenameHistory}
        onDeleteHistory={vi.fn()}
        onReload={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "重命名" }));
    const input = screen.getByRole("textbox", { name: "方案名称" });
    await user.clear(input);
    await user.type(input, "备用 API 配置");
    await user.click(screen.getByRole("button", { name: "保存名称" }));

    expect(onRenameHistory).toHaveBeenCalledWith("history-1", "备用 API 配置");
    expect(onUpdateHistory).not.toHaveBeenCalled();
  });
});
