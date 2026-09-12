import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import { loadApiBaseUrl, loadToken } from "../lib/client";
import { configureNotificationChannels } from "../features/notifications/service";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export default function RootLayout() {
  useEffect(() => {
    const hideSplash = () => {
      void SplashScreen.hideAsync().catch(() => undefined);
    };

    void Promise.all([loadToken(), loadApiBaseUrl(), configureNotificationChannels()])
      .catch(() => undefined)
      .finally(hideSplash);
  }, []);

  return (
    <>
      <StatusBar style="light" backgroundColor="#090B10" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
