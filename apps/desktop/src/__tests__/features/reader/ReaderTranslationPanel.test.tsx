import { describe, expect, it, vi } from "vitest";
import { userEvent } from "@testing-library/user-event";
import ReaderTranslationPanel from "../../../features/reader/ReaderTranslationPanel";
import { render, screen } from "../../helpers/render";

describe("ReaderTranslationPanel", () => {
  it("点击解读时不把鼠标事件当作原文传入", async () => {
    const onInterpret = vi.fn();
    const user = userEvent.setup();

    render(
      <ReaderTranslationPanel
        current={{ id: 1, source: "A research sentence.", result: "一段译文。", status: "done" }}
        interpretation={null}
        locked={false}
        continuous={false}
        fontSize={14}
        translationModel="gpt-test"
        availableModels={["gpt-test"]}
        loadingModels={false}
        modelsError=""
        onToggleLock={vi.fn()}
        onToggleContinuous={vi.fn()}
        onInterpret={onInterpret}
        onTranslationModelChange={vi.fn()}
        onEditSource={vi.fn()}
        onClear={vi.fn()}
        onCollapse={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "解读" }));

    expect(onInterpret).toHaveBeenCalledOnce();
    expect(onInterpret).toHaveBeenCalledWith();
  });
});
