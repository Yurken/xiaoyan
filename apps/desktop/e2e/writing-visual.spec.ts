import { expect, test, type Page } from "@playwright/test";
import { TAURI_MOCK_SCRIPT } from "./helpers/mock-tauri";

interface CompileRequest {
  mainTex: string;
}

async function compileRequests(page: Page): Promise<CompileRequest[]> {
  return page.evaluate(() => (window as unknown as {
    __MOCK_WRITING_COMPILE_REQUESTS: CompileRequest[];
  }).__MOCK_WRITING_COMPILE_REQUESTS);
}

async function openVisualWriting(page: Page) {
  await page.addInitScript(TAURI_MOCK_SCRIPT);
  await page.goto("/writing");
  await expect(page.getByRole("heading", { name: "论文撰写" })).toBeVisible();
  await expect(page.locator(".writing-paper-title")).toBeVisible();
}

test.describe("LaTeX 可视化写作", () => {
  test("直接编辑可视化标题会同步源码并生成 PDF", async ({ page }) => {
    await openVisualWriting(page);
    const title = page.locator(".writing-paper-title");
    await title.click();
    await title.evaluate((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    });
    await page.keyboard.insertText("小妍可视化论文");

    await expect(page.getByRole("switch", { name: "自动预览" })).toBeChecked();
    await expect(page.locator("aside").getByRole("status")).toHaveText("PDF 已是最新", { timeout: 15_000 });
    await expect(page.locator("aside canvas").first()).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "源码", exact: true }).click();
    const source = page.getByRole("textbox", { name: "LaTeX 源码编辑器" });
    await expect(source).toBeVisible();
    expect(await source.inputValue()).toContain("\\title{小妍可视化论文}");
    const requests = await compileRequests(page);
    expect(requests.at(-1)?.mainTex).toContain("\\title{小妍可视化论文}");
  });

  test("关闭自动预览后编辑不触发新编译，已有 PDF 保留", async ({ page }) => {
    await openVisualWriting(page);
    await expect.poll(async () => (await compileRequests(page)).length).toBeGreaterThan(0);
    await expect(page.locator("aside canvas").first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole("switch", { name: "自动预览" }).click();
    const count = (await compileRequests(page)).length;

    await page.locator(".writing-paper-title").fill("仅保存，不自动编译");
    await page.waitForTimeout(1600);
    expect((await compileRequests(page)).length).toBe(count);
    await expect(page.locator("aside canvas").first()).toBeVisible();

    await page.getByRole("button", { name: "源码", exact: true }).click();
    expect(await page.getByRole("textbox", { name: "LaTeX 源码编辑器" }).inputValue()).toContain("仅保存，不自动编译");
  });

  test("新内容编译失败时继续显示上一次成功 PDF", async ({ page }) => {
    await openVisualWriting(page);
    await expect(page.locator("aside canvas").first()).toBeVisible({ timeout: 15_000 });
    await page.evaluate(() => {
      const internals = window.__TAURI_INTERNALS__ as unknown as {
        invoke: (command: string, args: unknown) => Promise<unknown>;
      };
      const original = internals.invoke;
      const invoke = async (command: string, args: unknown) => command === "writing_compile_pdf"
        ? { success: false, pdfPath: null, workDir: "/mock/work", engine: "mock-xelatex", log: "Synthetic LaTeX error" }
        : original(command, args);
      internals.invoke = invoke;
      window.__TAURI__.core.invoke = invoke;
    });

    await page.locator(".writing-paper-title").fill("尚未通过编译的修改");
    await expect(page.getByText("当前修改未通过编译，正在显示上次成功的 PDF。")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("aside canvas").first()).toBeVisible();
    await expect(page.getByText(/编译日志 \(mock-xelatex\) · 失败/)).toBeVisible();
  });

  test("MathLive 公式和参考文献选择器写回结构化内容", async ({ page }) => {
    test.setTimeout(45_000);
    await openVisualWriting(page);
    await page.locator('.tiptap-mathematics-render[data-type="block-math"]').click();
    await expect(page.getByRole("dialog", { name: "编辑独立公式" })).toBeVisible();
    await page.locator("math-field").evaluate((element) => {
      const field = element as HTMLElement & { value: string };
      field.value = "y = x^2";
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.getByRole("button", { name: "关闭公式编辑器" }).click();

    await expect(page.locator(".writing-citation")).toHaveCount(1);
    await page.getByRole("button", { name: "插入参考文献", exact: true }).click();
    await page.getByRole("button", { name: /vaswani2017attention/ }).click();
    await page.getByRole("button", { name: "插入引用", exact: true }).click();
    await expect(page.locator(".writing-citation")).toHaveCount(2);

    await page.getByRole("button", { name: "源码", exact: true }).click();
    const source = page.getByRole("textbox", { name: "LaTeX 源码编辑器" });
    expect(await source.inputValue()).toMatch(/y\s*=\s*x/);
    expect(await source.inputValue()).toContain("\\label{eq:objective}");
  });
});
