import type { ComponentProps } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import CryptoConfigModal from "./CryptoConfigModal";

type ModalProps = ComponentProps<typeof CryptoConfigModal>;

function props(overrides: Partial<ModalProps> = {}): ModalProps {
  return {
    modal: { mode: "export" },
    resourceLabel: "数据备份",
    password: "synthetic-password",
    confirm: "synthetic-password",
    busy: false,
    error: "",
    onPasswordChange: vi.fn(),
    onConfirmChange: vi.fn(),
    onClose: vi.fn(),
    onSubmit: vi.fn(),
    ...overrides,
  };
}

function passwordToggle(input: HTMLElement) {
  // PasswordInput currently has an icon-only toggle without an accessible name.
  // Scope this query to the real input's own wrapper, not to unrelated buttons.
  return within(input.parentElement!).getByRole("button");
}

describe("CryptoConfigModal", () => {
  afterEach(() => cleanup());

  it("交互锁独立于 busy，阻止密码编辑、显示切换、取消、背景关闭及重复提交", async () => {
    const user = userEvent.setup();
    const input = props({ interactionLocked: true, busy: false });
    const { container } = render(<CryptoConfigModal {...input} />);
    const password = screen.getByPlaceholderText("输入密码");
    const confirm = screen.getByPlaceholderText("再次输入密码");
    const cancel = screen.getByRole("button", { name: "取消" });
    const submit = screen.getByRole("button", { name: "加密并保存" });
    const backdrop = container.firstElementChild!;

    for (const field of [password, confirm]) {
      expect(field).toBeDisabled();
      expect(passwordToggle(field)).toBeDisabled();
      expect(field).toHaveAttribute("type", "password");
      await user.type(field, "changed");
      await user.click(passwordToggle(field));
      expect(field).toHaveAttribute("type", "password");
      // Dispatch explicitly as well so the handler's lock guard is covered even
      // when a programmatic key event is delivered to a disabled input.
      fireEvent.keyDown(field, { key: "Enter", code: "Enter", keyCode: 13 });
    }
    expect(cancel).toBeDisabled();
    expect(submit).toBeDisabled();
    await user.click(cancel);
    await user.click(backdrop);
    await user.click(submit);

    expect(input.onPasswordChange).not.toHaveBeenCalled();
    expect(input.onConfirmChange).not.toHaveBeenCalled();
    expect(input.onClose).not.toHaveBeenCalled();
    expect(input.onSubmit).not.toHaveBeenCalled();
    expect(password).toHaveValue("synthetic-password");
    expect(confirm).toHaveValue("synthetic-password");
  });

  it("解除交互锁后可编辑、切换密码可见性、提交，并通过取消或背景关闭", async () => {
    const user = userEvent.setup();
    const input = props({ interactionLocked: true });
    const { container, rerender } = render(<CryptoConfigModal {...input} />);
    rerender(<CryptoConfigModal {...input} interactionLocked={false} />);
    const password = screen.getByPlaceholderText("输入密码");
    const confirm = screen.getByPlaceholderText("再次输入密码");

    expect(password).toBeEnabled();
    expect(confirm).toBeEnabled();
    expect(passwordToggle(password)).toBeEnabled();
    expect(passwordToggle(confirm)).toBeEnabled();
    await user.type(password, "a");
    await user.type(confirm, "b");
    expect(input.onPasswordChange).toHaveBeenLastCalledWith("synthetic-passworda");
    expect(input.onConfirmChange).toHaveBeenLastCalledWith("synthetic-passwordb");

    await user.click(passwordToggle(password));
    await user.click(passwordToggle(confirm));
    expect(password).toHaveAttribute("type", "text");
    expect(confirm).toHaveAttribute("type", "text");
    await user.click(screen.getByRole("button", { name: "加密并保存" }));
    expect(input.onSubmit).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("heading", { name: "加密导出数据备份" }));
    expect(input.onClose).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "取消" }));
    await user.click(container.firstElementChild!);
    expect(input.onClose).toHaveBeenCalledTimes(2);
  });

  it("不传交互锁时保留配置弹窗 busy 可关闭的行为，但不能重复提交", async () => {
    const user = userEvent.setup();
    const input = props({ busy: true, resourceLabel: "配置" });
    const { container } = render(<CryptoConfigModal {...input} />);
    const password = screen.getByPlaceholderText("输入密码");
    const confirm = screen.getByPlaceholderText("再次输入密码");
    const cancel = screen.getByRole("button", { name: "取消" });
    const submit = screen.getByRole("button", { name: "处理中…" });

    expect(password).toBeEnabled();
    expect(confirm).toBeEnabled();
    expect(cancel).toBeEnabled();
    expect(submit).toBeDisabled();
    fireEvent.keyDown(password, { key: "Enter", keyCode: 13 });
    fireEvent.keyDown(confirm, { key: "Enter", keyCode: 13 });
    await user.click(submit);
    expect(input.onSubmit).not.toHaveBeenCalled();

    await user.click(cancel);
    await user.click(container.firstElementChild!);
    expect(input.onClose).toHaveBeenCalledTimes(2);
  });

  it.each([false, true])("导入只显示一个密码输入，交互锁仍适用（锁定：%s）", async (locked) => {
    const user = userEvent.setup();
    const input = props({
      modal: { mode: "import", fileData: "synthetic-encrypted-backup" },
      interactionLocked: locked,
    });
    const { container } = render(<CryptoConfigModal {...input} />);
    const password = screen.getByPlaceholderText("输入密码");
    expect(container.querySelectorAll("input")).toHaveLength(1);
    expect(screen.queryByPlaceholderText("再次输入密码")).not.toBeInTheDocument();
    const submit = screen.getByRole("button", { name: "解密并导入" });

    if (locked) {
      expect(password).toBeDisabled();
      expect(passwordToggle(password)).toBeDisabled();
      expect(submit).toBeDisabled();
    } else {
      expect(password).toBeEnabled();
      expect(submit).toBeEnabled();
    }
    await user.click(submit);
    expect(input.onSubmit).toHaveBeenCalledTimes(locked ? 0 : 1);
    expect(input.onConfirmChange).not.toHaveBeenCalled();
  });

  it.each(["输入密码", "再次输入密码"])("%s 的输入法 Enter 不提交，普通 Enter 可以提交", (placeholder) => {
    const input = props();
    render(<CryptoConfigModal {...input} />);
    const field = screen.getByPlaceholderText(placeholder);

    fireEvent.keyDown(field, { key: "Enter", code: "Enter", isComposing: true });
    fireEvent.keyDown(field, { key: "Enter", code: "Enter", keyCode: 229 });
    expect(input.onSubmit).not.toHaveBeenCalled();

    fireEvent.keyDown(field, { key: "Enter", code: "Enter", keyCode: 13, isComposing: false });
    expect(input.onSubmit).toHaveBeenCalledTimes(1);
  });

  it("原有 submitDisabled 同时阻止两个输入的 Enter 和提交按钮", async () => {
    const user = userEvent.setup();
    const input = props({ submitDisabled: true });
    render(<CryptoConfigModal {...input} />);
    const submit = screen.getByRole("button", { name: "加密并保存" });
    expect(submit).toBeDisabled();

    for (const placeholder of ["输入密码", "再次输入密码"]) {
      fireEvent.keyDown(screen.getByPlaceholderText(placeholder), { key: "Enter", keyCode: 13 });
    }
    await user.click(submit);
    expect(input.onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "取消" })).toBeEnabled();
  });
});
