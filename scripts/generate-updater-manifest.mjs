#!/usr/bin/env node

import { copyFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseReleaseVersion } from "./versioning.mjs";

const PLATFORM_BUNDLE_PREFERENCES = {
  darwin: [".app.tar.gz"],
  windows: [".msi", ".exe", ".msi.zip", ".nsis.zip"],
  linux: [".AppImage", ".AppImage.tar.gz"],
};

function getArg(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return "";
  }
  return process.argv[index + 1] ?? "";
}

function requireArg(flag) {
  const value = getArg(flag).trim();
  if (!value) {
    throw new Error(`Missing required argument: ${flag}`);
  }
  return value;
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function fileMatchesVersion(fileName, version) {
  const artifactVersion = version.replace(/^v/, "");
  const versionPattern = new RegExp(
    `(^|[^0-9A-Za-z])v?${escapeRegExp(artifactVersion)}($|[^0-9A-Za-z.+-])`,
  );
  return versionPattern.test(fileName);
}

function formatCandidateList(names) {
  if (names.length === 0) {
    return "";
  }

  const visibleNames = names
    .slice()
    .sort((left, right) => left.localeCompare(right))
    .slice(0, 8)
    .map((name) => `\n- ${name}`)
    .join("");
  const hiddenCount = names.length - 8;
  return `${visibleNames}${hiddenCount > 0 ? `\n- ...and ${hiddenCount} more` : ""}`;
}

function getOs(platformKey) {
  return platformKey.split("-", 1)[0] || "";
}

function pickBundleName(names, platformKey) {
  const os = getOs(platformKey);
  const preferences = PLATFORM_BUNDLE_PREFERENCES[os];

  if (!preferences) {
    throw new Error(`Unsupported updater platform: ${platformKey}`);
  }

  for (const suffix of preferences) {
    const match = names.find((name) => name.endsWith(suffix));
    if (match) {
      return match;
    }
  }

  return "";
}

function getPlatformKey(entry) {
  return entry.startsWith("updater-") ? entry.slice("updater-".length) : entry;
}

async function findPlatformDirs(inputDir) {
  const entries = await readdir(inputDir, { withFileTypes: true });
  const dirs = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const platformKey = getPlatformKey(entry.name);
    if (!platformKey.includes("-")) {
      continue;
    }

    dirs.push({
      name: entry.name,
      platformKey,
      dirPath: path.join(inputDir, entry.name),
    });
  }

  if (dirs.length === 0) {
    throw new Error(`No updater platform directories found in ${inputDir}`);
  }

  return dirs;
}

async function buildManifest(inputDir, baseUrl, version, notes, pubDate) {
  const manifest = {
    version,
    platforms: {},
  };

  if (notes) {
    manifest.notes = notes;
  }

  if (pubDate) {
    manifest.pub_date = pubDate;
  }

  const platformDirs = await findPlatformDirs(inputDir);

  for (const platform of platformDirs) {
    const names = await readdir(platform.dirPath);
    // Prefer files carrying the version (Windows installers embed it), but fall
    // back to all files when none match — the macOS bundle is named
    // "<productName>.app.tar.gz" with no version. Each platform dir holds a
    // single release, so the fallback cannot pick a wrong version.
    const namesForVersion = names.filter((name) => fileMatchesVersion(name, version));
    const candidateNames = namesForVersion.length > 0 ? namesForVersion : names;
    const bundleName = pickBundleName(candidateNames, platform.platformKey);
    if (!bundleName) {
      const candidateList = formatCandidateList(names.filter((name) => !name.endsWith(".sig")));
      throw new Error(
        `No updater bundle matching ${version} found in ${platform.dirPath}.` +
          (candidateList ? ` Bundle files found:${candidateList}` : ""),
      );
    }

    const signatureName = `${bundleName}.sig`;
    if (!names.includes(signatureName)) {
      throw new Error(`Missing signature file ${signatureName} in ${platform.dirPath}`);
    }

    const signature = (await readFile(path.join(platform.dirPath, signatureName), "utf8")).trim();
    if (!signature) {
      throw new Error(`Empty signature file ${path.join(platform.dirPath, signatureName)}`);
    }

    manifest.platforms[platform.platformKey] = {
      signature,
      url: `${baseUrl}/${encodeURIComponent(platform.name)}/${encodeURIComponent(bundleName)}`,
    };
  }

  return manifest;
}

async function copyRootLatest(inputDir, outputPath) {
  const outputDir = path.dirname(outputPath);
  await mkdir(outputDir, { recursive: true });
  const sourcePath = path.join(inputDir, "latest.json");
  if (sourcePath === outputPath) {
    return;
  }
  await copyFile(sourcePath, outputPath);
}

async function main() {
  const inputDir = path.resolve(requireArg("--input-dir"));
  const baseUrl = trimTrailingSlash(requireArg("--base-url"));
  const { appVersion } = parseReleaseVersion(requireArg("--version"));
  const outputPath = path.resolve(getArg("--output") || path.join(inputDir, "latest.json"));
  const notes = getArg("--notes").trim();
  const pubDate = getArg("--pub-date").trim();

  const inputStats = await stat(inputDir);
  if (!inputStats.isDirectory()) {
    throw new Error(`Input path is not a directory: ${inputDir}`);
  }

  const manifest = await buildManifest(inputDir, baseUrl, appVersion, notes, pubDate);
  await writeFile(path.join(inputDir, "latest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await copyRootLatest(inputDir, outputPath);
  console.log(`Generated updater manifest: ${outputPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
