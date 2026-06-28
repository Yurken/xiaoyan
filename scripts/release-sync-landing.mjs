#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const DEFAULT_PAGE_REPO = process.env.XIAOYAN_PAGE_REPO || path.resolve(ROOT_DIR, "..", "page_xiaoyan");

function getArg(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return "";
  }
  return process.argv[index + 1] ?? "";
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function readRootVersion() {
  const packageJsonPath = path.join(ROOT_DIR, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  const version = String(packageJson.version || "").trim();
  if (!version) {
    throw new Error(`Missing version in ${packageJsonPath}`);
  }
  return version.startsWith("v") ? version : `v${version}`;
}

function resolveVersion() {
  const explicit = getArg("--version").trim();
  return explicit ? (explicit.startsWith("v") ? explicit : `v${explicit}`) : readRootVersion();
}

function buildForwardArgs(version) {
  const forwarded = ["release:sync", "--version", version];
  const passthroughFlags = [
    "--dry-run",
    "--skip-build",
    "--skip-deploy",
    "--skip-manifest",
    "--skip-verify",
  ];

  for (const flag of passthroughFlags) {
    if (hasFlag(flag)) {
      forwarded.push(flag);
    }
  }

  const passthroughValues = [
    "--notes",
    "--pub-date",
    "--r2-base",
    "--ssh-target",
    "--ssh-key",
    "--server-manifest-path",
    "--server-landing-dir",
    "--public-base-url",
  ];

  for (const flag of passthroughValues) {
    const value = getArg(flag).trim();
    if (value) {
      forwarded.push(flag, value);
    }
  }

  return forwarded;
}

function printHelp() {
  console.log(`Usage:
  pnpm release:landing
  pnpm release:landing --version v0.4.4

Defaults:
  - Reads the target version from xiaoyan/package.json
  - Assumes page repo is at ${DEFAULT_PAGE_REPO}
  - Sets XIAOYAN_SOURCE_REPO to this xiaoyan repo automatically

Wrapper-only flags:
  --page-repo PATH

Forwarded flags:
  --dry-run
  --skip-build
  --skip-deploy
  --skip-manifest
  --skip-verify
  --notes "custom notes"
  --pub-date 2026-06-25T12:00:00+08:00
  --r2-base URL
  --ssh-target root@host
  --ssh-key PATH
  --server-manifest-path PATH
  --server-landing-dir PATH
  --public-base-url URL
`);
}

function main() {
  if (hasFlag("--help") || hasFlag("-h")) {
    printHelp();
    return;
  }

  const pageRepo = path.resolve(getArg("--page-repo").trim() || DEFAULT_PAGE_REPO);
  const pagePackageJsonPath = path.join(pageRepo, "package.json");
  if (!fs.existsSync(pagePackageJsonPath)) {
    throw new Error(`page_xiaoyan package.json not found: ${pagePackageJsonPath}`);
  }

  const version = resolveVersion();
  const forwardArgs = buildForwardArgs(version);

  console.log(`Syncing landing site for ${version}`);
  console.log(`Using xiaoyan repo: ${ROOT_DIR}`);
  console.log(`Using page repo: ${pageRepo}`);

  execFileSync(
    "pnpm",
    ["--dir", pageRepo, ...forwardArgs],
    {
      cwd: ROOT_DIR,
      stdio: "inherit",
      env: {
        ...process.env,
        XIAOYAN_SOURCE_REPO: ROOT_DIR,
      },
    },
  );
}

main();
