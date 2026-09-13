import { describe, expect, it, vi } from "vitest";
import { createSessionStore } from "./sessionStore";

const SERVER_A = "https://a.example.test";
const SERVER_B = "https://b.example.test/api-prefix";
const SESSION_KEY = "auth_session_v1";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function fixture() {
  const values = new Map<string, string>();
  const secrets = new Map<string, string>();
  const storage = {
    getItem: vi.fn(async (key: string) => values.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => { values.set(key, value); }),
  };
  const secure = {
    getItem: vi.fn(async (key: string) => secrets.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => { secrets.set(key, value); }),
    deleteItem: vi.fn(async (key: string) => { secrets.delete(key); }),
  };
  const restart = () => createSessionStore(storage, secure, SERVER_A);
  return { values, secrets, storage, secure, store: restart(), restart };
}

async function signIn(store: ReturnType<typeof createSessionStore>, token = "token-a") {
  await store.saveTokens(token, "refresh-a", store.getSnapshot().revision);
}

function storedSession(baseUrl = SERVER_B) {
  return JSON.stringify({ version: 1, baseUrl, tokens: { accessToken: "saved", refreshToken: "refresh" } });
}

describe("backend-bound Android sessions", () => {
  it("waits for both URL and secure storage before publishing any restored state", async () => {
    const { store, storage, secure } = fixture();
    const url = deferred<string | null>();
    const session = deferred<string | null>();
    storage.getItem.mockReturnValueOnce(url.promise);
    secure.getItem.mockReturnValueOnce(session.promise);
    const listener = vi.fn();
    store.subscribe(listener);
    const first = store.initialize();
    expect(store.initialize()).toBe(first);
    session.resolve(storedSession());
    await Promise.resolve();
    expect(store.getSnapshot().ready).toBe(false);
    expect(store.getToken()).toBeNull();
    expect(listener).not.toHaveBeenCalled();
    url.resolve(SERVER_B);
    await first;
    expect(store.getSnapshot()).toMatchObject({ ready: true, baseUrl: SERVER_B, authenticated: true });
    expect(store.getToken()).toBe("saved");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("can retry a failed startup read without silently using the default server", async () => {
    const { store, storage, values } = fixture();
    values.set("api_url", SERVER_B);
    storage.getItem.mockRejectedValueOnce(new Error("storage unavailable"));
    await expect(store.initialize()).rejects.toThrow("storage unavailable");
    expect(store.getSnapshot().ready).toBe(false);
    await store.initialize();
    expect(store.getSnapshot().baseUrl).toBe(SERVER_B);
  });

  it("requires login for legacy credentials with no server binding", async () => {
    const { store, secrets, restart } = fixture();
    secrets.set("auth_access_token", "legacy");
    secrets.set("auth_refresh_token", "legacy-refresh");
    secrets.set("auth_token", "even-older");
    await store.initialize();
    expect(store.getToken()).toBeNull();
    expect(secrets.has("auth_token")).toBe(false);
    expect(secrets.has("auth_access_token")).toBe(false);
    expect(secrets.has("auth_refresh_token")).toBe(false);
    const next = restart();
    await next.initialize();
    expect(next.getToken()).toBeNull();
  });

  it.each(["malformed", "null", storedSession(SERVER_B)])("fails closed on corrupt or mismatched persisted credentials: %s", async (raw) => {
    const { store, secrets } = fixture();
    secrets.set(SESSION_KEY, raw);
    await store.initialize();
    expect(store.getToken()).toBeNull();
    expect(store.getSnapshot().authenticated).toBe(false);
  });

  it("does not restore fallback-server credentials if the saved URL is invalid", async () => {
    const { store, secrets, values } = fixture();
    values.set("api_url", "invalid-url");
    secrets.set(SESSION_KEY, storedSession(SERVER_A));
    await store.initialize();
    expect(store.getToken()).toBeNull();
  });

  it("stores tokens together and restores them for the same server after restart", async () => {
    const { store, secure, restart } = fixture();
    await store.initialize();
    secure.setItem.mockClear();
    await signIn(store);
    expect(secure.setItem).toHaveBeenCalledTimes(1);
    const next = restart();
    await next.initialize();
    expect(next.getToken()).toBe("token-a");
    expect(next.getSnapshot().authenticated).toBe(true);
  });

  it("does not report login success when secure persistence fails", async () => {
    const { store, secure, restart } = fixture();
    await store.initialize();
    secure.setItem.mockRejectedValueOnce(new Error("write failed"));
    await expect(signIn(store)).rejects.toThrow("write failed");
    expect(store.getToken()).toBeNull();
    const next = restart();
    await next.initialize();
    expect(next.getToken()).toBeNull();
  });

  it("publishes the new backend and anonymous session together, including after restart", async () => {
    const { store, restart } = fixture();
    await store.initialize();
    await signIn(store);
    const observations: Array<[string, string | null]> = [];
    store.subscribe(() => observations.push([store.getSnapshot().baseUrl, store.getToken()]));
    await store.setBaseUrl(SERVER_B);
    expect(observations).toEqual([[SERVER_B, null]]);
    const next = restart();
    await next.initialize();
    expect(next.getSnapshot().baseUrl).toBe(SERVER_B);
    expect(next.getToken()).toBeNull();
  });

  it("preserves login when saving an equivalent normalized URL", async () => {
    const { store } = fixture();
    await store.initialize();
    await signIn(store);
    const before = store.getSnapshot();
    await store.setBaseUrl(`  ${SERVER_A}/  `);
    expect(store.getSnapshot()).toBe(before);
    expect(store.getToken()).toBe("token-a");
  });

  it("keeps the active URL when address persistence fails and never rebinds old tokens on restart", async () => {
    const { store, storage, restart } = fixture();
    await store.initialize();
    await signIn(store);
    storage.setItem.mockRejectedValueOnce(new Error("URL write failed"));
    await expect(store.setBaseUrl(SERVER_B)).rejects.toThrow("URL write failed");
    expect(store.getSnapshot().baseUrl).toBe(SERVER_A);
    expect(store.getToken()).toBe("token-a");
    const next = restart();
    await next.initialize();
    expect(next.getSnapshot().baseUrl).toBe(SERVER_A);
    expect(next.getToken()).toBeNull();
  });

  it("does not change URL if clearing the durable session fails", async () => {
    const { store, secure, storage } = fixture();
    await store.initialize();
    await signIn(store);
    secure.setItem.mockRejectedValueOnce(new Error("secure write failed"));
    await expect(store.setBaseUrl(SERVER_B)).rejects.toThrow("secure write failed");
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(store.getSnapshot().baseUrl).toBe(SERVER_A);
  });

  it("rejects a late login response after switching away and back to the same server", async () => {
    const { store } = fixture();
    await store.initialize();
    const revision = store.getSnapshot().revision;
    await store.setBaseUrl(SERVER_B);
    await store.setBaseUrl(SERVER_A);
    await expect(store.saveTokens("late", "refresh", revision)).rejects.toThrow("已变更");
    expect(store.getToken()).toBeNull();
  });

  it("serializes a pending backend switch with a concurrently returning login", async () => {
    const { store, storage } = fixture();
    await store.initialize();
    const revision = store.getSnapshot().revision;
    const pendingWrite = deferred<void>();
    storage.setItem.mockReturnValueOnce(pendingWrite.promise);
    const switching = store.setBaseUrl(SERVER_B);
    const login = store.saveTokens("late", "refresh", revision);
    const rejected = expect(login).rejects.toThrow("已变更");
    pendingWrite.resolve();
    await switching;
    await rejected;
    expect(store.getSnapshot().baseUrl).toBe(SERVER_B);
    expect(store.getToken()).toBeNull();
  });

  it("keeps a failed logout visible as authenticated and allows retry", async () => {
    const { store, secure, restart } = fixture();
    await store.initialize();
    await signIn(store);
    const revision = store.getSnapshot().revision;
    secure.setItem.mockRejectedValueOnce(new Error("logout write failed"));
    await expect(store.clearTokens()).rejects.toThrow("logout write failed");
    expect(store.getSnapshot().authenticated).toBe(true);
    await store.clearTokens();
    await expect(store.saveTokens("late", "refresh", revision)).rejects.toThrow("已变更");
    const next = restart();
    await next.initialize();
    expect(next.getToken()).toBeNull();
  });

  it("accepts only the first of concurrent logins from the same session revision", async () => {
    const { store } = fixture();
    await store.initialize();
    const revision = store.getSnapshot().revision;
    const first = store.saveTokens("first", "refresh", revision);
    const second = store.saveTokens("second", "refresh", revision);
    const rejected = expect(second).rejects.toThrow("已变更");
    await first;
    await rejected;
    expect(store.getToken()).toBe("first");
  });

  it("rejects empty credentials without changing the active session", async () => {
    const { store } = fixture();
    await store.initialize();
    await expect(store.saveTokens("", "refresh", store.getSnapshot().revision)).rejects.toThrow("无效");
    expect(store.getSnapshot().authenticated).toBe(false);
  });
});
