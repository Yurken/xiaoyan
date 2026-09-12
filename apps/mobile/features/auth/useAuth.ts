import { useState, useCallback, useEffect } from "react";
import {
  apiClient,
  saveAuthTokens,
  clearToken,
  getIsAuthenticated,
  subscribeAuthState,
} from "../../lib/client";

function toUserFacingError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("API error")) {
    return fallback;
  }
  if (!message) {
    return fallback;
  }
  return fallback;
}

export function useAuth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authenticated, setAuthenticated] = useState(getIsAuthenticated);

  useEffect(() => subscribeAuthState(() => {
    setAuthenticated(getIsAuthenticated());
  }), []);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.auth.login(email, password);
      await saveAuthTokens(result.access_token, result.refresh_token);
      return true;
    } catch (e) {
      setError(toUserFacingError(e, "登录失败，请检查账号、密码和后端连接"));
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.auth.register(email, password);
      await saveAuthTokens(result.access_token, result.refresh_token);
      return true;
    } catch (e) {
      setError(toUserFacingError(e, "注册失败，请检查输入和后端连接"));
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      await clearToken();
    } catch (e) {
      setError(toUserFacingError(e, "退出登录失败，请稍后重试"));
    } finally {
      setLoading(false);
    }
  }, [loading]);

  return { login, register, logout, loading, error, authenticated };
}
