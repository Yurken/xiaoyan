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
DEFAULT_KEY_PATH="$HOME/.tauri/research-copilot-updater.key"
DEFAULT_KEY_PASSWORD_PATH="${DEFAULT_KEY_PATH}.password"

if [[ -z "${TAURI_SIGNING_PRIVATE_KEY:-}" && -f "$DEFAULT_KEY_PATH" ]]; then
  export TAURI_SIGNING_PRIVATE_KEY
  TAURI_SIGNING_PRIVATE_KEY="$(cat "$DEFAULT_KEY_PATH")"
fi

if [[ -z "${TAURI_SIGNING_PRIVATE_KEY_PASSWORD:-}" && -f "$DEFAULT_KEY_PASSWORD_PATH" ]]; then
  TAURI_SIGNING_PRIVATE_KEY_PASSWORD="$(tr -d '\r\n' < "$DEFAULT_KEY_PASSWORD_PATH")"
fi

export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="${TAURI_SIGNING_PRIVATE_KEY_PASSWORD:-}"

if [[ -z "${TAURI_SIGNING_PRIVATE_KEY:-}" ]]; then
  cat >&2 <<EOF
Missing updater signing key.

Use the existing release key for updates that must be accepted by already installed clients:
  export TAURI_SIGNING_PRIVATE_KEY="\$(cat <path-to-existing-key>)"
  export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""

Or place the existing key at:
  $DEFAULT_KEY_PATH

If the key has a password, set TAURI_SIGNING_PRIVATE_KEY_PASSWORD or put the password in:
  $DEFAULT_KEY_PASSWORD_PATH

Only generate a new key if you intend to start a new updater trust chain:
  pnpm tauri signer generate -w "$DEFAULT_KEY_PATH"

After generating a new key, copy its public key into apps/desktop/src-tauri/tauri.conf.json -> plugins.updater.pubkey before building.
EOF
  exit 1
fi

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
