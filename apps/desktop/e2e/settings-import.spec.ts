import { writeFile } from "node:fs/promises";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { IMPORTED_URL, INITIAL_URL, installSettingsImportMock, openSettingsImport } from "./helpers/settings-import";

type Probe = {
  persisted: Record<string, string>; events: string[]; updates: Record<string, string>[]; imports: number;
  blockNextUpdate: boolean; blockImport: boolean; failImport: boolean; failReadbacks: number;
  blockPicker: boolean; conflicts: string[];
  releaseUpdate: () => void; releaseImport: () => void; releasePicker: () => void;
};
declare global { interface Window { __settingsImportProbe: Probe } }

const connectionUrl = (page: Page) => page.getByPlaceholder("https://api.example.com/v1", { exact: true });
async function showConnection(page: Page) {
  await page.getByRole("button", { name: "小妍", exact: true }).click();
}
async function screenshot(page: Page, testInfo: TestInfo, name: string) {
  const state = JSON.stringify(await page.evaluate(() => ({
    persisted: window.__settingsImportProbe.persisted,
    events: window.__settingsImportProbe.events,
    imports: window.__settingsImportProbe.imports,
    updates: window.__settingsImportProbe.updates,
    conflicts: window.__settingsImportProbe.conflicts,
  })), null, 2);
  if (process.env.SETTINGS_E2E_SCREENSHOTS) {
    const destination = process.env.SETTINGS_E2E_SCREENSHOTS;
    await page.screenshot({ path: `${destination}/${name}.png`, fullPage: true });
    await writeFile(`${destination}/${name}.json`, state);
  }
  await testInfo.attach(name, { body: state, contentType: "application/json" });
}

test.beforeEach(async ({ page }) => {
  await installSettingsImportMock(page);
  await page.goto("/settings");
  await showConnection(page);
  await expect(connectionUrl(page)).toHaveValue(INITIAL_URL);
});

test("导入等待旧在途保存，重复确认只导入一次并保留正式配置", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => { window.__settingsImportProbe.blockNextUpdate = true; });
  await connectionUrl(page).fill("https://old-edit.example.invalid/v1");
  await expect.poll(() => page.evaluate(() => window.__settingsImportProbe.updates.length)).toBe(1);
  const password = await openSettingsImport(page);
  await expect(password).toBeFocused();
  await password.fill("synthetic-password");
  await password.press("Enter");
  await expect(page.getByRole("button", { name: "处理中…" })).toBeDisabled();
  await password.press("Enter");
  // The durable import must wait until the older native write has settled.
  expect(await page.evaluate(() => window.__settingsImportProbe.imports)).toBe(0);
  await screenshot(page, testInfo, "settings-import-desktop-pending");
  await page.evaluate(() => window.__settingsImportProbe.releaseUpdate());
  await expect(page.getByRole("heading", { name: "解密导入配置" })).toHaveCount(0);
  await showConnection(page);
  await expect(connectionUrl(page)).toHaveValue(IMPORTED_URL);
  await expect(page.getByRole("status").filter({ hasText: "已保存" })).toBeVisible();
  expect(await page.evaluate(() => ({
    imports: window.__settingsImportProbe.imports,
    url: window.__settingsImportProbe.persisted.openai_compatible_base_url,
    title: window.__settingsImportProbe.persisted.paper_import_recognize_title,
    writes: window.__settingsImportProbe.updates.length,
    order: window.__settingsImportProbe.events.filter(event => event !== "get"),
  }))).toEqual({
    imports: 1, url: IMPORTED_URL, title: "false", writes: 1,
    order: ["update:start", "update:done", "import:start", "import:done"],
  });
  await screenshot(page, testInfo, "settings-import-desktop-success");
});

