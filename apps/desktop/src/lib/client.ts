import { createClient } from "@research-copilot/api-sdk";

const DEFAULT_API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8008";
export const API_URL_STORAGE_KEY = "api_url";

function normalizeApiUrl(url: string) {
  const trimmed = url.trim().replace(/\/+$/, "");
  return trimmed || DEFAULT_API_URL;
}

export function getApiBaseUrl() {
  if (typeof window === "undefined") {
    return DEFAULT_API_URL;
  }

  const stored = window.localStorage.getItem(API_URL_STORAGE_KEY);
  return stored ? normalizeApiUrl(stored) : DEFAULT_API_URL;
}

export function setApiBaseUrl(url: string) {
  const normalized = normalizeApiUrl(url);

  if (typeof window !== "undefined") {
    window.localStorage.setItem(API_URL_STORAGE_KEY, normalized);
  }

  return normalized;
}

export function formatErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

let _token: string | null = null;
export const setToken = (t: string | null) => { _token = t; };
export const getToken = () => _token;

export const apiClient = createClient({
  get baseURL() {
    return getApiBaseUrl();
  },
  getToken,
});
