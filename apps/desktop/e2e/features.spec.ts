import { test, expect } from "@playwright/test";
import { TAURI_MOCK_SCRIPT, MOCK_EXPERIMENTS, tauriMockScriptWith } from "./helpers/mock-tauri";

test.describe("实验记录完整流程", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(
      tauriMockScriptWith({
        experiment_list: MOCK_EXPERIMENTS,
        submission_list: { submissions: [] },
        experiment_create: { id: "new-exp-1" },
        experiment_update: null,
        experiment_delete: null,
        experiment_list_attachments: { attachments: [] },
      }),
    );
    await page.goto("/experiment");
  });

  test("应显示实验记录列表", async ({ page }) => {
    await expect(page.getByText("BERT 微调实验")).toBeVisible();
  });

  test("点击记录应显示详情", async ({ page }) => {
    await page.getByText("BERT 微调实验").click();
    await expect(page.getByRole("textbox", { name: "标题" })).toHaveValue("BERT 微调实验");
    await expect(page.getByRole("button", { name: "保存" })).toBeVisible();
  });

  test("应显示关联投稿下拉", async ({ page }) => {
    await page.getByText("BERT 微调实验").click();
    await expect(page.getByText("关联投稿（可选）")).toBeVisible();
  });

  test("应显示实验配置区域", async ({ page }) => {
    await page.getByText("BERT 微调实验").click();
    await expect(page.getByText("实验配置", { exact: true })).toBeVisible();
  });

  test("应显示实验结果区域", async ({ page }) => {
    await page.getByText("BERT 微调实验").click();
    await expect(page.getByText("实验结果", { exact: true })).toBeVisible();
  });

  test("应显示备注与分析区域", async ({ page }) => {
    await page.getByText("BERT 微调实验").click();
    await expect(page.getByText("备注与分析")).toBeVisible();
  });

  test("应显示附件面板", async ({ page }) => {
    await page.getByText("BERT 微调实验").click();
    await expect(page.getByText("截图 / 附件")).toBeVisible();
  });
});

test.describe("工具页面标签切换", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(TAURI_MOCK_SCRIPT);
    await page.goto("/tools");
  });

  test("应支持所有标签切换", async ({ page }) => {
    const tabs = ["论文检索", "刊会查询", "学术翻译", "MD 整理", "生成 PPT", "科研友链"];

    for (const tab of tabs) {
      const tabButton = page.getByRole("button", { name: tab });
      await tabButton.click();
      await expect(tabButton).toBeVisible();
    }
  });

  test("切换标签应更新激活状态", async ({ page }) => {
    await page.getByRole("button", { name: "刊会查询" }).click();
    await expect(page.getByText("刊会查询")).toHaveCount(2);

    await page.getByRole("button", { name: "学术翻译" }).click();
    await expect(page.getByText("学术翻译")).toHaveCount(2);
  });
});

test.describe("对话页面交互", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(
      tauriMockScriptWith({
        chat_list_sessions: [
          {
            id: "session-1",
            title: "测试会话",
            mode: "direct",
            interestId: null,
            pinned: false,
            createdAt: "2024-01-10T10:00:00Z",
            updatedAt: "2024-01-10T10:00:00Z",
          },
        ],
      }),
    );
    await page.goto("/xiaoyan");
  });

  test("应显示对话界面元素", async ({ page }) => {
    await expect(page.locator(".app-main")).toBeVisible();
  });
});
