import { useState, useCallback, useRef, useSyncExternalStore } from "react";
import {
  apiClient,
  saveAuthTokens,
  clearToken,
  getIsAuthenticated,
  subscribeAuthState,
  getSessionSnapshot,
} from "../../lib/client";

export function useAuth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const authenticated = useSyncExternalStore(subscribeAuthState, getIsAuthenticated, getIsAuthenticated);
  const inFlight = useRef(false);

  const login = useCallback(async (email: string, password: string) => {
    if (inFlight.current) return false;
    inFlight.current = true;
    const revision = getSessionSnapshot().revision;
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.auth.login(email, password);
      await saveAuthTokens(result.access_token, result.refresh_token, revision);
      return true;
    } catch {
      setError("登录失败，请检查账号、密码和后端连接");
      return false;
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    if (inFlight.current) return false;
    inFlight.current = true;
    const revision = getSessionSnapshot().revision;
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.auth.register(email, password);
      await saveAuthTokens(result.access_token, result.refresh_token, revision);
      return true;
    } catch {
      setError("注册失败，请检查输入和后端连接");
      return false;
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setError(null);
    try {
      await clearToken();
    } catch {
      setError("退出登录失败，请稍后重试");
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, []);

  return { login, register, logout, loading, error, authenticated };
}
