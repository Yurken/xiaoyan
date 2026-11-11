import { test, expect } from "@playwright/test";
import { TAURI_MOCK_SCRIPT } from "./helpers/mock-tauri";

test.use({ viewport: { width: 900, height: 600 } });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(TAURI_MOCK_SCRIPT);
});

test("极简风格立即生效并在刷新后保留，设置标签完整可见", async ({ page }) => {
  await page.goto("/settings");
  const sections = page.getByRole("navigation", { name: "设置分区" });
  for (const button of await sections.getByRole("button").all()) {
    await expect(button).toBeInViewport();
    expect(await button.locator("span").evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  }
  await sections.getByRole("button", { name: "界面布局" }).click();
  await page.getByRole("button", { name: /极简工作台/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-style", "modern-minimal");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-style", "modern-minimal");
  await expect(page.getByRole("button", { name: /极简工作台/ })).toHaveAttribute("aria-pressed", "true");
});

for (const theme of ["light", "dark"] as const) {
  test(`写作分栏在最小桌面窗口可读，侧栏可展开和收起（${theme}）`, async ({ page }, testInfo) => {
    await page.addInitScript(({ theme }) => {
      localStorage.setItem("rc_style", "modern-minimal");
      localStorage.setItem("rc_theme", theme);
    }, { theme });
    await page.goto("/writing");
    await expect(page.getByRole("heading", { name: "论文撰写" })).toBeVisible();
    const source = page.locator(".writing-workspace textarea").first();
    await expect(source).toBeInViewport();
    expect((await source.boundingBox())!.width).toBeGreaterThan(240);
    await expect(page.getByText("文稿预览", { exact: true })).toBeInViewport();
    for (const name of ["新增文稿", "文稿管理", "编译 PDF"]) {
      await expect(page.getByRole("button", { name, exact: true })).toBeInViewport();
    }
    const primaryColors = await page.getByRole("button", { name: "编译 PDF", exact: true }).evaluate((el) => {
      const style = getComputedStyle(el);
      return { text: style.color, background: style.backgroundColor };
    });
    expect(primaryColors.text).not.toBe(primaryColors.background);
    await page.screenshot({ path: testInfo.outputPath(`writing-${theme}.png`) });
    await page.getByRole("button", { name: "展开侧栏" }).click();
    await expect(page.getByText("论文大纲", { exact: true })).toBeInViewport();
    await page.getByRole("button", { name: "收起侧栏" }).click();
    await expect(source).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test("短窗口导航和工具末尾页签仍可到达", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("rc_style", "modern-minimal"));
  await page.goto("/tools");
  await page.getByRole("button", { name: "科研友链", exact: true }).click();
  await expect(page.getByRole("button", { name: "科研友链", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("link", { name: "设置", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "设置分区" })).toBeVisible();
});
