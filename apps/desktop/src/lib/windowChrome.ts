export const IS_MACOS_DESKTOP =
  typeof navigator !== "undefined" &&
  /mac/i.test(`${navigator.platform} ${navigator.userAgent}`);

export const MACOS_WINDOW_DRAG_HEIGHT = 34;
export const MACOS_TITLEBAR_LEFT_CLEARANCE = 92;
