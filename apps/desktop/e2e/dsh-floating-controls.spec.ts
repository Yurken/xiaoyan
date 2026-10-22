import { expect, test } from "@playwright/test";
import { tauriMockScriptWith } from "./helpers/mock-tauri";

declare global { interface Window { __dshSyncRequests: string[] } }

test("DSH 浮窗提供 API 同步确认，取消不触发同步，停止与重启均无凸起阴影", async ({ page }, testInfo) => {
  await page.addInitScript(tauriMockScriptWith({ dsh_runtime_status: { phase: "running" } }));
  await page.addInitScript(() => {
    const native = (window as unknown as { __TAURI_INTERNALS__: { invoke: (command: string, args?: Record<string, unknown>) => Promise<unknown> } }).__TAURI_INTERNALS__;
    const invoke = native.invoke;
    window.__dshSyncRequests = [];
    native.invoke = async (command, args) => {
      if (command === "plugin:event|emit_to" && args?.event === "dsh:api-sync-request") {
        window.__dshSyncRequests.push(String(args.payload));
      }
      return invoke(command, args);
    };
  });
  const viewport = encodeURIComponent(JSON.stringify({ x: 60, y: 0, width: 1280, height: 800 }));
  await page.goto(`/?surface=dsh-runtime-controls&viewport=${viewport}`);
  const toolbar = page.getByRole("toolbar", { name: "DSH 运行控制" });
  await expect(toolbar.getByText("运行中")).toBeVisible();
  await expect(toolbar.getByRole("button", { name: "停止", exact: true })).toHaveCSS("box-shadow", "none");
  await expect(toolbar.getByRole("button", { name: "重启", exact: true })).toHaveCSS("box-shadow", "none");
  await page.getByRole("button", { name: "配置小妍 API" }).click();
  await expect(page.getByText("同步当前主模型需要重启 DSH。")).toBeVisible();
  await testInfo.attach("dsh-api-prompt-browser-mock", { body: await toolbar.screenshot(), contentType: "image/png" });
  if (process.env.DSH_E2E_SCREENSHOT) await toolbar.screenshot({ path: process.env.DSH_E2E_SCREENSHOT });
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await expect(page.getByRole("button", { name: "同步并重启" })).toHaveCount(0);
  expect(await page.evaluate(() => window.__dshSyncRequests.filter((request) => request === "sync"))).toHaveLength(0);
  await page.getByRole("button", { name: "配置小妍 API" }).click();
  await page.getByRole("button", { name: "同步并重启" }).click();
  await expect.poll(() => page.evaluate(() => window.__dshSyncRequests.filter((request) => request === "sync").length)).toBe(1);
  await expect(page.getByRole("button", { name: "配置小妍 API" })).toBeDisabled();
});
