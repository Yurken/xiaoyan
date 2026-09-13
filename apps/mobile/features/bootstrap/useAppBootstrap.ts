import { useCallback, useEffect, useState } from "react";
import * as SplashScreen from "expo-splash-screen";
import { initializeClient } from "../../lib/client";
import { configureNotificationChannels } from "../notifications/service";

export function useAppBootstrap() {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;
    void initializeClient().then(() => {
      if (active) setState("ready");
    }).catch(() => {
      if (active) setState("error");
    }).finally(() => {
      if (active) void SplashScreen.hideAsync().catch(() => undefined);
    });
    // Notification channel availability must not delay restoration of the API session.
    void configureNotificationChannels().catch(() => undefined);
    return () => { active = false; };
  }, [attempt]);

  const retry = useCallback(() => {
    setState("loading");
    setAttempt((value) => value + 1);
  }, []);

  return { state, retry };
}
