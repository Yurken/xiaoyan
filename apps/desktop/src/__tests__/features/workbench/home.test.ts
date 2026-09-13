import { describe, expect, it } from "vitest";
import { buildHomeModel } from "../../../features/workbench/home/shared";
import type { WorkbenchOverviewSource } from "../../../features/workbench/shared";

const empty: WorkbenchOverviewSource = { papers: [], notes: [], sessions: [], interests: [], checkpoints: [], submission: { active: 0, pendingReviews: 0, upcomingDdls: [] } };

describe("首页记录与提醒", () => {
  it("按更新时间跨类型排序，保留具体记录入口，过滤处理中的论文", () => {
    const model = buildHomeModel({ ...empty,
      papers: [{ id: "processing", title: "处理中", status: "parsing", created_at: "2026-09-13", updated_at: "2026-09-13" }],
      notes: [{ id: "n/1", title: "最新笔记", content: "", source_type: "manual", created_at: "2026-09-01", updated_at: "2026-09-12" }],
      sessions: [{ id: "s1", title: "置顶旧对话", pinned: true, context_type: "general", created_at: "2026-09-01", updated_at: "2026-09-02" }],
    });
    expect(model.recent.map((item) => item.title)).toEqual(["最新笔记", "置顶旧对话"]);
    expect(model.recent[0].action.to).toBe("/notes/n%2F1");
    expect(model.recent[1].action.state).toEqual({ assistantConversationId: "s1" });
  });

  it("仅提示真实失败和未来七天内截止，排除无效日期与远期事项", () => {
    const model = buildHomeModel({ ...empty,
      papers: [{ id: "p1", title: "失败论文", status: "failed", created_at: "2026-09-01", updated_at: "2026-09-01" }],
      submission: { active: 3, pendingReviews: 2, upcomingDdls: [
        { name: "远期", deadline: "2026-12-01" }, { name: "过期", deadline: "2026-08-01" },
        { name: "近期", deadline: "2026-09-15" }, { name: "未知", deadline: "invalid" },
      ] },
    }, Date.parse("2026-09-13T12:00:00Z"));
    expect(model.attention.map((item) => item.title)).toEqual(["2 条审稿意见待回复", "近期", "1 篇论文处理失败"]);
    expect(model.recent).toEqual([]);
  });
});
