#!/usr/bin/env node

// Generates the website download manifest (releases/latest.json) consumed by
// page_xiaoyan's DownloadButtons. Unlike the Tauri updater manifest this points
// at the end-user installers (.dmg / .msi) and carries no signatures.

import { readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const PLATFORM_INSTALLER_PREFERENCES = {
  "darwin-aarch64": [".dmg"],
  "darwin-x86_64": [".dmg"],
  "windows-x86_64": [".msi", "setup.exe", ".exe"],
  "windows-aarch64": [".msi", "setup.exe", ".exe"],
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

function getPlatformKey(entry) {
  return entry.startsWith("release-") ? entry.slice("release-".length) : entry;
}

function pickInstaller(names, platformKey) {
  const preferences = PLATFORM_INSTALLER_PREFERENCES[platformKey];
  if (!preferences) {
    throw new Error(`Unsupported installer platform: ${platformKey}`);
  }
  for (const suffix of preferences) {
    const match = names
      .filter((name) => name.endsWith(suffix))
      .sort((left, right) => left.localeCompare(right))[0];
    if (match) {
      return match;
    }
  }
  return "";
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
    throw new Error(`No release platform directories found in ${inputDir}`);
  }

  return dirs;
}

async function main() {
  const inputDir = path.resolve(requireArg("--input-dir"));
  const baseUrl = trimTrailingSlash(requireArg("--base-url"));
  const version = requireArg("--version").replace(/^v/, "");
  const outputPath = path.resolve(getArg("--output") || path.join(inputDir, "latest.json"));

  const inputStats = await stat(inputDir);
  if (!inputStats.isDirectory()) {
    throw new Error(`Input path is not a directory: ${inputDir}`);
  }

  const manifest = { version, platforms: {} };
  const platformDirs = await findPlatformDirs(inputDir);

  for (const platform of platformDirs) {
    const names = (await readdir(platform.dirPath)).filter((name) => !name.startsWith("."));
    const installerName = pickInstaller(names, platform.platformKey);
    if (!installerName) {
      throw new Error(
        `No installer found for ${platform.platformKey} in ${platform.dirPath}. Found: ${names.join(", ") || "(none)"}`,
      );
    }
    manifest.platforms[platform.platformKey] = {
      url: `${baseUrl}/${encodeURIComponent(platform.name)}/${encodeURIComponent(installerName)}`,
    };
  }

  await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`Generated download manifest: ${outputPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
