#!/usr/bin/env bash

set -euo pipefail

INPUT_DIR="${1:-}"
TAG="${2:-}"

if [[ -z "$INPUT_DIR" || -z "$TAG" ]]; then
  echo "Usage: scripts/upload-updater-assets.sh <input-dir> <tag>" >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
INPUT_DIR="$(cd "$INPUT_DIR" && pwd)"
BASE_URL="${UPDATE_BASE_URL:-http://66.42.97.41/research-copilot-updates}"
SERVER_HOST="${UPDATE_SERVER_HOST:-66.42.97.41}"
SERVER_PORT="${UPDATE_SERVER_PORT:-22}"
SERVER_USER="${UPDATE_SERVER_USER:-root}"
SERVER_PATH="${UPDATE_SERVER_PATH:-/var/www/html/research-copilot-updates}"
SSH_KEY="${UPDATE_SERVER_SSH_KEY:-$HOME/.ssh/research-copilot-update-server}"

node "$ROOT_DIR/scripts/prepare-updater-assets.mjs" \
  --input-dir "$INPUT_DIR" \
  --base-url "${BASE_URL%/}/${TAG}" \
  --output "$INPUT_DIR/latest.json"

mkdir -p "$HOME/.ssh"
ssh-keyscan -p "$SERVER_PORT" -H "$SERVER_HOST" >> "$HOME/.ssh/known_hosts" 2>/dev/null || true

remote_root="${SERVER_PATH%/}"
remote_tag_dir="${remote_root}/${TAG}"

ssh -i "$SSH_KEY" -p "$SERVER_PORT" "$SERVER_USER@$SERVER_HOST" "mkdir -p '$remote_tag_dir'"
rsync -av \
  --chmod=Du=rwx,Dgo=rx,Fu=rw,Fgo=r \
  -e "ssh -i $SSH_KEY -p $SERVER_PORT" \
  "$INPUT_DIR/" \
  "$SERVER_USER@$SERVER_HOST:$remote_tag_dir/"
ssh -i "$SSH_KEY" -p "$SERVER_PORT" "$SERVER_USER@$SERVER_HOST" \
  "chown -R root:root '$remote_tag_dir' && chmod -R a+rX '$remote_tag_dir'"
scp -i "$SSH_KEY" -P "$SERVER_PORT" \
  "$INPUT_DIR/latest.json" \
  "$SERVER_USER@$SERVER_HOST:$remote_root/latest.json"
ssh -i "$SSH_KEY" -p "$SERVER_PORT" "$SERVER_USER@$SERVER_HOST" \
  "chown root:root '$remote_root/latest.json' && chmod a+r '$remote_root/latest.json'"

echo "Uploaded updater assets to ${BASE_URL%/}/${TAG}"
