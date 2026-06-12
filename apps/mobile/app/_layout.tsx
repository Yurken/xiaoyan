import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { loadApiBaseUrl, loadToken, getApiBaseUrl } from "../lib/client";

SplashScreen.preventAutoHideAsync();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export default function RootLayout() {
  useEffect(() => {
    Promise.all([loadToken(), loadApiBaseUrl()]).finally(() => SplashScreen.hideAsync());
    setupNotifications();
  }, []);

  return (
    <>
      <StatusBar style="light" backgroundColor="#090B10" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}

async function setupNotifications() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "默认",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
      vibrationPattern: [0, 250, 250, 250],
    });
    await Notifications.setNotificationChannelAsync("analysis", {
      name: "论文分析",
      description: "论文分析完成时发送通知",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
    });
  }

  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== "granted") return;

  const token = await Notifications.getExpoPushTokenAsync();
  // Register token with backend
  try {
    await fetch(`${getApiBaseUrl()}/api/push/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: token.data, platform: Platform.OS }),
    });
  } catch {
    // Backend endpoint may not exist yet; non-blocking
    console.log("Push token:", token.data);
  }
}
