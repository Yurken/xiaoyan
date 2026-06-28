# 本地手动 AI 联通测试（Windows / PowerShell）。
#
# 复用本地数据库（开发者在 App 设置里填好的 API）做一次真实对话请求。
# 这些用例标了 #[ignore]，不进流水线；此脚本用 --ignored 显式触发。
# 全程只读数据库，不写入任何数据。
#
# 用法：
#   pwsh scripts/test-ai-local.ps1
#   $env:RC_DB_PATH = "C:\path\research_copilot.db"; pwsh scripts/test-ai-local.ps1
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$Manifest = Join-Path $RepoRoot "apps/desktop/src-tauri/Cargo.toml"

Write-Host "==> 本地 AI 联通测试（真实调用，复用本地数据库 API 配置）"
$dbHint = if ($env:RC_DB_PATH) { $env:RC_DB_PATH } elseif ($env:RC_DB_DIR) { $env:RC_DB_DIR } else { "自动定位（com.researchcopilot.desktop）" }
Write-Host "==> 数据库：$dbHint"

cargo test --manifest-path $Manifest --lib -- --ignored --nocapture ai_live
