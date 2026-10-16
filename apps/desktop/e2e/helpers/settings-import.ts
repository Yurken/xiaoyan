import type { Page } from "@playwright/test";
import { TAURI_MOCK_SCRIPT } from "./mock-tauri";

export const INITIAL_URL = "https://initial.example.invalid/v1";
export const IMPORTED_URL = "https://imported.example.invalid/v1";

export async function installSettingsImportMock(page: Page) {
  // Keep the real client, controller, crypto and persistence hooks. Only the
  // native invoke/file-picker boundary is replaced, using synthetic data.
  await page.addInitScript(`${TAURI_MOCK_SCRIPT}
    (() => {
      const baseInvoke = window.__TAURI_INTERNALS__.invoke;
      const copy = value => JSON.parse(JSON.stringify(value));
      const probe = {
        persisted: {
          llm_provider: "openai_compatible",
          openai_compatible_base_url: "${INITIAL_URL}",
          openai_compatible_chat_model: "synthetic-model",
          paper_import_recognize_title: "true"
        },
        events: [], updates: [], imports: 0,
        blockNextUpdate: false, blockImport: false, failImport: false, failReadbacks: 0,
        blockPicker: false, conflicts: [],
        releaseUpdate: () => {}, releaseImport: () => {}, releasePicker: () => {}
      };
      window.__settingsImportProbe = probe;
      const invoke = async (cmd, args) => {
        if (cmd === "plugin:dialog|open") {
          if (probe.blockPicker) await new Promise(resolve => { probe.releasePicker = resolve; });
          return "/synthetic/settings.rcconf";
        }
        if (cmd === "settings_history_list") return [{
          id: "synthetic-history", name: "Synthetic saved config", created_at: "2026-01-01T00:00:00Z",
          llm_provider: "openai_compatible", chat_model: "synthetic-history-model",
          paper_search_engine: "arxiv", multi_agent_enabled: true, enabled_agents_count: 3
        }];
        if (["settings_history_apply", "settings_history_save", "settings_history_update", "data_backup_import"].includes(cmd)) {
          probe.conflicts.push(cmd);
          throw new Error("a locked replacement entry was activated");
        }
        if (cmd === "plugin:fs|read_text_file") return Array.from(new TextEncoder().encode("synthetic-encrypted-config"));
        if (cmd === "settings_get") {
          probe.events.push("get");
          if (probe.imports && probe.failReadbacks > 0) {
            probe.failReadbacks -= 1;
            throw new Error("synthetic readback unavailable");
          }
          return copy(probe.persisted);
        }
        if (cmd === "settings_update") {
          const data = copy(args.data);
          probe.updates.push(data);
          probe.events.push("update:start");
          if (probe.blockNextUpdate) {
            probe.blockNextUpdate = false;
            await new Promise(resolve => { probe.releaseUpdate = resolve; });
          }
          probe.persisted = data;
          probe.events.push("update:done");
          return { ok: true, updated: Object.keys(data) };
        }
        if (cmd === "settings_import") {
          probe.imports += 1;
          probe.events.push("import:start");
          if (args.data !== "synthetic-encrypted-config" || args.password !== "synthetic-password") {
            throw new Error("unexpected synthetic import credentials");
          }
          if (probe.blockImport) {
            await new Promise(resolve => { probe.releaseImport = resolve; });
          }
          if (probe.failImport) {
            probe.events.push("import:failed");
            throw new Error("synthetic import rejected before write");
          }
          probe.persisted = {
            ...probe.persisted,
            openai_compatible_base_url: "${IMPORTED_URL}",
            paper_import_recognize_title: "false"
          };
          probe.events.push("import:done");
          return ["openai_compatible_base_url", "paper_import_recognize_title"];
        }
        return baseInvoke(cmd, args);
      };
      window.__TAURI_INTERNALS__.invoke = invoke;
      window.__TAURI__.core.invoke = invoke;
    })();
  `);
}

export async function openSettingsImport(page: Page) {
  await page.getByRole("button", { name: "数据与配置", exact: true }).click();
  await page.getByRole("button", { name: "导入配置", exact: false }).click();
  const password = page.getByPlaceholder("输入密码", { exact: true });
  await password.waitFor({ state: "visible" });
  return password;
}
