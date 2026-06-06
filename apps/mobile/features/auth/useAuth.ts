import { useState, useCallback } from "react";
import { apiClient, saveToken, clearToken } from "../../lib/client";

export function useAuth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.auth.login(email, password);
      await saveToken(result.access_token);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "登录失败");
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
      await saveToken(result.access_token);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "注册失败");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await clearToken();
  }, []);

  return { login, register, logout, loading, error };
}
