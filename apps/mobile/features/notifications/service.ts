import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

export const TEST_NOTIFICATION_TITLE = "小妍通知已就绪";
export const TEST_NOTIFICATION_BODY = "这是一条来自小妍的本地测试通知。";

export type NotificationPermissionStatus = Notifications.NotificationPermissionsStatus["status"];

export async function configureNotificationChannels() {
  if (Platform.OS !== "android") return;

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

export async function getNotificationPermissionStatus(): Promise<NotificationPermissionStatus> {
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

export async function requestNotificationPermission(): Promise<NotificationPermissionStatus> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status;
}

export async function sendLocalTestNotification(): Promise<boolean> {
  const status = await getNotificationPermissionStatus();
  if (status !== "granted") {
    return false;
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: TEST_NOTIFICATION_TITLE,
      body: TEST_NOTIFICATION_BODY,
    },
    trigger: null,
  });
  return true;
}