test("导入后读取失败保护正式配置，重新读取后继续编辑保存", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 768, height: 1000 });
  await page.evaluate(() => { window.__settingsImportProbe.failReadbacks = 1; });
  const password = await openSettingsImport(page);
  await password.fill("synthetic-password");
  await password.press("Enter");
  await expect(page.getByText(/synthetic readback unavailable/).first()).toBeVisible();
  await screenshot(page, testInfo, "settings-import-narrow-error");
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "配置已导入，但读取最新设置失败" })).toBeVisible();
  await showConnection(page);
  await expect(connectionUrl(page)).toBeDisabled();
  await expect(page.getByText("重新读取后继续编辑", { exact: false })).toBeVisible();
  // Cross the real 700ms debounce boundary. The first readback failed once;
  // editing must stay unavailable until an explicit successful reread.
  const reads = await page.evaluate(() => window.__settingsImportProbe.events.filter(event => event === "get").length);
  await page.waitForTimeout(850);
  expect(await page.evaluate(() => window.__settingsImportProbe.events.filter(event => event === "get").length)).toBe(reads);
  await screenshot(page, testInfo, "settings-import-narrow-locked");
  expect(await page.evaluate(() => ({
    updates: window.__settingsImportProbe.updates.length,
    url: window.__settingsImportProbe.persisted.openai_compatible_base_url,
  }))).toEqual({ updates: 0, url: IMPORTED_URL });
  await page.evaluate(() => { window.__settingsImportProbe.failReadbacks = 0; });
  const reread = page.getByRole("button", { name: "重新读取", exact: true });
  for (let step = 0; step < 24; step += 1) {
    if (await reread.evaluate(element => element === document.activeElement)) break;
    await page.keyboard.press("Tab");
  }
  await expect(reread).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(connectionUrl(page)).toHaveValue(IMPORTED_URL);
  await expect(page.getByRole("alert").filter({ hasText: "配置已导入" })).toHaveCount(0);
  await connectionUrl(page).fill("https://continued-edit.example.invalid/v1");
  await expect.poll(() => page.evaluate(() => window.__settingsImportProbe.persisted.openai_compatible_base_url))
    .toBe("https://continued-edit.example.invalid/v1");
  await expect(page.getByRole("status").filter({ hasText: "已保存" })).toBeVisible();
  await screenshot(page, testInfo, "settings-import-narrow-recovered");
});

test("中文组合输入的Enter不确认，普通Enter可确认且在途不重复", async ({ page }, testInfo) => {
  const password = await openSettingsImport(page);
  await expect(password).toBeFocused();
  await password.fill("synthetic-password");
  await password.dispatchEvent("keydown", { key: "Enter", code: "Enter", isComposing: true, keyCode: 13 });
  await expect(page.getByRole("heading", { name: "解密导入配置" })).toBeVisible();
  expect(await page.evaluate(() => window.__settingsImportProbe.imports)).toBe(0);
  await password.dispatchEvent("keydown", { key: "Enter", code: "Enter", isComposing: false, keyCode: 229 });
  expect(await page.evaluate(() => window.__settingsImportProbe.imports)).toBe(0);
  await page.evaluate(() => { window.__settingsImportProbe.blockImport = true; });
  await password.press("Enter");
  await expect.poll(() => page.evaluate(() => window.__settingsImportProbe.imports)).toBe(1);
  await password.press("Enter");
  expect(await page.evaluate(() => window.__settingsImportProbe.imports)).toBe(1);
  await page.evaluate(() => window.__settingsImportProbe.releaseImport());
  await expect(page.getByRole("heading", { name: "解密导入配置" })).toHaveCount(0);
  await screenshot(page, testInfo, "settings-import-keyboard-success");
});


