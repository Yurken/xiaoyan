import { describe, it, expect, beforeEach } from "vitest";
import { usePersistentStringState, usePersistentState, readPersistentValue, writePersistentValue, clearPersistentValue } from "../../hooks/usePersistentStringState";
import { renderHook, act } from "@testing-library/react";

describe("usePersistentStringState", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("应返回默认值", () => {
    const { result } = renderHook(() =>
      usePersistentStringState("test-key", "default", ["default", "other"]),
    );
    expect(result.current[0]).toBe("default");
  });

  it("应从 localStorage 读取已保存的值", () => {
    localStorage.setItem("test-key", "other");
    const { result } = renderHook(() =>
      usePersistentStringState("test-key", "default", ["default", "other"]),
    );
    expect(result.current[0]).toBe("other");
  });

  it("应更新值并保存到 localStorage", () => {
    const { result } = renderHook(() =>
      usePersistentStringState("test-key", "default", ["default", "other"]),
    );
    act(() => {
      result.current[1]("other");
    });
    expect(result.current[0]).toBe("other");
    expect(localStorage.getItem("test-key")).toBe("other");
  });

  it("不在允许值列表中的值应回退到默认值", () => {
    localStorage.setItem("test-key", "invalid");
    const { result } = renderHook(() =>
      usePersistentStringState("test-key", "default", ["default", "other"]),
    );
    expect(result.current[0]).toBe("default");
  });
});

describe("usePersistentState", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("应返回默认值", () => {
    const { result } = renderHook(() =>
      usePersistentState<{ count: number }>("test-json", { count: 0 }),
    );
    expect(result.current[0]).toEqual({ count: 0 });
  });

  it("应序列化和反序列化 JSON", () => {
    const { result } = renderHook(() =>
      usePersistentState<{ count: number }>("test-json", { count: 0 }),
    );
    act(() => {
      result.current[1]({ count: 5 });
    });
    expect(result.current[0]).toEqual({ count: 5 });
    expect(JSON.parse(localStorage.getItem("test-json")!)).toEqual({ count: 5 });
  });
});

describe("readPersistentValue / writePersistentValue / clearPersistentValue", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("应写入和读取值", () => {
    writePersistentValue("key", "value");
    expect(readPersistentValue("key")).toBe("value");
  });

  it("应清除值", () => {
    writePersistentValue("key", "value");
    clearPersistentValue("key");
    expect(readPersistentValue("key")).toBeNull();
  });

  it("不存在的键应返回 null", () => {
    expect(readPersistentValue("nonexistent")).toBeNull();
  });
});
