import { normalizeApiUrl } from "../connectivity/shared";

const SESSION_KEY = "auth_session_v1";
const URL_KEY = "api_url";
const LEGACY_KEYS = ["auth_access_token", "auth_refresh_token", "auth_token"];

type Storage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};
type SecureStorage = Storage & { deleteItem(key: string): Promise<void> };
type Tokens = { accessToken: string; refreshToken: string };
type StoredSession = { version: 1; baseUrl: string; tokens: Tokens | null };

export type SessionSnapshot = {
  baseUrl: string;
  authenticated: boolean;
  revision: number;
  ready: boolean;
};

function readTokens(raw: string | null, baseUrl: string): Tokens | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as StoredSession;
    if (value.version !== 1 || value.baseUrl !== baseUrl) return null;
    const tokens = value.tokens;
    return tokens && typeof tokens.accessToken === "string" && tokens.accessToken.trim()
      && typeof tokens.refreshToken === "string" && tokens.refreshToken.trim()
      ? tokens : null;
  } catch {
    return null;
  }
}

/** Serialize persistence; never publish credentials before the complete session is stored. */
export function createSessionStore(storage: Storage, secure: SecureStorage, fallback: string) {
  let snapshot: SessionSnapshot = {
    baseUrl: fallback, authenticated: false, revision: 0, ready: false,
  };
  let tokens: Tokens | null = null;
  let initialization: Promise<void> | undefined;
  let queue: Promise<unknown> = Promise.resolve();
  const listeners = new Set<() => void>();

  function publish(baseUrl: string, nextTokens: Tokens | null) {
    tokens = nextTokens;
    snapshot = {
      baseUrl, authenticated: nextTokens !== null, ready: true,
      revision: snapshot.revision + 1,
    };
    for (const listener of listeners) listener();
  }

  function persist(baseUrl: string, nextTokens: Tokens | null) {
    const session: StoredSession = { version: 1, baseUrl, tokens: nextTokens };
    return secure.setItem(SESSION_KEY, JSON.stringify(session));
  }

  function initialize(): Promise<void> {
    if (initialization) return initialization;
    initialization = (async () => {
      const [storedUrl, raw] = await Promise.all([
        storage.getItem(URL_KEY), secure.getItem(SESSION_KEY),
      ]);
      let baseUrl = fallback;
      let validUrl = true;
      try {
        baseUrl = normalizeApiUrl(storedUrl ?? fallback, fallback);
      } catch {
        validUrl = false;
      }
      const restored = validUrl ? readTokens(raw, baseUrl) : null;
      // Old token-only records have no trustworthy server binding. Require a new login.
      if (!raw || !restored) await persist(baseUrl, null);
      await Promise.all(LEGACY_KEYS.map((key) => secure.deleteItem(key)));
      publish(baseUrl, restored);
    })().catch((error: unknown) => {
      initialization = undefined;
      throw error;
    });
    return initialization;
  }

  function serialized<T>(action: () => Promise<T>): Promise<T> {
    const result = queue.then(async () => {
      await initialize();
      return action();
    });
    queue = result.catch(() => undefined);
    return result;
  }

  return {
    initialize,
    getSnapshot: () => snapshot,
    getToken: () => tokens?.accessToken ?? null,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    setBaseUrl(input: string) {
      const next = normalizeApiUrl(input, fallback);
      return serialized(async () => {
        if (next === snapshot.baseUrl) return next;
        // Clear the durable session before changing the durable URL. A crash can only
        // require signing in again; it cannot bind the old token to the new server.
        await persist(next, null);
        await storage.setItem(URL_KEY, next);
        publish(next, null);
        return next;
      });
    },
    saveTokens(accessToken: string, refreshToken: string, expectedRevision: number) {
      return serialized(async () => {
        if (snapshot.revision !== expectedRevision) {
          throw new Error("连接或登录状态已变更，请重新登录");
        }
        if (!accessToken?.trim() || !refreshToken?.trim()) {
          throw new Error("后端返回的登录凭据无效");
        }
        const next = { accessToken, refreshToken };
        await persist(snapshot.baseUrl, next);
        publish(snapshot.baseUrl, next);
      });
    },
    clearTokens() {
      return serialized(async () => {
        await persist(snapshot.baseUrl, null);
        publish(snapshot.baseUrl, null);
      });
    },
  };
}
