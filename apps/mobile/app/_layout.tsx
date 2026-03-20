import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import { loadToken } from "../lib/client";

SplashScreen.preventAutoHideAsync();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
});

export default function RootLayout() {
  useEffect(() => {
    loadToken().finally(() => SplashScreen.hideAsync());
    registerForPushNotifications();
  }, []);

  return (
    <>
      <StatusBar style="dark" backgroundColor="#E8ECF0" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}

async function registerForPushNotifications() {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== "granted") return;
  const token = await Notifications.getExpoPushTokenAsync();
  // TODO: 将 token 上报给后端，用于 job 完成时推送
  console.log("Expo Push Token:", token.data);
}
