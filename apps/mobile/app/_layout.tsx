import { colors } from "../features/theme";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import { useAppBootstrap } from "../features/bootstrap/useAppBootstrap";
import { StartupScreen } from "../features/bootstrap/StartupScreen";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export default function RootLayout() {
  const { state, retry } = useAppBootstrap();

  return (
    <>
      <StatusBar style="dark" backgroundColor={colors.bg} />
      {state === "ready" ? (
        <Stack screenOptions={{ headerShown: false }} />
      ) : (
        <StartupScreen failed={state === "error"} onRetry={retry} />
      )}
    </>
  );
}
