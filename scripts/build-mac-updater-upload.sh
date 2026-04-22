#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

if [[ "${1:-}" == "--" ]]; then
  shift
fi

VERSION_INPUT="${1:-${RELEASE_TAG:-}}"

if [[ -z "$VERSION_INPUT" ]]; then
  echo "Usage: scripts/build-mac-updater-upload.sh <version-or-tag>" >&2
  exit 1
fi

VERSION="${VERSION_INPUT#v}"
VERSION_TAG="v${VERSION}"

if [[ -z "${TAURI_SIGNING_PRIVATE_KEY:-}" && -f "$HOME/.tauri/research-copilot-updater.key" ]]; then
  export TAURI_SIGNING_PRIVATE_KEY
  TAURI_SIGNING_PRIVATE_KEY="$(cat "$HOME/.tauri/research-copilot-updater.key")"
fi

export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="${TAURI_SIGNING_PRIVATE_KEY_PASSWORD:-}"

ARCH="$(uname -m)"
TARGET="${TAURI_BUILD_TARGET:-}"
PLATFORM_KEY="${UPDATER_PLATFORM_KEY:-}"

if [[ -z "$TARGET" ]]; then
  case "$ARCH" in
    arm64)
      TARGET="aarch64-apple-darwin"
      ;;
    x86_64)
      TARGET="x86_64-apple-darwin"
      ;;
    *)
      echo "Unsupported macOS architecture: $ARCH" >&2
      exit 1
      ;;
  esac
fi

if [[ -z "$PLATFORM_KEY" ]]; then
  case "$TARGET" in
    aarch64-apple-darwin)
      PLATFORM_KEY="darwin-aarch64"
      ;;
    x86_64-apple-darwin)
      PLATFORM_KEY="darwin-x86_64"
      ;;
    *)
      echo "Unsupported TAURI_BUILD_TARGET for macOS uploader: $TARGET" >&2
      exit 1
      ;;
  esac
fi

cd "$ROOT_DIR"
node scripts/sync-version.mjs --tag "$VERSION_TAG"
pnpm --dir apps/desktop exec tauri build --target "$TARGET"

BUNDLE_DIR="apps/desktop/src-tauri/target/${TARGET}/release/bundle"
OUTPUT_DIR="upload/${VERSION_TAG}"

node scripts/collect-platform-updater-assets.mjs \
  --input-dir "$BUNDLE_DIR" \
  --output-dir "$OUTPUT_DIR" \
  --platform "$PLATFORM_KEY" \
  --version "$VERSION_TAG"

node scripts/upload-updater-via-admin.mjs \
  --input-dir "$OUTPUT_DIR" \
  --version "$VERSION_TAG"

echo "Mac updater build and upload completed for ${VERSION_TAG}"
