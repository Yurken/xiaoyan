export const SKIPPED_UPDATE_VERSION_STORAGE_KEY = "rc:auto-update:skipped-version";

export function normalizeUpdateVersion(version?: string | null) {
  return (version ?? "").trim().replace(/^v/i, "");
}

export function isUpdateVersionSkipped(version?: string | null, skippedVersion?: string | null) {
  const normalizedVersion = normalizeUpdateVersion(version);
  return normalizedVersion !== "" && normalizedVersion === normalizeUpdateVersion(skippedVersion);
}
