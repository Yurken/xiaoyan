import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { Skill } from "@research-copilot/types";
import { useCopilotSkills } from "../../../features/copilot/useCopilotSkills";
import { getInvokeMock, resetInvokeMock } from "../../mocks/tauri";

function makeSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: "skill-1",
    name: "paper-review",
    title: "论文审读",
    description: "检查论文论证与证据",
    prompt: "请检查论文中的研究问题与证据。",
    tags: ["论文"],
    kind: "prompt",
    is_builtin: false,
    is_enabled: true,
    created_at: "2026-11-11T00:00:00Z",
    updated_at: "2026-11-11T00:00:00Z",
    ...overrides,
  };
}

function deferredSkills() {
  let resolve!: (skills: Skill[]) => void;
  const promise = new Promise<Skill[]>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("useCopilotSkills", () => {
  const enabled = makeSkill();
  const disabled = makeSkill({ id: "disabled", is_enabled: false });

  beforeEach(() => {
    resetInvokeMock();
    getInvokeMock().mockImplementation(async (command: string) => {
      if (command === "skills_list") return [enabled, disabled];
      throw new Error(`Unexpected command: ${command}`);
    });
  });

  async function renderLoaded() {
    const rendered = renderHook(() => useCopilotSkills());
    await waitFor(() => expect(rendered.result.current.skills).toEqual([enabled]));
    return rendered;
  }

  it("异步读取技能库，只向对话选择器提供已启用技能", async () => {
    const pending = deferredSkills();
    getInvokeMock().mockReturnValueOnce(pending.promise);
    const { result } = renderHook(() => useCopilotSkills());

    expect(result.current.skills).toEqual([]);
    expect(result.current.selectedSkillId).toBeNull();
    expect(result.current.skillLocked).toBe(false);
    expect(getInvokeMock()).toHaveBeenCalledWith("skills_list");

    await act(async () => pending.resolve([enabled, disabled]));
    expect(result.current.skills).toEqual([enabled]);
  });

  it.each(["disabled", "deleted"] as const)("管理中将选中技能设为 %s 后立即清空选择和锁定", async (operation) => {
    const { result } = await renderLoaded();
    const other = makeSkill({ id: "skill-2", title: "文献比较" });
    act(() => {
      result.current.setSelectedSkillId(enabled.id);
      result.current.setSkillLocked(true);
    });

    act(() => {
      result.current.updateSkills(operation === "disabled"
        ? [{ ...enabled, is_enabled: false }, other]
        : [other]);
    });

    expect(result.current.skills).toEqual([other]);
    expect(result.current.selectedSkillId).toBeNull();
    expect(result.current.skillLocked).toBe(false);
  });

  it("编辑模板名称与提示词后保留选择，并在下一轮使用最新模板", async () => {
    const { result } = await renderLoaded();
    act(() => {
      result.current.setSelectedSkillId(enabled.id);
      result.current.setSkillLocked(true);
    });
    const edited = { ...enabled, title: "严格论文审读", prompt: "只列出证据不足的论点。" };

    act(() => result.current.updateSkills([edited]));

    expect(result.current.skills).toEqual([edited]);
    expect(result.current.skills.find((skill) => skill.id === result.current.selectedSkillId)?.prompt)
      .toBe("只列出证据不足的论点。");
    expect(result.current.selectedSkillId).toBe(enabled.id);
    expect(result.current.skillLocked).toBe(true);
  });

  it("锁定技能连续发送时保留选择，解除锁定后仅本条生效", async () => {
    const { result } = await renderLoaded();
    act(() => {
      result.current.setSelectedSkillId(enabled.id);
      result.current.setSkillLocked(true);
    });
    act(() => result.current.onSkillConsumed());
    act(() => result.current.onSkillConsumed());
    expect(result.current.selectedSkillId).toBe(enabled.id);
    expect(result.current.skillLocked).toBe(true);

    act(() => result.current.setSkillLocked(false));
    act(() => result.current.onSkillConsumed());
    expect(result.current.selectedSkillId).toBeNull();
    expect(result.current.skillLocked).toBe(false);
  });

  it("默认未锁定的技能发送一次后清空选择", async () => {
    const { result } = await renderLoaded();
    act(() => result.current.setSelectedSkillId(enabled.id));
    act(() => result.current.onSkillConsumed());
    expect(result.current.selectedSkillId).toBeNull();
  });

  it("待完成的初始加载不能覆盖技能管理中已保存的修改", async () => {
    const pending = deferredSkills();
    getInvokeMock().mockReturnValueOnce(pending.promise);
    const { result } = renderHook(() => useCopilotSkills());
    const edited = makeSkill({ title: "管理中修改的技能", prompt: "管理中保存的新提示词。" });
    act(() => {
      result.current.updateSkills([edited]);
      result.current.setSelectedSkillId(edited.id);
      result.current.setSkillLocked(true);
    });

    await act(async () => pending.resolve([enabled, disabled]));

    expect(result.current.skills).toEqual([edited]);
    expect(result.current.selectedSkillId).toBe(edited.id);
    expect(result.current.skillLocked).toBe(true);
  });

  it("打开和关闭技能管理不改变当前技能选择", async () => {
    const { result } = await renderLoaded();
    act(() => result.current.setSelectedSkillId(enabled.id));
    act(() => result.current.openLibrary());
    expect(result.current.libraryOpen).toBe(true);
    act(() => result.current.closeLibrary());
    expect(result.current.libraryOpen).toBe(false);
    expect(result.current.selectedSkillId).toBe(enabled.id);
  });
});
