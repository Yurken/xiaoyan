import { useCallback, useEffect, useRef, useState } from "react";
import {
  getApiBaseUrl,
  probeApiBaseUrl,
  setApiBaseUrl,
} from "../../lib/client";
import {
  canPersistApiProbe,
  normalizeApiUrl,
  type ApiProbeStatus,
} from "./shared";

export type ApiConnectionStatus = ApiProbeStatus | "idle";

export function useApiConnection() {
  const [input, setInput] = useState(() => getApiBaseUrl());
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<ApiConnectionStatus>("idle");
  const [message, setMessage] = useState("");
  const [savedUrl, setSavedUrl] = useState(() => getApiBaseUrl());
  const mountedRef = useRef(true);
  const inFlightRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const saveAndProbe = useCallback(async () => {
    if (inFlightRef.current) return;

    let normalized: string;
    try {
      normalized = normalizeApiUrl(input, getApiBaseUrl());
    } catch (error) {
      if (!mountedRef.current) return;
      setStatus("incompatible");
      setMessage(error instanceof Error ? error.message : "API 地址无效");
      return;
    }

    inFlightRef.current = true;
    setChecking(true);

    try {
      const result = await probeApiBaseUrl(normalized);
      if (!mountedRef.current) return;
      setStatus(result.status);
      setMessage(result.message);
      if (canPersistApiProbe(result.status)) {
        const stored = await setApiBaseUrl(normalized);
        if (!mountedRef.current) return;
        setSavedUrl(stored);
        setInput(stored);
      }
    } catch (error) {
      if (!mountedRef.current) return;
      setStatus("network");
      setMessage(error instanceof Error ? error.message : "无法连接后端");
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) {
        setChecking(false);
      }
    }
  }, [input]);

  return {
    input,
    setInput,
    checking,
    status,
    message,
    savedUrl,
    saveAndProbe,
  };
}
