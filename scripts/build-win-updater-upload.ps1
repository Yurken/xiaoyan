param(
  [Parameter(Mandatory = $false)]
  [string]$Version = $env:RELEASE_TAG,
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$ExtraArgs
)

$ErrorActionPreference = "Stop"

function Invoke-CheckedNative {
  param(
    [Parameter(Mandatory = $true)]
    [string]$FilePath,
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Arguments
  )

  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed with exit code ${LASTEXITCODE}: $FilePath $($Arguments -join ' ')"
  }
}

if ($Version -eq "--" -and $ExtraArgs.Count -gt 0) {
  $Version = $ExtraArgs[0]
}

if ([string]::IsNullOrWhiteSpace($Version)) {
  throw "Usage: powershell -ExecutionPolicy Bypass -File scripts/build-win-updater-upload.ps1 <version-or-tag>"
}

$RootDir = Split-Path -Parent $PSScriptRoot
$VersionTag = if ($Version.StartsWith("v")) { $Version } else { "v$Version" }
$DefaultKeyPath = Join-Path $HOME ".tauri/research-copilot-updater.key"
$DefaultKeyPasswordPath = "$DefaultKeyPath.password"

if (-not $env:TAURI_SIGNING_PRIVATE_KEY) {
  if (Test-Path $DefaultKeyPath) {
    $env:TAURI_SIGNING_PRIVATE_KEY = Get-Content $DefaultKeyPath -Raw
  }
}

if (-not $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD -and (Test-Path $DefaultKeyPasswordPath)) {
  $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = (Get-Content $DefaultKeyPasswordPath -Raw).Trim()
}

if (-not $env:TAURI_SIGNING_PRIVATE_KEY) {
  throw @"
Missing updater signing key.

Use the existing release key for updates that must be accepted by already installed clients:
  `$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content <path-to-existing-key> -Raw
  `$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ""

Or place the existing key at:
  $DefaultKeyPath

If the key has a password, set TAURI_SIGNING_PRIVATE_KEY_PASSWORD or put the password in:
  $DefaultKeyPasswordPath

Only generate a new key if you intend to start a new updater trust chain:
  pnpm tauri signer generate -w "$DefaultKeyPath"

After generating a new key, copy its public key into apps/desktop/src-tauri/tauri.conf.json -> plugins.updater.pubkey before building.
"@
}

$PlatformKey = if ($env:UPDATER_PLATFORM_KEY) { $env:UPDATER_PLATFORM_KEY } else { "windows-x86_64" }
$WindowsBundles = if ($env:TAURI_WINDOWS_BUNDLES) { $env:TAURI_WINDOWS_BUNDLES } else { "msi" }

Set-Location $RootDir
Invoke-CheckedNative node scripts/sync-version.mjs --tag $VersionTag
Invoke-CheckedNative pnpm --dir apps/desktop run tauri build --bundles $WindowsBundles --ci

$BundleDir = "apps/desktop/src-tauri/target/release/bundle"
$OutputDir = "upload/$VersionTag"

Invoke-CheckedNative node scripts/collect-platform-updater-assets.mjs `
  --input-dir $BundleDir `
  --output-dir $OutputDir `
  --platform $PlatformKey `
  --version $VersionTag

Invoke-CheckedNative node scripts/upload-updater-via-admin.mjs `
  --input-dir $OutputDir `
  --version $VersionTag

Write-Host "Windows updater build and upload completed for $VersionTag"
