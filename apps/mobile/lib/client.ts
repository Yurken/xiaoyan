import { createClient } from "@research-copilot/api-sdk";
import * as SecureStore from "expo-secure-store";

const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8008";

const getToken = (): string | null => {
  // SecureStore is async; for now use a cached sync value
  return _cachedToken;
};

let _cachedToken: string | null = null;

export async function loadToken() {
  _cachedToken = await SecureStore.getItemAsync("auth_token");
}

export async function saveToken(token: string) {
  _cachedToken = token;
  await SecureStore.setItemAsync("auth_token", token);
}

export async function clearToken() {
  _cachedToken = null;
  await SecureStore.deleteItemAsync("auth_token");
}

export const apiClient = createClient({ baseURL: BASE_URL, getToken });
