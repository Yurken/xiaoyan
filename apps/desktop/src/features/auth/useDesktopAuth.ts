import { useState, useCallback } from "react";
import { getToken, setToken, clearToken, getApiBaseUrl } from "../../lib/apiBridge";

async function authFetch(
  path: string,
  body: Record<string, string>,
): Promise<{ access_token: string; refresh_token: string }> {
  const baseUrl = getApiBaseUrl();
  const token = getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

export function useDesktopAuth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loginWithEmail = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await authFetch("/api/auth/login", { email, password });
      setToken(result.access_token);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "登录失败，请检查邮箱和密码");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const registerWithEmail = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await authFetch("/api/auth/register", { email, password });
      setToken(result.access_token);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "注册失败，请稍后重试");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    clearToken();
  }, []);

  return {
    loading,
    error,
    loginWithEmail,
    registerWithEmail,
    logout,
  };
}
