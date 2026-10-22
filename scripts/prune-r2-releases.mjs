#!/usr/bin/env node

// Keeps Cloudflare R2 at the newest N released versions instead of growing
// forever. The desktop release workflow writes this layout:
//
//   releases/<tag>/<target>/<installer>          (dmg / msi / exe / AppImage / deb / rpm)
//   updaters/<tag>/<target>/<bundle>             (updater bundle + .sig)
//   releases/latest.json, releases/<tag>/latest.json
//   updaters/latest.json, updaters/<tag>/latest.json
//
// Only tag-scoped keys are eligible for deletion. Root `latest.json` files,
// unrecognised keys, and every tag newer than `--current-tag` stay untouched:
// a newer tag may still be uploading from a parallel workflow run, and the
// landing page always links the newest three versions from R2.
//
// Dry-run by default; pass --apply to actually delete objects.

import { spawnSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_KEEP = 3;
const SCOPES = ["releases/", "updaters/"];
const VERSION_PATTERN = /^v(\d+)\.(\d+)\.(\d+)(?:\.(\d+))?(?:[-+]([0-9A-Za-z.-]+))?$/;
const TAG_KEY_PATTERN =
  /^(?:releases|updaters)\/(v\d+\.\d+\.\d+(?:\.\d+)?(?:[-+][0-9A-Za-z.-]+)?)\//;

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

function requireArg(flag) {
  const value = getArg(flag).trim();
  if (!value) {
    throw new Error(`Missing required argument: ${flag}`);
  }
  return value;
}

function printHelp() {
  console.log(`Usage:
  node scripts/prune-r2-releases.mjs --bucket BUCKET --current-tag v0.5.3 [--keep 3] [--apply]

Deletes R2 objects of releases outside the newest \`--keep\` versions. Without
\`--apply\` it only prints the plan, which is also usable locally against a
saved listing:

  node scripts/prune-r2-releases.mjs --objects-file listing.json --current-tag v0.5.3

Flags:
  --bucket NAME        R2 bucket name (required unless --objects-file)
  --current-tag TAG    Tag that was just published; always retained
  --keep N             Versions to retain including the current one (default ${DEFAULT_KEEP})
  --objects-file PATH  Read keys (JSON array or {"Contents":[...]}) instead of listing R2
  --endpoint-url URL   S3 endpoint; falls back to AWS_ENDPOINT_URL
  --apply              Perform deletions; default is a dry run
`);
}

function parseVersion(tag) {
  const match = VERSION_PATTERN.exec(tag);
  if (!match) {
    return null;
  }
  return {
    numbers: [Number(match[1]), Number(match[2]), Number(match[3]), match[4] ? Number(match[4]) : 0],
    prerelease: match[5] ?? "",
  };
}

function compareVersions(left, right) {
  for (let index = 0; index < left.numbers.length; index += 1) {
    if (left.numbers[index] !== right.numbers[index]) {
      return left.numbers[index] - right.numbers[index];
    }
  }
  if (left.prerelease === right.prerelease) {
    return 0;
  }
  // A release outranks its own prereleases.
  if (!left.prerelease) {
    return 1;
  }
  if (!right.prerelease) {
    return -1;
  }
  return left.prerelease.localeCompare(right.prerelease);
}

function tagOfKey(key) {
  const match = TAG_KEY_PATTERN.exec(key);
  return match ? match[1] : "";
}

function groupByTag(keys) {
  const groups = new Map();
  for (const key of keys) {
    const tag = tagOfKey(key);
    if (!tag) {
      continue;
    }
    if (!groups.has(tag)) {
      groups.set(tag, []);
    }
    groups.get(tag).push(key);
  }
  return groups;
}

/**
 * Pure retention decision so the policy can be checked without touching R2.
 * Retains `currentTag` plus the newest older tags, and refuses to return a
 * deletion plan when the current release is missing from the listing.
 */
export function planRetention(keys, currentTag, keep) {
  const currentVersion = parseVersion(currentTag);
  if (!currentVersion) {
    throw new Error(`Invalid --current-tag: ${currentTag}`);
  }
  const groups = groupByTag(keys);
  const currentKeys = groups.get(currentTag) ?? [];
  if (!currentKeys.some((key) => key.startsWith(`releases/${currentTag}/`))) {
    throw new Error(
      `No releases/${currentTag}/ objects found in R2; refusing to prune old versions`,
    );
  }

  const retained = [currentTag];
  const olderTags = [...groups.keys()]
    .filter((tag) => tag !== currentTag)
    .map((tag) => ({ tag, version: parseVersion(tag) }))
    .filter((entry) => entry.version && compareVersions(entry.version, currentVersion) < 0)
    .sort(
      (left, right) =>
        compareVersions(right.version, left.version) || right.tag.localeCompare(left.tag),
    );

  for (const entry of olderTags) {
    if (retained.length >= keep) {
      break;
    }
    retained.push(entry.tag);
  }

  const retainedSet = new Set(retained);
  const obsoleteTags = [...groups.keys()].filter((tag) => {
    if (retainedSet.has(tag)) {
      return false;
    }
    const version = parseVersion(tag);
    // Unparsable tags and newer-than-current tags are never deleted.
    return Boolean(version) && compareVersions(version, currentVersion) < 0;
  });
  const obsoleteSet = new Set(obsoleteTags);
  const obsoleteKeys = [...groups.entries()]
    .filter(([tag]) => obsoleteSet.has(tag))
    .flatMap(([, taggedKeys]) => taggedKeys)
    .sort();

  return { retained, obsoleteTags: obsoleteTags.sort(), obsoleteKeys };
}

function runAws(args) {
  const result = spawnSync("aws", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  if (result.error) {
    throw new Error(`Failed to run aws: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`aws ${args[0]} ${args[1] ?? ""} failed: ${(result.stderr || result.stdout).trim()}`);
  }
  return result.stdout;
}

function listKeys(bucket, prefix, endpointUrl) {
  const keys = [];
  let token = "";
  for (;;) {
    const args = [
      "s3api",
      "list-objects-v2",
      "--bucket",
      bucket,
      "--prefix",
      prefix,
      "--output",
      "json",
    ];
    if (endpointUrl) {
      args.push("--endpoint-url", endpointUrl);
    }
    if (token) {
      args.push("--continuation-token", token);
    }
    const payload = JSON.parse(runAws(args) || "{}");
    for (const item of payload.Contents ?? []) {
      keys.push(item.Key);
    }
    if (!payload.IsTruncated || !payload.NextContinuationToken) {
      return keys;
    }
    token = payload.NextContinuationToken;
  }
}

function readKeysFile(filePath) {
  const payload = JSON.parse(readFileSync(path.resolve(filePath), "utf8"));
  const entries = Array.isArray(payload) ? payload : (payload.Contents ?? payload.keys ?? []);
  return entries.map((entry) => (typeof entry === "string" ? entry : entry.Key)).filter(Boolean);
}

function deleteKeys(bucket, keys, endpointUrl) {
  for (let offset = 0; offset < keys.length; offset += 1000) {
    const batch = keys.slice(offset, offset + 1000).map((key) => ({ Key: key }));
    const batchFile = path.join(os.tmpdir(), `xiaoyan-r2-prune-${process.pid}-${offset}.json`);
    writeFileSync(batchFile, JSON.stringify({ Objects: batch, Quiet: true }), "utf8");
    const args = [
      "s3api",
      "delete-objects",
      "--bucket",
      bucket,
      "--delete",
      `file://${batchFile.split(path.sep).join("/")}`,
      "--output",
      "json",
    ];
    if (endpointUrl) {
      args.push("--endpoint-url", endpointUrl);
    }
    try {
      const payload = JSON.parse(runAws(args) || "{}");
      if ((payload.Errors ?? []).length > 0) {
        const sample = payload.Errors.slice(0, 5)
          .map((error) => `${error.Key}: ${error.Code ?? "error"}`)
          .join(", ");
        throw new Error(`R2 retention deletion failed for ${payload.Errors.length} object(s): ${sample}`);
      }
    } finally {
      rmSync(batchFile, { force: true });
    }
  }
}

function main() {
  if (hasFlag("--help") || hasFlag("-h")) {
    printHelp();
    return;
  }

  const keep = Number(getArg("--keep").trim() || DEFAULT_KEEP);
  if (!Number.isInteger(keep) || keep < 1) {
    throw new Error("--keep must be a positive integer");
  }

  const currentTag = requireArg("--current-tag");
  const bucket = getArg("--bucket").trim();
  const objectsFile = getArg("--objects-file").trim();
  const endpointUrl = (getArg("--endpoint-url") || process.env.AWS_ENDPOINT_URL || "").trim();
  const shouldApply = hasFlag("--apply");

  if (!bucket && !objectsFile) {
    throw new Error("Missing --bucket (or --objects-file for an offline plan)");
  }
  if (shouldApply && !bucket) {
    throw new Error("--apply requires --bucket");
  }

  const keys = objectsFile
    ? readKeysFile(objectsFile)
    : SCOPES.flatMap((prefix) => listKeys(bucket, prefix, endpointUrl));

  const { retained, obsoleteTags, obsoleteKeys } = planRetention(keys, currentTag, keep);

  console.log(`R2 tag-scoped objects: ${keys.filter((key) => tagOfKey(key)).length}`);
  console.log(`Retained versions (${retained.length}/${keep}): ${retained.join(", ")}`);
  if (obsoleteKeys.length === 0) {
    console.log("Nothing to prune");
    return;
  }
  console.log(`Obsolete versions: ${obsoleteTags.join(", ")}`);
  console.log(`Objects to delete: ${obsoleteKeys.length}`);
  for (const key of obsoleteKeys.slice(0, 20)) {
    console.log(`- ${key}`);
  }
  if (obsoleteKeys.length > 20) {
    console.log(`- ...and ${obsoleteKeys.length - 20} more`);
  }
  if (!shouldApply) {
    console.log("Dry run; pass --apply to delete these objects");
    return;
  }
  deleteKeys(bucket, obsoleteKeys, endpointUrl);
  console.log(`Deleted ${obsoleteKeys.length} object(s) from R2`);
}

// Only run when invoked directly so the retention policy stays importable.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
