import { createClient } from "@research-copilot/api-sdk";

// Desktop talks directly to backend (no Next.js proxy)
const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8008";

let _token: string | null = null;
export const setToken = (t: string | null) => { _token = t; };
export const getToken = () => _token;

export const apiClient = createClient({
  baseURL: BASE_URL,
  getToken,
});
