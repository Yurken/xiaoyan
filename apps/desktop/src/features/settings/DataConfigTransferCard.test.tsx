import type { ComponentProps } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import DataConfigTransferCard from "./DataConfigTransferCard";

type TransferProps = ComponentProps<typeof DataConfigTransferCard>;

function props(overrides: Partial<TransferProps> = {}): TransferProps {
  return {
    onExportSettings: vi.fn(),
    onImportSettings: vi.fn(),
    onExportAllData: vi.fn(),
    onImportAllData: vi.fn(),
    ...overrides,
  };
}

describe("DataConfigTransferCard", () => {
  afterEach(() => cleanup());

  it("备份错误在数据备份区域可见，busy 禁用两个备份入口", async () => {
    const user = userEvent.setup();
    const error = "无法打开备份文件，请重试。";
    const input = props({ dataBusy: true, dataError: error });
    render(<DataConfigTransferCard {...input} />);
    const backupSection = screen.getByText("数据备份", { exact: true }).parentElement!.parentElement!;
    const settingsSection = screen.getByText("配置文件", { exact: true }).parentElement!.parentElement!;
    expect(within(backupSection).getByRole("alert")).toHaveTextContent(error);
    expect(within(settingsSection).queryByRole("alert")).not.toBeInTheDocument();

    const exportBackup = screen.getByRole("button", { name: /^导出数据备份/ });
    const importBackup = screen.getByRole("button", { name: /^导入数据备份/ });
    expect(exportBackup).toBeDisabled();
    expect(importBackup).toBeDisabled();
    await user.click(exportBackup);
    await user.click(importBackup);
    expect(input.onExportAllData).not.toHaveBeenCalled();
    expect(input.onImportAllData).not.toHaveBeenCalled();

    // A backup operation must not accidentally disable independent config actions.
    const exportSettings = screen.getByRole("button", { name: /^导出配置/ });
    const importSettings = screen.getByRole("button", { name: /^导入配置/ });
    expect(exportSettings).toBeEnabled();
    expect(importSettings).toBeEnabled();
    await user.click(exportSettings);
    await user.click(importSettings);
    expect(input.onExportSettings).toHaveBeenCalledTimes(1);
    expect(input.onImportSettings).toHaveBeenCalledTimes(1);
  });

  it.each([undefined, ""])("未传错误或错误为空时不渲染 alert（%s）", (dataError) => {
    render(<DataConfigTransferCard {...props({ dataError })} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("清除错误并结束 busy 后移除提示，两个备份入口可以重试", async () => {
    const user = userEvent.setup();
    const input = props({ dataBusy: true, dataError: "此前的导入失败" });
    const { rerender } = render(<DataConfigTransferCard {...input} />);
    expect(screen.getByRole("alert")).toHaveTextContent("此前的导入失败");

    rerender(<DataConfigTransferCard {...input} dataBusy={false} dataError="" />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    const exportBackup = screen.getByRole("button", { name: /^导出数据备份/ });
    const importBackup = screen.getByRole("button", { name: /^导入数据备份/ });
    expect(exportBackup).toBeEnabled();
    expect(importBackup).toBeEnabled();
    await user.click(exportBackup);
    await user.click(importBackup);
    expect(input.onExportAllData).toHaveBeenCalledTimes(1);
    expect(input.onImportAllData).toHaveBeenCalledTimes(1);
  });
});
