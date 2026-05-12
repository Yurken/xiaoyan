export const APP_LOCK_STATUS_CHANGE_EVENT = "xiaoyan:app-lock-status-change";

export interface AppLockStatusChangeDetail {
  enabled: boolean;
  timeoutMinutes: number;
}

export function emitAppLockStatusChange(detail: AppLockStatusChangeDetail) {
  window.dispatchEvent(new CustomEvent<AppLockStatusChangeDetail>(APP_LOCK_STATUS_CHANGE_EVENT, { detail }));
}
