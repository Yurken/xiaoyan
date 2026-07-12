import { describe, it, expect, beforeEach } from "vitest";
import {
  getToken,
  setToken,
  clearToken,
  hasToken,
  getApiBaseUrl,
  setApiBaseUrl,
} from "../../lib/apiBridge";

describe("apiBridge token 管理", () => {
  beforeEach(() => {
    clearToken();
  });

  it("初始无 token", () => {
    expect(getToken()).toBeNull();
    expect(hasToken()).toBe(false);
  });

  it("setToken 后可读取且持久化", () => {
    setToken("abc");
    expect(getToken()).toBe("abc");
    expect(hasToken()).toBe(true);
    expect(localStorage.getItem("auth_token")).toBe("abc");
  });

  it("clearToken 清空缓存与存储", () => {
    setToken("abc");
    clearToken();
    expect(getToken()).toBeNull();
    expect(localStorage.getItem("auth_token")).toBeNull();
  });
});

describe("apiBridge baseUrl 管理", () => {
  it("setApiBaseUrl 去除尾部斜杠", () => {
    setApiBaseUrl("https://api.example.com/");
    expect(getApiBaseUrl()).toBe("https://api.example.com");
  });

  it("空字符串回退到默认地址", () => {
    setApiBaseUrl("   ");
    expect(getApiBaseUrl()).toBe("http://localhost:8000");
  });

  it("持久化到 localStorage", () => {
    setApiBaseUrl("https://api.example.com");
    expect(localStorage.getItem("api_url")).toBe("https://api.example.com");
  });
});
