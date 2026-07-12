import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithRouter } from "../helpers/render";
import { resetInvokeMock } from "../mocks/tauri";
import Planner from "../../pages/Planner";

// Mock InterestsPanel - it manages its own state, no props needed
vi.mock("../../features/knowledge/InterestsPanel", () => ({
  default: () => <div data-testid="interests-panel">研究兴趣面板</div>,
}));

describe("Planner 页面", () => {
  beforeEach(() => {
    resetInvokeMock();
  });

  it("应显示研究兴趣面板", () => {
    renderWithRouter(<Planner />);
    expect(screen.getByTestId("interests-panel")).toBeInTheDocument();
  });
});
