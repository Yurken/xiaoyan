export type DesktopPlatform = "macos" | "windows" | "linux" | "unknown";

function detectDesktopPlatform(): DesktopPlatform {
  if (typeof navigator === "undefined") return "unknown";

  const platform = `${navigator.platform} ${navigator.userAgent}`.toLowerCase();
  if (platform.includes("mac")) return "macos";
  if (platform.includes("win")) return "windows";
  if (platform.includes("linux")) return "linux";
  return "unknown";
}

export const DESKTOP_PLATFORM = detectDesktopPlatform();
export const IS_MACOS_DESKTOP = DESKTOP_PLATFORM === "macos";
export const IS_WINDOWS_DESKTOP = DESKTOP_PLATFORM === "windows";
export const IS_LINUX_DESKTOP = DESKTOP_PLATFORM === "linux";
