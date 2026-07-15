import { afterEach, describe, expect, it, vi } from "vitest";
import { relativeTime, snapshotTimestamp } from "../../../features/experiment/shared";

describe("experiment snapshot time", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("把旧版无时区时间按 UTC 解析", () => {
    expect(snapshotTimestamp("2026-07-14T04:00:00")).toBe(
      snapshotTimestamp("2026-07-14T04:00:00Z"),
    );
    expect(snapshotTimestamp("2026-07-14 04:00:00")).toBe(
      snapshotTimestamp("2026-07-14T04:00:00Z"),
    );
  });

  it("保留 RFC 3339 中明确的时区偏移", () => {
    expect(snapshotTimestamp("2026-07-14T12:00:00+08:00")).toBe(
      snapshotTimestamp("2026-07-14T04:00:00Z"),
    );
  });

  it("刚创建的旧版 UTC 快照不再显示成数小时前", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-14T04:00:30Z"));

    expect(relativeTime("2026-07-14T04:00:00")).toBe("刚刚");
  });
});
