param(
  [Parameter(Mandatory = $false)]
  [string]$Version = $env:RELEASE_TAG,
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$ExtraArgs
)

$ErrorActionPreference = "Stop"

if ($Version -eq "--" -and $ExtraArgs.Count -gt 0) {
  $Version = $ExtraArgs[0]
}

if ([string]::IsNullOrWhiteSpace($Version)) {
  throw "Usage: powershell -ExecutionPolicy Bypass -File scripts/build-win-updater-upload.ps1 <version-or-tag>"
}

$RootDir = Split-Path -Parent $PSScriptRoot
$VersionTag = if ($Version.StartsWith("v")) { $Version } else { "v$Version" }

if (-not $env:TAURI_SIGNING_PRIVATE_KEY) {
  $DefaultKeyPath = Join-Path $HOME ".tauri/research-copilot-updater.key"
  if (Test-Path $DefaultKeyPath) {
    $env:TAURI_SIGNING_PRIVATE_KEY = Get-Content $DefaultKeyPath -Raw
  }
}

if (-not $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD) {
  $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ""
}

$PlatformKey = if ($env:UPDATER_PLATFORM_KEY) { $env:UPDATER_PLATFORM_KEY } else { "windows-x86_64" }

Set-Location $RootDir
node scripts/sync-version.mjs --tag $VersionTag
pnpm --dir apps/desktop exec tauri build

$BundleDir = "apps/desktop/src-tauri/target/release/bundle"
$OutputDir = "upload/$VersionTag"

node scripts/collect-platform-updater-assets.mjs `
  --input-dir $BundleDir `
  --output-dir $OutputDir `
  --platform $PlatformKey `
  --version $VersionTag

node scripts/upload-updater-via-admin.mjs `
  --input-dir $OutputDir `
  --version $VersionTag

Write-Host "Windows updater build and upload completed for $VersionTag"
