#!/usr/bin/env node

import { readFile, readdir, stat } from "node:fs/promises";
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

function normalizeVersion(value) {
  const version = value.trim();
  if (!/^v?\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`Invalid version: ${value}`);
  }
  return version.startsWith("v") ? version : `v${version}`;
}

function getBasicAuthHeader(username, password) {
  const credentials = Buffer.from(`${username}:${password}`, "utf8").toString("base64");
  return `Basic ${credentials}`;
}

async function main() {
  const inputDir = path.resolve(requireArg("--input-dir"));
  const version = normalizeVersion(requireArg("--version"));
  const uploadUrl = getArg("--url").trim() || process.env.UPDATE_ADMIN_URL || "http://111.231.56.208:18081/upload";
  const username = getArg("--username").trim() || process.env.UPDATE_ADMIN_USERNAME || "uploader";
  const password = getArg("--password").trim() || process.env.UPDATE_ADMIN_PASSWORD;
  const notes = getArg("--notes").trim() || process.env.UPDATE_NOTES || "";
  const pubDate = getArg("--pub-date").trim() || process.env.UPDATE_PUB_DATE || "";

  if (!password) {
    throw new Error("Missing admin password. Set UPDATE_ADMIN_PASSWORD or pass --password.");
  }

  const inputStats = await stat(inputDir);
  if (!inputStats.isDirectory()) {
    throw new Error(`Input path is not a directory: ${inputDir}`);
  }

  const names = (await readdir(inputDir))
    .filter((name) => !name.startsWith("."))
    .sort((left, right) => left.localeCompare(right));

  if (names.length === 0) {
    throw new Error(`No files found in ${inputDir}`);
  }

  const form = new FormData();
  form.set("version", version);
  if (notes) {
    form.set("notes", notes);
  }
  if (pubDate) {
    form.set("pub_date", pubDate);
  }

  for (const name of names) {
    const filePath = path.join(inputDir, name);
    const fileStats = await stat(filePath);
    if (!fileStats.isFile()) {
      continue;
    }

    const contents = await readFile(filePath);
    form.append("files", new Blob([contents]), name);
  }

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: getBasicAuthHeader(username, password),
    },
    body: form,
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Upload failed (${response.status} ${response.statusText}): ${body}`);
  }

  console.log(`Uploaded ${names.length} file(s) for ${version} to ${uploadUrl}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
