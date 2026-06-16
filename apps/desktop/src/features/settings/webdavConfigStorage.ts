/**
 * Local persistence for the WebDAV sync configuration.
 *
 * Sync is gated behind login, so the WebDAV server credentials are tied to the
 * logged-in session and remembered across app restarts. Stored locally only —
 * the desktop app keeps it next to the auth token in localStorage and relies on
 * the app lock for at-rest protection.
 */

const WEBDAV_CONFIG_KEY = "webdav_config";

export interface WebdavConfig {
  url: string;
  username: string;
  password: string;
}

export const EMPTY_WEBDAV_CONFIG: WebdavConfig = { url: "", username: "", password: "" };

export function loadWebdavConfig(): WebdavConfig {
  try {
    const raw = localStorage.getItem(WEBDAV_CONFIG_KEY);
    if (!raw) return { ...EMPTY_WEBDAV_CONFIG };
    const parsed = JSON.parse(raw) as Partial<WebdavConfig>;
    return {
      url: parsed.url ?? "",
      username: parsed.username ?? "",
      password: parsed.password ?? "",
    };
  } catch {
    return { ...EMPTY_WEBDAV_CONFIG };
  }
}

export function saveWebdavConfig(config: WebdavConfig): void {
  try {
    localStorage.setItem(WEBDAV_CONFIG_KEY, JSON.stringify(config));
  } catch {
    // Persistence is best-effort; ignore quota / serialization failures.
  }
}

export function clearWebdavConfig(): void {
  try {
    localStorage.removeItem(WEBDAV_CONFIG_KEY);
  } catch {
    // ignore
  }
}
