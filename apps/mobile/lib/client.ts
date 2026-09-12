import { createClient } from "@research-copilot/api-sdk";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import {
  defaultApiUrl,
  normalizeApiUrl,
  type ApiProbeResult,
} from "../features/connectivity/shared";

export type { ApiProbeResult };

const API_URL_STORAGE_KEY = "api_url";
const ACCESS_TOKEN_KEY = "auth_access_token";
const REFRESH_TOKEN_KEY = "auth_refresh_token";
const LEGACY_ACCESS_TOKEN_KEY = "auth_token";

const getToken = (): string | null => {
  return _cachedAccessToken;
};

let _cachedAccessToken: string | null = null;
let _cachedRefreshToken: string | null = null;
let _cachedBaseUrl = fallbackApiUrl();
const authListeners = new Set<() => void>();

function notifyAuthState() {
  for (const listener of authListeners) {
    listener();
  }
}

function setCachedTokens(accessToken: string | null, refreshToken: string | null) {
  const wasAuthenticated = _cachedAccessToken !== null;
  _cachedAccessToken = accessToken;
  _cachedRefreshToken = refreshToken;
  const isAuthenticated = _cachedAccessToken !== null;
  if (wasAuthenticated !== isAuthenticated) {
    notifyAuthState();
  }
}

export function getIsAuthenticated(): boolean {
  return _cachedAccessToken !== null;
}

export function subscribeAuthState(listener: () => void): () => void {
  authListeners.add(listener);
  return () => {
    authListeners.delete(listener);
  };
}

function fallbackApiUrl() {
  return defaultApiUrl(Platform.OS, process.env.EXPO_PUBLIC_API_URL);
}

function resolveApiUrl(input: string) {
  return normalizeApiUrl(input, fallbackApiUrl());
}

export async function loadToken() {
  const [access, refresh, legacy] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
    SecureStore.getItemAsync(LEGACY_ACCESS_TOKEN_KEY),
  ]);
  const nextAccess = access ?? legacy;
  setCachedTokens(nextAccess, refresh);
  if (legacy && !access) {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, legacy);
    await SecureStore.deleteItemAsync(LEGACY_ACCESS_TOKEN_KEY);
  }
}

export async function loadApiBaseUrl() {
  const stored = await AsyncStorage.getItem(API_URL_STORAGE_KEY);
  if (!stored) {
    _cachedBaseUrl = fallbackApiUrl();
    return _cachedBaseUrl;
  }
  try {
    _cachedBaseUrl = resolveApiUrl(stored);
  } catch {
    _cachedBaseUrl = fallbackApiUrl();
  }
  return _cachedBaseUrl;
}

export function getApiBaseUrl() {
  return _cachedBaseUrl;
}

export async function setApiBaseUrl(url: string) {
  const next = resolveApiUrl(url);
  _cachedBaseUrl = next;
  await AsyncStorage.setItem(API_URL_STORAGE_KEY, next);
  return next;
}

export async function probeApiBaseUrl(
  input: string,
  timeoutMs = 8000,
): Promise<ApiProbeResult> {
  let baseUrl: string;
  try {
    baseUrl = resolveApiUrl(input);
  } catch (error) {
    return {
      status: "incompatible",
      message: error instanceof Error ? error.message : "API 地址无效",
      httpStatus: null,
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}/api/settings`, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    const httpStatus = response.status;

    if (httpStatus >= 200 && httpStatus < 300) {
      return { status: "connected", message: "已连接到后端", httpStatus };
    }
    if (httpStatus === 401 || httpStatus === 403) {
      return {
        status: "auth_required",
        message: "后端可达，但需要登录后才能使用",
        httpStatus,
      };
    }
    return {
      status: "incompatible",
      message: `后端响应不兼容（HTTP ${httpStatus}）`,
      httpStatus,
    };
  } catch (error) {
    const aborted =
      (error instanceof Error && error.name === "AbortError") ||
      (typeof error === "object" &&
        error !== null &&
        "name" in error &&
        (error as { name: string }).name === "AbortError");
    if (aborted) {
      return {
        status: "timeout",
        message: "连接超时，请确认后端已启动且地址可访问",
        httpStatus: null,
      };
    }
    return {
      status: "network",
      message: "无法连接后端，请检查地址、网络或模拟器设置",
      httpStatus: null,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function saveAuthTokens(accessToken: string, refreshToken: string) {
  setCachedTokens(accessToken, refreshToken);
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken),
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken),
  ]);
}

/** Saves access token only; existing refresh token is left intact. */
export async function saveToken(token: string) {
  setCachedTokens(token, _cachedRefreshToken);
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
}

export async function clearToken() {
  setCachedTokens(null, null);
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    SecureStore.deleteItemAsync(LEGACY_ACCESS_TOKEN_KEY),
  ]);
}

export const apiClient = createClient({
  get baseURL() {
    return _cachedBaseUrl;
  },
  getToken,
});
