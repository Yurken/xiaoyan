import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useWorkbenchOverview } from "../../../features/workbench/useWorkbenchOverview";
import { apiClient, submissionApi } from "../../../lib/client";

vi.mock("../../../lib/tauriEvent", () => ({ safeListen: vi.fn(async () => () => {}) }));
vi.mock("../../../lib/client", () => ({
  apiClient: {
    papers: { list: vi.fn(async () => []) },
    knowledge: { listInterests: vi.fn(async () => []), listNotes: vi.fn(async () => []) },
    chat: { listSessions: vi.fn(async () => []) },
    memory: { listCheckpoints: vi.fn(async () => ({ checkpoints: [] })) },
    workbench: { generateOverviewText: vi.fn() },
  },
  submissionApi: { stats: vi.fn(async () => ({ active: 0, pendingReviews: 0, upcomingDdls: [] })) },
}));

describe("首页加载", () => {
  it("单个来源失败仍显示成功记录，且不调用模型生成文案", async () => {
    vi.mocked(submissionApi.stats).mockRejectedValueOnce(new Error("offline"));
    vi.mocked(apiClient.chat.listSessions).mockResolvedValueOnce([{ id: "s1", title: "保留的会话", context_type: "general", created_at: "2026-09-13", updated_at: null }]);
    const { result } = renderHook(() => useWorkbenchOverview());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.model.recent[0].title).toBe("保留的会话");
    expect(result.current.error).toContain("部分近期记录");
    expect(apiClient.workbench.generateOverviewText).not.toHaveBeenCalled();
  });
});
