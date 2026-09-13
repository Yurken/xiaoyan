import { createClient } from "@research-copilot/api-sdk";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import {
  defaultApiUrl,
  normalizeApiUrl,
  type ApiProbeResult,
} from "../features/connectivity/shared";

import { createSessionStore } from "../features/auth/sessionStore";

export type { ApiProbeResult };

const sessionStore = createSessionStore(
  { getItem: (key) => AsyncStorage.getItem(key), setItem: (key, value) => AsyncStorage.setItem(key, value) },
  {
    getItem: (key) => SecureStore.getItemAsync(key),
    setItem: (key, value) => SecureStore.setItemAsync(key, value),
    deleteItem: (key) => SecureStore.deleteItemAsync(key),
  },
  defaultApiUrl(Platform.OS, process.env.EXPO_PUBLIC_API_URL),
);

export const initializeClient = sessionStore.initialize;
export const getSessionSnapshot = sessionStore.getSnapshot;
export const subscribeAuthState = sessionStore.subscribe;
export const getIsAuthenticated = () => sessionStore.getSnapshot().authenticated;
export const getApiBaseUrl = () => sessionStore.getSnapshot().baseUrl;
export const setApiBaseUrl = sessionStore.setBaseUrl;
export const saveAuthTokens = sessionStore.saveTokens;
export const clearToken = sessionStore.clearTokens;

function resolveApiUrl(input: string) {
  return normalizeApiUrl(input, getApiBaseUrl());
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

export const apiClient = createClient({
  get baseURL() {
    return getApiBaseUrl();
  },
  getToken: sessionStore.getToken,
});
