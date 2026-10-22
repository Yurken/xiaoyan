import { test, expect, type Page } from "@playwright/test";
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

test.describe("DSH 页面", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(TAURI_MOCK_SCRIPT);
    await page.goto("/code");
  });

  test("应显示 DSH 标题", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "DeepSeek Harness" })).toBeVisible();
  });

  test("应显示启动 DSH 区域", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "启动 DSH" })).toBeVisible();
  });

  test("未发现本机 DSH 时应显示一键安装和高级路径", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "运行环境" })).toBeVisible();
    await expect(page.getByText(/未找到本机 DSH/)).toBeVisible();
    await expect(page.getByRole("button", { name: "一键安装" })).toBeVisible();
    await page.getByRole("button", { name: "高级配置" }).click();
    await expect(page.getByLabel(/使用其他本机 DSH/)).toBeVisible();
  });

  test("应显示工作目录选择", async ({ page }) => {
    await expect(page.getByLabel("工作目录")).toBeVisible();
  });

  test("应显示启动按钮", async ({ page }) => {
    await expect(page.getByRole("button", { name: "启动 DSH" })).toBeVisible();
  });

  test("切到其他页面再回来时保持原有状态，不重新加载", async ({ page }) => {
    await page.getByRole("button", { name: "高级配置" }).click();
    await expect(page.getByLabel(/使用其他本机 DSH/)).toBeVisible();

    await page.getByLabel("首页").click();
    await expect(page).toHaveURL("/");
    // 常驻宿主会把隐藏的 DSH 页面留在 DOM 中，因此这里按链接角色定位侧栏入口。
    await page.getByRole("link", { name: "DSH" }).click();
    await expect(page).toHaveURL("/code");

    // 高级配置保持展开说明页面没有被卸载重建，内嵌应用同样不会重新加载。
    await expect(page.getByLabel(/使用其他本机 DSH/)).toBeVisible();
  });

  test("隐藏的常驻页面不遮挡当前页面", async ({ page }) => {
    // 在代码页时，主区域命中的就是常驻宿主。
    await expect
      .poll(async () => hitTestTarget(page), { timeout: 5000 })
      .toBe("keep-alive");

    await page.getByLabel("首页").click();
    await expect(page).toHaveURL("/");

    // 切换到首页后宿主只隐藏：主区域命中首页内容，而不是保活层。
    await expect.poll(async () => hitTestTarget(page), { timeout: 5000 }).toBe("page");
    await expect(page.getByTestId("code-harness-keep-alive")).toHaveCount(1);
  });
});

/** 命中主区域中心点的元素属于常驻宿主、页面内容还是其他层。 */
async function hitTestTarget(page: Page): Promise<string> {
  const box = await page.locator(".app-main").boundingBox();
  if (!box) return "none";
  return page.evaluate(
    ({ x, y }) => {
      const element = document.elementFromPoint(x, y);
      if (!element) return "none";
      if (element.closest("[data-testid='code-harness-keep-alive']")) return "keep-alive";
      if (element.closest(".app-main")) return "page";
      return "other";
    },
    { x: box.x + box.width / 2, y: box.y + box.height / 2 },
  );
}

test.describe("Codex 页面", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(TAURI_MOCK_SCRIPT);
    await page.goto("/codex");
  });

  test("应显示 Codex 标题", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Codex Harness" })).toBeVisible();
  });

  test("应显示启动 Codex 区域", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "启动 Codex" })).toBeVisible();
  });

  test("未发现本机 Codex 时应显示一键安装和高级路径", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "运行环境" })).toBeVisible();
    await expect(page.getByText(/未找到本机 Codex/)).toBeVisible();
    await expect(page.getByRole("button", { name: "一键安装" })).toBeVisible();
    await page.getByRole("button", { name: "高级配置" }).click();
    await expect(page.getByLabel(/使用其他本机 Codex/)).toBeVisible();
  });
});

test.describe("OpenCode 页面", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(TAURI_MOCK_SCRIPT);
    await page.goto("/opencode");
  });

  test("应显示 OpenCode 启动区域", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "OpenCode", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "启动 OpenCode" })).toBeVisible();
    await expect(page.getByText(/未找到本机 OpenCode/)).toBeVisible();
    await expect(page.getByRole("button", { name: "一键安装" })).toBeVisible();
    await page.getByText("高级设置").click();
    await expect(page.getByLabel(/使用其他本机 OpenCode/)).toBeVisible();
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

test.describe("文件中转站", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(TAURI_MOCK_SCRIPT);
    await page.goto("/inbox");
  });

  test("应显示拖入与剪贴板两种暂存入口", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "文件中转站" })).toBeVisible();
    await expect(page.getByRole("button", { name: /粘贴剪贴板/ })).toBeVisible();
    await expect(page.getByText(/拖到桌面小妍会直接暂存/)).toBeVisible();
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
