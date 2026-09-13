import { beforeEach, describe, expect, it, vi } from "vitest";

const getPermissionsAsync = vi.fn();
const requestPermissionsAsync = vi.fn();
const scheduleNotificationAsync = vi.fn();
const setNotificationChannelAsync = vi.fn();

vi.mock("react-native", () => ({
  Platform: { OS: "android" },
}));

vi.mock("expo-notifications", () => ({
  AndroidImportance: { HIGH: 4 },
  getPermissionsAsync: (...args: unknown[]) => getPermissionsAsync(...args),
  requestPermissionsAsync: (...args: unknown[]) => requestPermissionsAsync(...args),
  scheduleNotificationAsync: (...args: unknown[]) => scheduleNotificationAsync(...args),
  setNotificationChannelAsync: (...args: unknown[]) => setNotificationChannelAsync(...args),
}));

import {
  getNotificationPermissionStatus,
  requestNotificationPermission,
  sendLocalTestNotification,
  TEST_NOTIFICATION_BODY,
  TEST_NOTIFICATION_TITLE,
} from "./service";

describe("notification service", () => {
  beforeEach(() => {
    getPermissionsAsync.mockReset();
    requestPermissionsAsync.mockReset();
    scheduleNotificationAsync.mockReset();
  });

  it("reads existing permission without requesting", async () => {
    getPermissionsAsync.mockResolvedValue({ status: "undetermined" });
    await expect(getNotificationPermissionStatus()).resolves.toBe("undetermined");
    expect(requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it("requests permission only via the request helper", async () => {
    requestPermissionsAsync.mockResolvedValue({ status: "granted" });
    await expect(requestNotificationPermission()).resolves.toBe("granted");
    expect(requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it("does not send a local test notification without permission", async () => {
    getPermissionsAsync.mockResolvedValue({ status: "denied" });
    await expect(sendLocalTestNotification()).resolves.toBe(false);
    expect(scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it("sends the local test notification when granted", async () => {
    getPermissionsAsync.mockResolvedValue({ status: "granted" });
    scheduleNotificationAsync.mockResolvedValue("id-1");
    await expect(sendLocalTestNotification()).resolves.toBe(true);
    expect(scheduleNotificationAsync).toHaveBeenCalledWith({
      content: {
        title: TEST_NOTIFICATION_TITLE,
        body: TEST_NOTIFICATION_BODY,
      },
      trigger: null,
    });
  });
});
