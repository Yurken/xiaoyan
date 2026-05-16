#!/usr/bin/env node

import { copyFile, mkdir, readFile, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";

const PLATFORM_BUNDLE_PREFERENCES = {
  "darwin-aarch64": [".app.tar.gz"],
  "darwin-x86_64": [".app.tar.gz"],
  "windows-x86_64": [".msi.zip", ".nsis.zip", ".exe", ".msi"],
  "windows-aarch64": [".msi.zip", ".nsis.zip", ".exe", ".msi"],
};

const PLATFORM_INSTALLER_PREFERENCES = {
  "darwin-aarch64": [".dmg"],
  "darwin-x86_64": [".dmg"],
  "windows-x86_64": ["setup.exe", ".exe", ".msi"],
  "windows-aarch64": ["setup.exe", ".exe", ".msi"],
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

function normalizeVersion(value) {
  const version = value.trim();
  if (!/^v?\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`Invalid version: ${value}`);
  }
  return version.startsWith("v") ? version : `v${version}`;
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getArtifactVersion(version) {
  return version.replace(/^v/, "");
}

function fileMatchesVersion(fileName, version) {
  const artifactVersion = getArtifactVersion(version);
  const versionPattern = new RegExp(
    `(^|[^0-9A-Za-z])v?${escapeRegExp(artifactVersion)}($|[^0-9A-Za-z.+-])`,
  );
  return versionPattern.test(fileName);
}

function getFilesMatchingSuffixes(files, suffixes) {
  return files.filter((file) => suffixes.some((suffix) => file.name.endsWith(suffix)));
}

function getSignedFilesMatchingSuffixes(files, suffixes) {
  const signedFullPaths = new Set(
    files
      .filter((file) => file.name.endsWith(".sig"))
      .map((file) => file.fullPath.slice(0, -".sig".length)),
  );
  return getFilesMatchingSuffixes(files, suffixes).filter((file) =>
    signedFullPaths.has(file.fullPath),
  );
}

function formatCandidateList(files) {
  if (files.length === 0) {
    return "";
  }

  const names = files
    .map((file) => file.relativePath)
    .sort((left, right) => left.localeCompare(right));
  const visibleNames = names.slice(0, 8).map((name) => `\n- ${name}`).join("");
  const hiddenCount = names.length - 8;
  return `${visibleNames}${hiddenCount > 0 ? `\n- ...and ${hiddenCount} more` : ""}`;
}

function pickFileBySuffix(files, suffixes) {
  for (const suffix of suffixes) {
    const match = files
      .filter((file) => file.name.endsWith(suffix))
      .sort((left, right) => left.relativePath.localeCompare(right.relativePath))[0];
    if (match) {
      return match;
    }
  }

  return null;
}

function pickSignedFileBySuffix(files, suffixes) {
  const signedFullPaths = new Set(
    files
      .filter((file) => file.name.endsWith(".sig"))
      .map((file) => file.fullPath.slice(0, -".sig".length)),
  );

  return pickFileBySuffix(
    files.filter((file) => signedFullPaths.has(file.fullPath)),
    suffixes,
  );
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
  const platformKey = requireArg("--platform");
  const version = normalizeVersion(requireArg("--version"));
  const baseUrl = trimTrailingSlash(
    getArg("--base-url") || "http://111.231.56.208:18081/xiaoyan-updates",
  );

  const preferences = PLATFORM_BUNDLE_PREFERENCES[platformKey];
  if (!preferences) {
    throw new Error(`Unsupported platform: ${platformKey}`);
  }

  const inputStats = await stat(inputDir);
  if (!inputStats.isDirectory()) {
    throw new Error(`Input path is not a directory: ${inputDir}`);
  }

  const files = await collectFiles(inputDir);
  const filesForVersion = files.filter((file) => fileMatchesVersion(file.name, version));
  const bundleFile = pickSignedFileBySuffix(filesForVersion, preferences);

  if (!bundleFile) {
    const signedCandidates = getSignedFilesMatchingSuffixes(files, preferences);
    const candidateList = formatCandidateList(signedCandidates);
    throw new Error(
      `No signed updater bundle matching ${version} found for ${platformKey} in ${inputDir}. ` +
        "Check that the Tauri build completed for this version and TAURI_SIGNING_PRIVATE_KEY is set." +
        (candidateList ? ` Signed updater bundles found:${candidateList}` : ""),
    );
  }

  const signatureFile = files.find(
    (file) => file.fullPath === `${bundleFile.fullPath}.sig`,
  );
  if (!signatureFile) {
    throw new Error(`Missing signature file ${bundleFile.relativePath}.sig in ${inputDir}`);
  }

  const signature = (await readFile(signatureFile.fullPath, "utf8")).trim();
  if (!signature) {
    throw new Error(`Empty signature file: ${signatureFile.fullPath}`);
  }

  const installerPreferences = PLATFORM_INSTALLER_PREFERENCES[platformKey] || [];
  const pickedInstallerFile = pickFileBySuffix(filesForVersion, installerPreferences);
  const installerFile =
    pickedInstallerFile?.fullPath === bundleFile.fullPath ? null : pickedInstallerFile;
  if (installerPreferences.length > 0 && !pickedInstallerFile) {
    const candidateList = formatCandidateList(getFilesMatchingSuffixes(files, installerPreferences));
    throw new Error(
      `Missing installer file matching ${version} for ${platformKey} in ${inputDir}.` +
        (candidateList ? ` Installer files found:${candidateList}` : ""),
    );
  }

  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  await copyFile(bundleFile.fullPath, path.join(outputDir, bundleFile.name));
  await copyFile(signatureFile.fullPath, path.join(outputDir, signatureFile.name));
  if (installerFile) {
    await copyFile(installerFile.fullPath, path.join(outputDir, installerFile.name));
  }

  console.log(`Prepared upload files for ${platformKey}: ${outputDir}`);
  console.log(`- ${bundleFile.name}`);
  console.log(`- ${signatureFile.name}`);
  if (installerFile) {
    console.log(`- ${installerFile.name}`);
  }
  console.log(
    `Final updater URL: ${baseUrl}/${encodeURIComponent(version)}/${encodeURIComponent(bundleFile.name)}`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
