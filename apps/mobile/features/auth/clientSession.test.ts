import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { storage, secure } = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  secure: new Map<string, string>(),
}));
vi.mock("react-native", () => ({ Platform: { OS: "android" } }));
vi.mock("@react-native-async-storage/async-storage", () => ({ default: {
  getItem: async (key: string) => storage.get(key) ?? null,
  setItem: async (key: string, value: string) => { storage.set(key, value); },
} }));
vi.mock("expo-secure-store", () => ({
  getItemAsync: async (key: string) => secure.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => { secure.set(key, value); },
  deleteItemAsync: async (key: string) => { secure.delete(key); },
}));

const SERVER_A = "https://saved.example.test";
const SERVER_B = "https://other.example.test";
const fetchMock = vi.fn(async () => new Response("[]", { status: 200 }));

function lastRequest() {
  const [url, options] = (fetchMock.mock.calls.at(-1) ?? []) as unknown as [string, RequestInit];
  return { url, authorization: (options.headers as Record<string, string>).Authorization };
}

beforeEach(() => {
  vi.resetModules();
  storage.clear();
  secure.clear();
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("EXPO_PUBLIC_API_URL", "");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("mobile session and HTTP client integration", () => {
  it("uses the restored URL and credentials in the first business request", async () => {
    storage.set("api_url", SERVER_A);
    secure.set("auth_session_v1", JSON.stringify({
      version: 1, baseUrl: SERVER_A,
      tokens: { accessToken: "restored", refreshToken: "refresh" },
    }));
    const client = await import("../../lib/client");
    await client.initializeClient();
    await client.apiClient.papers.list();
    expect(lastRequest()).toEqual({
      url: `${SERVER_A}/api/papers?offset=0&limit=20`, authorization: "Bearer restored",
    });
  });

  it("never sends server A credentials to server B and sends B credentials only after login", async () => {
    storage.set("api_url", SERVER_A);
    const client = await import("../../lib/client");
    await client.initializeClient();
    await client.saveAuthTokens("token-a", "refresh-a", client.getSessionSnapshot().revision);
    await client.apiClient.auth.me();
    expect(lastRequest()).toEqual({ url: `${SERVER_A}/api/auth/me`, authorization: "Bearer token-a" });
    await client.setApiBaseUrl(SERVER_B);
    await client.apiClient.auth.me();
    expect(lastRequest()).toEqual({ url: `${SERVER_B}/api/auth/me`, authorization: undefined });
    await client.saveAuthTokens("token-b", "refresh-b", client.getSessionSnapshot().revision);
    await client.apiClient.auth.me();
    expect(lastRequest()).toEqual({ url: `${SERVER_B}/api/auth/me`, authorization: "Bearer token-b" });
  });

  it("notifies account subscribers only after persistence and removes authorization after logout", async () => {
    const client = await import("../../lib/client");
    await client.initializeClient();
    const observed: boolean[] = [];
    const unsubscribe = client.subscribeAuthState(() => observed.push(client.getIsAuthenticated()));
    await client.saveAuthTokens("token", "refresh", client.getSessionSnapshot().revision);
    await client.clearToken();
    await client.apiClient.auth.me();
    expect(lastRequest().authorization).toBeUndefined();
    expect(observed).toEqual([true, false]);
    unsubscribe();
  });
});
