import { createClient } from "@research-copilot/api-sdk";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

const DEFAULT_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8008";
const API_URL_STORAGE_KEY = "api_url";

const getToken = (): string | null => {
  // SecureStore is async; for now use a cached sync value
  return _cachedToken;
};

let _cachedToken: string | null = null;
let _cachedBaseUrl = DEFAULT_BASE_URL;

function normalizeApiUrl(url: string) {
  const trimmed = url.trim().replace(/\/+$/, "");
  return trimmed || DEFAULT_BASE_URL;
}

export async function loadToken() {
  _cachedToken = await SecureStore.getItemAsync("auth_token");
}

export async function loadApiBaseUrl() {
  const stored = await AsyncStorage.getItem(API_URL_STORAGE_KEY);
  _cachedBaseUrl = stored ? normalizeApiUrl(stored) : DEFAULT_BASE_URL;
  return _cachedBaseUrl;
}

export function getApiBaseUrl() {
  return _cachedBaseUrl;
}

export async function setApiBaseUrl(url: string) {
  _cachedBaseUrl = normalizeApiUrl(url);
  await AsyncStorage.setItem(API_URL_STORAGE_KEY, _cachedBaseUrl);
  return _cachedBaseUrl;
}

export async function saveToken(token: string) {
  _cachedToken = token;
  await SecureStore.setItemAsync("auth_token", token);
}

export async function clearToken() {
  _cachedToken = null;
  await SecureStore.deleteItemAsync("auth_token");
}

export const apiClient = createClient({
  get baseURL() {
    return _cachedBaseUrl;
  },
  getToken,
});
