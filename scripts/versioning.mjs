const SEMVER_IDENTIFIER = "(?:0|[1-9]\\d*)";
const THREE_PART_VERSION = new RegExp(
  `^(${SEMVER_IDENTIFIER})\\.(${SEMVER_IDENTIFIER})\\.(${SEMVER_IDENTIFIER})(?:[-+]([0-9A-Za-z.-]+))?$`,
);
const FOUR_PART_VERSION = new RegExp(
  `^(${SEMVER_IDENTIFIER})\\.(${SEMVER_IDENTIFIER})\\.(${SEMVER_IDENTIFIER})\\.(${SEMVER_IDENTIFIER})$`,
);

/**
 * Converts a release tag to the SemVer accepted by Cargo and Tauri.
 *
 * Git tags and download manifests may use a four-part revision such as
 * `v0.4.6.1`. Runtime metadata cannot: Cargo rejects a fourth numeric part.
 * A fourth part is therefore represented as the prerelease immediately before
 * the next patch: `0.4.6.1` becomes `0.4.7-1`. This keeps every revision above
 * `0.4.6` and below the eventual stable `0.4.7`, which is essential for the
 * updater's version ordering.
 */
export function parseReleaseVersion(input) {
  const releaseVersion = String(input).trim().replace(/^v/i, "");
  const fourPart = FOUR_PART_VERSION.exec(releaseVersion);
  if (fourPart) {
    const [, major, minor, patch, revision] = fourPart;
    return {
      releaseVersion,
      appVersion: `${major}.${minor}.${Number(patch) + 1}-${revision}`,
      isFourPart: true,
    };
  }

  if (THREE_PART_VERSION.test(releaseVersion)) {
    return {
      releaseVersion,
      appVersion: releaseVersion,
      isFourPart: false,
    };
  }

  throw new Error(
    `Invalid version: ${input}. Use MAJOR.MINOR.PATCH (for example 0.4.6) or a four-part revision (for example 0.4.6.1).`,
  );
}
