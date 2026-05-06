import { useCallback, useEffect, useMemo, useState } from "react";
import { apiClient, formatErrorMessage } from "../../lib/client";

export function useMemoryPrivacyGate() {
  const [enabled, setEnabled] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [accessPassword, setAccessPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const status = await apiClient.memory.privacyStatus();
      setEnabled(status.enabled);
      setUnlocked(!status.enabled);
      if (!status.enabled) {
        setAccessPassword("");
      }
    } catch (nextError) {
      setError(formatErrorMessage(nextError));
      setEnabled(true);
      setUnlocked(false);
      setAccessPassword("");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const unlock = useCallback(async (password: string) => {
    const normalized = password.trim();
    if (!normalized) {
      setError("请输入密码。");
      setMessage("");
      return false;
    }

    setBusy(true);
    setError("");
    setMessage("");
    try {
      const matched = await apiClient.memory.verifyPrivacyPassword(normalized);
      if (!matched) {
        setError("密码不正确。");
        setUnlocked(false);
        setAccessPassword("");
        return false;
      }
      setUnlocked(true);
      setAccessPassword(normalized);
      setMessage("已解锁记忆详情。");
      return true;
    } catch (nextError) {
      setError(formatErrorMessage(nextError));
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const setPassword = useCallback(async (password: string, confirm: string) => {
    const normalized = password.trim();
    if (!normalized) {
      setError("密码不能为空。");
      setMessage("");
      return false;
    }
    if (normalized !== confirm.trim()) {
      setError("两次密码不一致。");
      setMessage("");
      return false;
    }

    setBusy(true);
    setError("");
    setMessage("");
    try {
      await apiClient.memory.setPrivacyPassword(normalized);
      setEnabled(true);
      setUnlocked(true);
      setAccessPassword(normalized);
      setMessage("已设置记忆详情密码。");
      return true;
    } catch (nextError) {
      setError(formatErrorMessage(nextError));
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const clearPassword = useCallback(async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await apiClient.memory.clearPrivacyPassword();
      setEnabled(false);
      setUnlocked(true);
      setAccessPassword("");
      setMessage("已移除记忆详情密码。");
      return true;
    } catch (nextError) {
      setError(formatErrorMessage(nextError));
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const lock = useCallback(() => {
    if (!enabled) return;
    setUnlocked(false);
    setAccessPassword("");
    setError("");
    setMessage("已锁定记忆详情。");
  }, [enabled]);

  const clearFeedback = useCallback(() => {
    setError("");
    setMessage("");
  }, []);

  return useMemo(
    () => ({
      enabled,
      unlocked,
      accessPassword,
      loading,
      busy,
      error,
      message,
      refresh,
      unlock,
      setPassword,
      clearPassword,
      lock,
      clearFeedback,
    }),
    [
      enabled,
      unlocked,
      accessPassword,
      loading,
      busy,
      error,
      message,
      refresh,
      unlock,
      setPassword,
      clearPassword,
      lock,
      clearFeedback,
    ],
  );
}

export type MemoryPrivacyGate = ReturnType<typeof useMemoryPrivacyGate>;
