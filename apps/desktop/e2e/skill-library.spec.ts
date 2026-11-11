import { test, expect } from "@playwright/test";
import { TAURI_MOCK_SCRIPT } from "./helpers/mock-tauri";

test.use({ viewport: { width: 900, height: 600 } });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(TAURI_MOCK_SCRIPT);
  await page.addInitScript(() => {
    localStorage.setItem("rc_style", "modern-minimal");
    localStorage.setItem("rc_theme", "dark");
    const host = window as unknown as {
      __TAURI_INTERNALS__: { invoke: (command: string, args?: Record<string, unknown>) => Promise<unknown> };
      __TAURI__: { core: { invoke: (command: string, args?: Record<string, unknown>) => Promise<unknown> } };
    };
    const base = host.__TAURI_INTERNALS__.invoke;
    const template = {
      id: "skill-read", name: "paper-read", title: "论文四维解读", description: "整理研究问题和主要贡献",
      prompt: "按四个维度解读论文", tags: ["论文"], kind: "prompt", is_builtin: true, is_enabled: true,
      created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
    };
    let skills = [template];
    const invoke = async (command: string, args: Record<string, unknown> = {}) => {
      if (command === "skills_list") return structuredClone(skills);
      if (command === "skills_create") {
        const skill = { ...template, id: "skill-custom", name: String(args.name), title: String(args.title), description: String(args.description), prompt: String(args.prompt), tags: args.tags as string[], is_builtin: false };
        skills.push(skill);
        return structuredClone(skill);
      }
      if (command === "skills_update") {
        skills = skills.map((skill) => skill.id !== args.id ? skill : {
          ...skill,
          ...(typeof args.title === "string" ? { title: args.title } : {}),
          ...(typeof args.prompt === "string" ? { prompt: args.prompt } : {}),
          ...(typeof args.isEnabled === "boolean" ? { is_enabled: args.isEnabled } : {}),
        });
        return structuredClone(skills.find((skill) => skill.id === args.id));
      }
      if (command === "skills_delete") { skills = skills.filter((skill) => skill.id !== args.id); return null; }
      return base(command, args);
    };
    host.__TAURI_INTERNALS__.invoke = invoke;
    host.__TAURI__.core.invoke = invoke;
  });
});

test("设置隐藏技能分区，对话管理技能后立即更新选择器", async ({ page }, testInfo) => {
  await page.goto("/settings");
  await expect(page.getByRole("navigation", { name: "设置分区" })).toBeVisible();
  await expect(page.getByRole("button", { name: "技能模板", exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "对话", exact: true }).click();
  const input = page.locator(".copilot-composer textarea");
  await input.fill("保留这段还没发出的草稿");
  await page.getByRole("button", { name: "管理技能库", exact: true }).click();
  const library = page.getByRole("dialog", { name: "技能库管理", exact: true });
  await expect(library).toBeVisible();
  await expect(library.getByText("论文四维解读", { exact: true })).toBeVisible();
  await library.getByRole("button", { name: "新建技能", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "新建技能", exact: true });
  await expect(editor).toBeVisible();
  await editor.getByPlaceholder("例如：my-skill（英文、数字、连字符）").fill("my-review");
  await editor.getByPlaceholder("例如：我的分析技能").fill("我的审阅模板");
  await editor.getByPlaceholder("用一句话说明这个技能的用途").fill("按我的格式审阅");
  await editor.getByPlaceholder("在此输入提示词模板，支持 {{变量名}} 占位符…").fill("请先列出问题，再给出建议。");
  await editor.getByRole("button", { name: "创建", exact: true }).click();
  await expect(editor).toHaveCount(0);
  await expect(library.getByText("我的审阅模板", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("skill-library.png") });
  await page.getByRole("button", { name: "关闭技能库", exact: true }).click();
  await expect(input).toHaveValue("保留这段还没发出的草稿");
  await page.getByRole("button", { name: "技能", exact: true }).click();
  await page.getByRole("button", { name: "我的审阅模板", exact: true }).click();
  await expect(page.getByRole("button", { name: "锁定技能", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "锁定技能", exact: true }).click();
  await page.getByRole("button", { name: "管理技能库", exact: true }).click();
  await library.getByRole("switch", { name: "禁用技能 我的审阅模板", exact: true }).click();
  await expect(library.getByRole("switch", { name: "启用技能 我的审阅模板", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "关闭技能库", exact: true }).click();
  await expect(page.getByRole("button", { name: "解除技能锁定", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "技能", exact: true }).click();
  await expect(page.getByRole("button", { name: "我的审阅模板", exact: true })).toHaveCount(0);
});

test("取消重置确认后恢复编辑焦点并逐层关闭", async ({ page }) => {
  await page.goto("/chat");
  await page.getByRole("button", { name: "管理技能库", exact: true }).click();
  const library = page.getByRole("dialog", { name: "技能库管理", exact: true });
  await library.getByRole("button", { name: "编辑技能 论文四维解读", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "编辑技能", exact: true });
  const reset = editor.getByRole("button", { name: "重置全部内置", exact: true });
  await reset.click();
  const confirmation = page.getByRole("dialog", { name: "重置全部内置技能", exact: true });
  await confirmation.getByRole("button", { name: "取消", exact: true }).click();
  await expect(confirmation).toHaveCount(0);
  await expect(reset).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(editor).toHaveCount(0);
  await expect(library).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(library).toHaveCount(0);
});

test("聚焦对话可管理技能，关闭编辑层会保留技能库", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("rc_layout_mode", "focus"));
  await page.goto("/workbench/free/chat");
  await page.getByRole("button", { name: "管理技能库", exact: true }).click();
  const library = page.getByRole("dialog", { name: "技能库管理", exact: true });
  await library.getByRole("button", { name: "新建技能", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "新建技能", exact: true });
  await expect(editor).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(editor).toHaveCount(0);
  await expect(library).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(library).toHaveCount(0);
  await expect(page.locator(".copilot-composer textarea")).toBeVisible();
});