for (const outcome of ["success", "failure"] as const) {
  test(`关闭在途导入弹窗仍锁定配置入口，明确${outcome}后才恢复编辑`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const draftUrl = "https://pre-import-draft.example.invalid/v1";
    await connectionUrl(page).fill(draftUrl);
    await page.evaluate((fail) => {
      window.__settingsImportProbe.blockImport = true;
      window.__settingsImportProbe.failImport = fail;
    }, outcome === "failure");
    const password = await openSettingsImport(page);
    await password.fill("synthetic-password");
    await password.press("Enter");
    await expect.poll(() => page.evaluate(() => window.__settingsImportProbe.imports)).toBe(1);
    await page.getByRole("button", { name: "取消", exact: true }).click();
    await expect(page.getByRole("heading", { name: "解密导入配置" })).toHaveCount(0);

    for (const name of ["导入配置", "导出配置", "导入数据备份", "导出数据备份"]) {
      await expect(page.getByRole("button", { name, exact: false })).toBeDisabled();
    }
    await expect(page.getByRole("button", { name: "管理历史", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "保存当前设置", exact: true })).toBeDisabled();
    await showConnection(page);
    await expect(connectionUrl(page)).toBeDisabled();
    await expect(page.getByRole("button", { name: "DeepSeek", exact: true })).toBeDisabled();
    await expect(page.getByTitle("查询可用模型").first()).toBeDisabled();
    await expect(page.getByTitle("小妍配置历史·快速切换")).toBeDisabled();
    const collaboration = page.getByText("启用小妍步骤协作", { exact: true }).locator("../..").getByRole("button");
    await expect(collaboration).toBeDisabled();
    await page.getByRole("button", { name: "论文导入", exact: true }).click();
    await expect(page.getByRole("button", { name: "名称", exact: true })).toBeDisabled();
    expect(await page.evaluate(() => window.__settingsImportProbe.conflicts)).toEqual([]);
    await screenshot(page, testInfo, `settings-import-closed-pending-${outcome}`);

    await page.evaluate(() => window.__settingsImportProbe.releaseImport());
    await showConnection(page);
    await expect(connectionUrl(page)).toBeEnabled();
    await expect(connectionUrl(page)).toHaveValue(outcome === "success" ? IMPORTED_URL : draftUrl);
    await expect(page.getByRole("button", { name: "DeepSeek", exact: true })).toBeEnabled();
    if (outcome === "failure") {
      await expect.poll(() => page.evaluate(() => window.__settingsImportProbe.persisted.openai_compatible_base_url)).toBe(draftUrl);
      expect(await page.evaluate(() => window.__settingsImportProbe.events)).toContain("import:failed");
    }
    expect(await page.evaluate(() => window.__settingsImportProbe.conflicts)).toEqual([]);
    await screenshot(page, testInfo, `settings-import-closed-settled-${outcome}`);
  });
}

test("原生选取回执与已打开历史管理确认交错时，外置弹窗也遵守导入锁", async ({ page }, testInfo) => {
  await page.evaluate(() => {
    window.__settingsImportProbe.blockPicker = true;
    window.__settingsImportProbe.blockImport = true;
  });
  await page.getByRole("button", { name: "数据与配置", exact: true }).click();
  // The native picker boundary returns later, after a history modal was opened.
  await page.getByRole("button", { name: "导入配置", exact: false }).click();
  await page.getByRole("button", { name: "管理历史", exact: true }).click();
  await page.getByRole("button", { name: "应用", exact: true }).click();
  await expect(page.getByRole("button", { name: "确认应用", exact: true })).toBeVisible();
  await page.evaluate(() => window.__settingsImportProbe.releasePicker());
  const password = page.getByPlaceholder("输入密码", { exact: true });
  await expect(password).toBeFocused();
  await page.keyboard.type("synthetic-password");
  await page.keyboard.press("Enter");
  await expect.poll(() => page.evaluate(() => window.__settingsImportProbe.imports)).toBe(1);
  // Keyboard navigation follows the actual auto-focused password field, without
  // forcing pointer interaction through the pre-existing history overlay.
  await page.keyboard.press("Tab");
  const cryptoCancel = page.getByRole("heading", { name: "解密导入配置" }).locator("../../..").getByRole("button", { name: "取消", exact: true });
  await expect(cryptoCancel).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "解密导入配置" })).toHaveCount(0);
  const confirmation = page.getByRole("button", { name: "确认应用", exact: true });
  if (await confirmation.count()) await expect(confirmation).toBeDisabled();
  if (await page.getByRole("heading", { name: "切换与管理", exact: true }).count()) {
    await expect(page.getByRole("button", { name: "应用", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "更新", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "快速切换", exact: true })).toBeDisabled();
  }
  expect(await page.evaluate(() => window.__settingsImportProbe.conflicts)).toEqual([]);
  await screenshot(page, testInfo, "settings-import-external-history-locked");
  await page.evaluate(() => window.__settingsImportProbe.releaseImport());
  await expect.poll(() => page.evaluate(() => window.__settingsImportProbe.persisted.openai_compatible_base_url)).toBe(IMPORTED_URL);
});
