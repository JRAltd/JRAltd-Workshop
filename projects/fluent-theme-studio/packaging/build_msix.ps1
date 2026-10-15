# Build MSIX Package for Fluent Theme Studio
param(
    [string]$Version = "1.0.2.0"
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir
$SrcDir = Join-Path $ProjectDir "src"
$DistDir = Join-Path $ProjectDir "dist"
$OutputDir = Join-Path $ProjectDir "out"

Write-Host "==> 1. Building Windows 11 Theme Generator with PyInstaller..." -ForegroundColor Cyan
& python -m PyInstaller --noconfirm --onedir --windowed --name "Windows 11 Theme Generator" --add-data "$SrcDir/static;static" --icon "$SrcDir/static/favicon.ico" "$SrcDir/app.py"

Write-Host "==> 2. Preparing MSIX staging directory..." -ForegroundColor Cyan
$StagingDir = Join-Path $ProjectDir "build\MSIX_Staging"
if (Test-Path $StagingDir) { Remove-Item $StagingDir -Recurse -Force }
New-Item -ItemType Directory -Path $StagingDir -Force | Out-Null

# Copy base package assets
Copy-Item -Path (Join-Path $ScriptDir "Assets") -Destination (Join-Path $StagingDir "Assets") -Recurse
Copy-Item -Path (Join-Path $ScriptDir "Resources.pri") -Destination $StagingDir
Copy-Item -Path (Join-Path $ScriptDir "Registry.dat") -Destination $StagingDir
Copy-Item -Path (Join-Path $ScriptDir "User.dat") -Destination $StagingDir
Copy-Item -Path (Join-Path $ScriptDir "UserClasses.dat") -Destination $StagingDir

# Update manifest version if specified
$ManifestPath = Join-Path $ScriptDir "AppxManifest.xml"
[xml]$ManifestXml = Get-Content $ManifestPath
$ManifestXml.Package.Identity.Version = $Version
$ManifestXml.Save((Join-Path $StagingDir "AppxManifest.xml"))

# Copy built application to VFS
$VfsAppDir = Join-Path $StagingDir "VFS\UserProgramFiles\Windows 11 Theme Generator"
New-Item -ItemType Directory -Path $VfsAppDir -Force | Out-Null
Copy-Item -Path (Join-Path $DistDir "Windows 11 Theme Generator\*") -Destination $VfsAppDir -Recurse -Force

Write-Host "==> 3. Packing MSIX package..." -ForegroundColor Cyan
if (-not (Test-Path $OutputDir)) { New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null }
$MsixOutput = Join-Path $OutputDir "FluentThemeStudio_$Version`_x64.msix"

# Locate makeappx.exe
$MakeAppx = (Get-ChildItem -Path "$env:LOCALAPPDATA", "C:\Program Files\WindowsApps" -Filter "makeappx.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1).FullName
if (-not $MakeAppx) {
    throw "makeappx.exe not found. Ensure MSIX Packaging Tool or Windows SDK is installed."
}

& $MakeAppx pack /d $StagingDir /p $MsixOutput /o
Write-Host "`n[SUCCESS] Package generated at: $MsixOutput" -ForegroundColor Green
