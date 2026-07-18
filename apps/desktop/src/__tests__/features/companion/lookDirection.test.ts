import { describe, expect, it } from "vitest";
import { resolveCompanionLookDirection } from "../../../features/companion/shared";

describe("resolveCompanionLookDirection", () => {
  it.each([
    [0, -100, 0],
    [100, -100, 2],
    [100, 0, 4],
    [100, 100, 6],
    [0, 100, 8],
    [-100, 100, 10],
    [-100, 0, 12],
    [-100, -100, 14],
  ])("maps (%s, %s) to direction %s", (deltaX, deltaY, expected) => {
    expect(resolveCompanionLookDirection(deltaX, deltaY, 44)).toBe(expected);
  });

  it("falls back to idle inside the pointer deadzone", () => {
    expect(resolveCompanionLookDirection(20, 20, 44)).toBeNull();
  });

  it("wraps the nearest up-left step back to direction zero", () => {
    expect(resolveCompanionLookDirection(-1, -100, 0)).toBe(0);
  });
});
