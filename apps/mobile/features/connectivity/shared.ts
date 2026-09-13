export type ApiProbeStatus =
  | "connected"
  | "auth_required"
  | "incompatible"
  | "timeout"
  | "network";

export type ApiProbeResult = {
  status: ApiProbeStatus;
  message: string;
  httpStatus: number | null;
};

export function canPersistApiProbe(status: ApiProbeStatus): boolean {
  return status === "connected" || status === "auth_required";
}

const ANDROID_DEFAULT_API_URL = "http://10.0.2.2:8000";
const DEFAULT_API_URL = "http://localhost:8000";

export function defaultApiUrl(platform: string, envUrl?: string | null): string {
  const fallback =
    platform === "android" ? ANDROID_DEFAULT_API_URL : DEFAULT_API_URL;
  const fromEnv = envUrl?.trim();
  if (!fromEnv) return fallback;
  try {
    return normalizeApiUrl(fromEnv, fallback);
  } catch {
    return fallback;
  }
}

export function normalizeApiUrl(input: string, fallback: string): string {
  const trimmed = input.trim();
  const candidate = (trimmed || fallback.trim()).replace(/\/+$/, "");
  if (!candidate) {
    throw new Error("请输入有效的 API 地址");
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error("API 地址无效，请输入完整的 http 或 https 地址");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("仅支持 http 或 https 协议的 API 地址");
  }
  if (!parsed.hostname) {
    throw new Error("API 地址无效，缺少主机名");
  }
  if (parsed.username || parsed.password || /\/\/[^/?#\s]*@/.test(candidate)) {
    throw new Error("API 地址不能包含用户名或密码");
  }

  const path = parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/+$/, "");
  return `${parsed.origin}${path}`;
}
