#!/usr/bin/env node

import { access, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

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

function getFileNameFromUrl(value) {
  try {
    const url = new URL(value);
    return decodeURIComponent(path.posix.basename(url.pathname));
  } catch {
    return path.basename(value);
  }
}

async function main() {
  const inputDir = path.resolve(requireArg("--input-dir"));
  const baseUrl = trimTrailingSlash(requireArg("--base-url"));
  const outputPath = path.resolve(getArg("--output") || path.join(inputDir, "latest.json"));

  const entries = await readdir(inputDir);
  const latestName =
    entries.find((entry) => entry === "latest.json") ??
    entries.find((entry) => /^latest.*\.json$/i.test(entry));

  if (!latestName) {
    throw new Error(`No updater manifest found in ${inputDir}`);
  }

  const manifestPath = path.join(inputDir, latestName);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

  if (!manifest.platforms || typeof manifest.platforms !== "object") {
    throw new Error(`Invalid updater manifest: ${manifestPath}`);
  }

  for (const platform of Object.values(manifest.platforms)) {
    if (!platform || typeof platform !== "object" || typeof platform.url !== "string") {
      continue;
    }

    const fileName = getFileNameFromUrl(platform.url);
    await access(path.join(inputDir, fileName));
    platform.url = `${baseUrl}/${encodeURIComponent(fileName)}`;
  }

  await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`Prepared updater manifest: ${outputPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
