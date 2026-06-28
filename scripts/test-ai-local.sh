#!/usr/bin/env bash
# 本地手动 AI 联通测试（macOS / Linux）。
#
# 复用本地数据库（开发者在 App 设置里填好的 API）做一次真实对话请求。
# 这些用例标了 #[ignore]，不进流水线；此脚本用 --ignored 显式触发。
# 全程只读数据库，不写入任何数据。
#
# 用法：
#   bash scripts/test-ai-local.sh
#   RC_DB_PATH=/abs/path/research_copilot.db bash scripts/test-ai-local.sh   # 自定义数据库位置
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MANIFEST="$REPO_ROOT/apps/desktop/src-tauri/Cargo.toml"

echo "==> 本地 AI 联通测试（真实调用，复用本地数据库 API 配置）"
echo "==> 数据库：${RC_DB_PATH:-${RC_DB_DIR:-自动定位（com.researchcopilot.desktop）}}"

# 先只读校验配置是否完整，再发真实请求；--nocapture 打印模型回复。
cargo test --manifest-path "$MANIFEST" --lib -- --ignored --nocapture ai_live
