import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithRouter } from "../helpers/render";
import { resetInvokeMock } from "../mocks/tauri";
import Survey from "../../pages/Survey";

// Mock SurveyPanel - it manages its own state
vi.mock("../../features/knowledge/SurveyPanel", () => ({
  default: () => <div data-testid="survey-panel">综述面板</div>,
}));

describe("Survey 页面", () => {
  beforeEach(() => {
    resetInvokeMock();
  });

  it("应显示综述面板", () => {
    renderWithRouter(<Survey />);
    expect(screen.getByTestId("survey-panel")).toBeInTheDocument();
  });
});
