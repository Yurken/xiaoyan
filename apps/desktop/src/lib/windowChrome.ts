export const IS_MACOS_DESKTOP =
  typeof navigator !== "undefined" &&
  /mac/i.test(`${navigator.platform} ${navigator.userAgent}`);

export const MACOS_WINDOW_DRAG_HEIGHT = 28;
export const MACOS_TITLEBAR_LEFT_CLEARANCE = 92;

export async function startWindowDragging() {
  if (!IS_MACOS_DESKTOP) return;
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().startDragging();
  } catch {
    // Ignore when running outside Tauri or when dragging is unsupported.
  }
}
