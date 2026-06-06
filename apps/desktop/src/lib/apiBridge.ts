/**
 * Bridge between desktop local storage and @research-copilot/api-sdk token management.
 * Desktop is primarily local (Tauri invoke), but uses HTTP auth when backend API is configured.
 */

const TOKEN_KEY = "auth_token";
const API_URL_KEY = "api_url";
const DEFAULT_API_URL = "http://localhost:8000";

let _cachedToken: string | null = localStorage.getItem(TOKEN_KEY);
let _cachedBaseUrl: string = localStorage.getItem(API_URL_KEY) || DEFAULT_API_URL;

export function getToken(): string | null {
  return _cachedToken;
}

export function setToken(token: string) {
  _cachedToken = token;
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  _cachedToken = null;
  localStorage.removeItem(TOKEN_KEY);
}

export function getApiBaseUrl(): string {
  return _cachedBaseUrl;
}

export function setApiBaseUrl(url: string) {
  const trimmed = url.trim().replace(/\/+$/, "");
  _cachedBaseUrl = trimmed || DEFAULT_API_URL;
  localStorage.setItem(API_URL_KEY, _cachedBaseUrl);
}

export function hasToken(): boolean {
  return !!_cachedToken;
}
