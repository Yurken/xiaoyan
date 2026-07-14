import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SettingsHistoryEntry } from "@research-copilot/types";
import { useSettingsHistory } from "../../features/settings/useSettingsHistory";
import { DEFAULT_SETTINGS } from "../../features/settings/pageConfig";
import { getInvokeMock, resetInvokeMock } from "../mocks/tauri";

const entry: SettingsHistoryEntry = {
  id: "history-1",
  name: "原方案",
  created_at: "2026-07-14T08:00:00Z",
  llm_provider: "openai",
  chat_model: "gpt-5",
  paper_search_engine: "arxiv",
  multi_agent_enabled: true,
  enabled_agents_count: 3,
};

describe("useSettingsHistory", () => {
  beforeEach(() => resetInvokeMock());

  it("重命名配置方案时不会用当前表单覆盖已保存内容", async () => {
    getInvokeMock().mockImplementation(async (command: string, args?: unknown) => {
      if (command === "settings_history_list") return [entry];
      if (command === "settings_history_rename") {
        expect(args).toEqual({ id: "history-1", name: "主力 API 配置" });
        return { ...entry, name: "主力 API 配置" };
      }
      throw new Error(`Unmocked invoke: ${command}`);
    });
    const { result } = renderHook(() => useSettingsHistory({
      form: DEFAULT_SETTINGS,
      onApplied: vi.fn(),
    }));

    await waitFor(() => expect(result.current.entries).toHaveLength(1));
    let renamed = false;
    await act(async () => {
      renamed = await result.current.renameHistory("history-1", "  主力 API 配置  ");
    });

    expect(renamed).toBe(true);
    expect(result.current.entries[0]?.name).toBe("主力 API 配置");
    expect(result.current.actionMessage).toContain("主力 API 配置");
    expect(getInvokeMock()).not.toHaveBeenCalledWith("settings_history_update", expect.anything());
  });
});
