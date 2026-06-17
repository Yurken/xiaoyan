#!/usr/bin/env node

import { copyFile, mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";

const DEFAULT_APP_SLUG = "xiaoyan";
const KNOWN_APP_PREFIXES = [
  "小妍",
  "Xiaoyan",
  "xiaoyan",
  "xiaoyan-desktop",
  "ResearchCopilot",
  "research-copilot",
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

function isReleaseInstaller(file) {
  const segments = file.relativePath.split(path.sep);

  return (
    (segments.includes("dmg") && file.name.endsWith(".dmg")) ||
    (segments.includes("msi") && file.name.endsWith(".msi")) ||
    (segments.includes("nsis") && file.name.endsWith("setup.exe")) ||
    (segments.includes("appimage") && file.name.endsWith(".AppImage")) ||
    (segments.includes("deb") && file.name.endsWith(".deb")) ||
    (segments.includes("rpm") && file.name.endsWith(".rpm"))
  );
}

function normalizeInstallerName(name, appSlug) {
  if (name.startsWith("_")) {
    return `${appSlug}${name}`;
  }

  if (/^\d+\.\d+\.\d+/.test(name)) {
    return `${appSlug}_${name}`;
  }

  for (const prefix of KNOWN_APP_PREFIXES) {
    if (name === prefix) {
      return appSlug;
    }

    if (name.startsWith(`${prefix}_`)) {
      return `${appSlug}${name.slice(prefix.length)}`;
    }
  }

  return name;
}

async function collectFiles(rootDir, currentDir = rootDir) {
  const entries = await readdir(currentDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(rootDir, fullPath)));
      continue;
    }

    if (entry.isFile()) {
      files.push({
        name: entry.name,
        fullPath,
        relativePath: path.relative(rootDir, fullPath),
      });
    }
  }

  return files;
}

async function main() {
  const inputDir = path.resolve(requireArg("--input-dir"));
  const outputDir = path.resolve(requireArg("--output-dir"));
  const appSlug = (getArg("--app-slug").trim() || DEFAULT_APP_SLUG).replace(/_+$/, "");

  const inputStats = await stat(inputDir);
  if (!inputStats.isDirectory()) {
    throw new Error(`Input path is not a directory: ${inputDir}`);
  }

  const installers = (await collectFiles(inputDir))
    .filter(isReleaseInstaller)
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath));

  if (installers.length === 0) {
    throw new Error(`No release installers found in ${inputDir}`);
  }

  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  const outputNames = new Set();
  for (const installer of installers) {
    const outputName = normalizeInstallerName(installer.name, appSlug);
    if (outputNames.has(outputName)) {
      throw new Error(`Duplicate release installer name after normalization: ${outputName}`);
    }
    outputNames.add(outputName);
    await copyFile(installer.fullPath, path.join(outputDir, outputName));
    console.log(`- ${installer.relativePath} -> ${outputName}`);
  }

  console.log(`Collected ${installers.length} release installer(s): ${outputDir}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
