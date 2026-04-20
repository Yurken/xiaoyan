#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const args = process.argv.slice(2);

function getArg(name) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

function normalizeVersion(input) {
  const version = input.replace(/^v/, "");
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`Invalid version: ${input}`);
  }
  return version;
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function writeText(relativePath, contents) {
  fs.writeFileSync(path.join(root, relativePath), contents, "utf8");
}

function updateJson(relativePath, updater, touched) {
  const current = readText(relativePath);
  const json = JSON.parse(current);
  updater(json);
  const next = `${JSON.stringify(json, null, 2)}\n`;
  if (current !== next) {
    writeText(relativePath, next);
    touched.push(relativePath);
  }
}

function updateText(relativePath, updater, touched) {
  const current = readText(relativePath);
  const next = updater(current);
  if (current !== next) {
    writeText(relativePath, next);
    touched.push(relativePath);
  }
}

const rawVersion =
  getArg("--version") ??
  getArg("--tag") ??
  process.env.RELEASE_TAG ??
  process.env.GITHUB_REF_NAME ??
  process.env.TAG_NAME;

if (!rawVersion) {
  throw new Error("Missing version. Use --version 1.2.3 or --tag v1.2.3.");
}

const version = normalizeVersion(rawVersion);
const touched = [];

for (const file of [
  "package.json",
  "apps/desktop/package.json",
  "apps/mobile/package.json",
  "apps/web/package.json",
  "packages/config/package.json",
  "packages/types/package.json",
  "packages/ui/package.json",
]) {
  updateJson(file, (json) => {
    json.version = version;
  }, touched);
}

updateJson("apps/mobile/app.json", (json) => {
  json.expo.version = version;
}, touched);

updateJson("apps/desktop/src-tauri/tauri.conf.json", (json) => {
  json.version = version;
}, touched);

updateText("apps/desktop/src-tauri/Cargo.toml", (text) => {
  return text.replace(/^version = ".*"$/m, `version = "${version}"`);
}, touched);

updateText("apps/desktop/src-tauri/src/commands/arxiv.rs", (text) => {
  return text.replace(
    /^(const ARXIV_USER_AGENT: &str = "xiaoyan-desktop\/)[\d.]+(")/m,
    `$1${version}$2`,
  );
}, touched);

updateText("apps/desktop/src-tauri/src/commands/paper_search.rs", (text) => {
  return text.replace(
    /^(const SEMANTIC_SCHOLAR_USER_AGENT: &str = "xiaoyan-desktop\/)[\d.]+(")/m,
    `$1${version}$2`,
  );
}, touched);

if (touched.length === 0) {
  console.log(`Version already synced: ${version}`);
} else {
  console.log(`Synced version ${version} in ${touched.length} files`);
  for (const file of touched) {
    console.log(`- ${file}`);
  }
}
