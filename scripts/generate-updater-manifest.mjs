#!/usr/bin/env node

import { copyFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const BUNDLE_SUFFIXES = [
  ".app.tar.gz",
  ".nsis.zip",
  ".msi.zip",
  ".AppImage.tar.gz",
];

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

function isBundleFile(name) {
  return BUNDLE_SUFFIXES.some((suffix) => name.endsWith(suffix));
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
    const bundleName = names.find((name) => isBundleFile(name));
    if (!bundleName) {
      throw new Error(`No updater bundle found in ${platform.dirPath}`);
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
  const version = requireArg("--version").replace(/^v/, "");
  const outputPath = path.resolve(getArg("--output") || path.join(inputDir, "latest.json"));
  const notes = getArg("--notes").trim();
  const pubDate = getArg("--pub-date").trim();

  const inputStats = await stat(inputDir);
  if (!inputStats.isDirectory()) {
    throw new Error(`Input path is not a directory: ${inputDir}`);
  }

  const manifest = await buildManifest(inputDir, baseUrl, version, notes, pubDate);
  await writeFile(path.join(inputDir, "latest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await copyRootLatest(inputDir, outputPath);
  console.log(`Generated updater manifest: ${outputPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
