import { test, expect } from "@playwright/test";
import { TAURI_MOCK_SCRIPT } from "./helpers/mock-tauri";

test.describe("首页", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(TAURI_MOCK_SCRIPT);
    await page.goto("/");
  });

  test("应显示工作台概览", async ({ page }) => {
    await expect(page.locator(".app-main")).toBeVisible();
  });

  test("应显示页面内容区域", async ({ page }) => {
    await expect(page.locator(".app-main")).toBeVisible();
  });
});

test.describe("工具页面", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(TAURI_MOCK_SCRIPT);
    await page.goto("/tools");
  });

  test("应显示工具页签导航", async ({ page }) => {
    await expect(page.getByRole("button", { name: "论文检索" })).toBeVisible();
  });

  test("应显示所有工具标签", async ({ page }) => {
    for (const label of [
      "论文检索",
      "GitHub 项目",
      "刊会查询",
      "学术翻译",
      "MD 整理",
      "生成 PPT",
      "专利检索",
      "文档校验",
      "科研友链",
    ]) {
      await expect(page.getByRole("button", { name: label })).toBeVisible();
    }
  });

  test("默认应显示论文检索标签", async ({ page }) => {
    await expect(page.getByRole("button", { name: "论文检索" })).toBeVisible();
  });

  test("点击刊会查询应切换标签", async ({ page }) => {
    await page.getByRole("button", { name: "刊会查询" }).click();
    await expect(page.getByText("刊会查询")).toHaveCount(2);
  });

  test("点击学术翻译应切换标签", async ({ page }) => {
    await page.getByRole("button", { name: "学术翻译" }).click();
    await expect(page.getByText("学术翻译")).toHaveCount(2);
  });

  test("点击 MD 整理应切换标签", async ({ page }) => {
    await page.getByRole("button", { name: "MD 整理" }).click();
    await expect(page.getByRole("button", { name: "MD 整理" })).toBeVisible();
  });

  test("点击生成 PPT 应切换标签", async ({ page }) => {
    await page.getByRole("button", { name: "生成 PPT" }).click();
    await expect(page.getByRole("button", { name: "生成 PPT" })).toBeVisible();
  });

  test("点击科研友链应切换标签", async ({ page }) => {
    await page.getByRole("button", { name: "科研友链" }).click();
    await expect(page.getByText("科研友链")).toHaveCount(2);
  });

  test("默认工具页签应处于激活状态", async ({ page }) => {
    await expect(page.getByRole("button", { name: "论文检索" })).toHaveAttribute("aria-pressed", "true");
  });
});

test.describe("实验记录页面", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(TAURI_MOCK_SCRIPT);
    await page.goto("/experiment");
    await page.getByTestId("tab-records").click();
  });

  test("应显示实验模块页签", async ({ page }) => {
    await expect(page.getByTestId("tab-code")).toBeVisible();
    await expect(page.getByTestId("tab-snapshots")).toBeVisible();
    await expect(page.getByTestId("tab-records")).toBeVisible();
  });

  test("记录页签应处于激活状态", async ({ page }) => {
    await expect(page.getByTestId("tab-records")).toHaveAttribute("aria-pressed", "true");
  });

  test("应显示新建记录按钮", async ({ page }) => {
    await expect(page.getByText("新建记录")).toBeVisible();
  });

  test("无记录时应显示空状态提示", async ({ page }) => {
    await expect(page.getByText("暂无记录，点击上方「新建」开始。")).toBeVisible();
  });

  test("应显示未选择状态的提示", async ({ page }) => {
    await expect(page.getByText("从左侧选择记录，或新建一条")).toBeVisible();
  });
});

test.describe("设置页面", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(TAURI_MOCK_SCRIPT);
    await page.goto("/settings");
  });

  test("应显示设置页面", async ({ page }) => {
    // 设置页以分区切换栏作为稳定标识（页面无单一「设置」标题）。
    await expect(page.getByRole("button", { name: "升级与日志" })).toBeVisible();
  });

  test("应显示标签导航", async ({ page }) => {
    // 设置页顶部分区切换栏：每个分区是一个带 aria-pressed 的按钮。
    await expect(page.getByRole("button", { name: "升级与日志" })).toBeVisible();
    await expect(page.locator("button[aria-pressed]").first()).toBeVisible();
  });
});

test.describe("论文库页面", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(TAURI_MOCK_SCRIPT);
    await page.goto("/papers");
  });

  test("应显示论文库页签", async ({ page }) => {
    await expect(page.getByRole("button", { name: "论文库" })).toBeVisible();
  });

  test("应显示导入按钮", async ({ page }) => {
    await expect(page.getByText("导入 PDF")).toBeVisible();
  });
});

test.describe("对话页面", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(TAURI_MOCK_SCRIPT);
    await page.goto("/chat");
  });

  test("应显示对话界面", async ({ page }) => {
    await expect(page.locator(".app-main")).toBeVisible();
  });
});

test.describe("知识库页面", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(TAURI_MOCK_SCRIPT);
    await page.goto("/knowledge");
  });

  test("应显示知识库页面", async ({ page }) => {
    await expect(page.getByRole("button", { name: "知识图谱" })).toBeVisible();
    await expect(page.getByRole("button", { name: "知识笔记" })).toBeVisible();
  });
});

test.describe("综述页面", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(TAURI_MOCK_SCRIPT);
    await page.goto("/survey");
  });

  test("应显示综述页面", async ({ page }) => {
    await expect(page.getByText("结构化文献综述生成")).toBeVisible();
  });
});

test.describe("投稿管理页面", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(TAURI_MOCK_SCRIPT);
    await page.goto("/submission");
  });

  test("应显示投稿管理页面", async ({ page }) => {
    await expect(page.getByRole("button", { name: "DDL 日历" })).toBeVisible();
  });
});

test.describe("写作页面", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(TAURI_MOCK_SCRIPT);
    await page.goto("/writing");
  });

  test("应显示写作页面", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "论文撰写" })).toBeVisible();
  });
});

test.describe("规划页面", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(TAURI_MOCK_SCRIPT);
    await page.goto("/planner");
  });

  test("应显示规划页面", async ({ page }) => {
    await expect(page.getByRole("button", { name: "研究兴趣" })).toBeVisible();
    await expect(page.getByRole("button", { name: "领域动态" })).toBeVisible();
  });
});
