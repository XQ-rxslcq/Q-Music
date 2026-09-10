# 按 package.json 版本输出到 dist/<version>/
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$pkg = Get-Content (Join-Path $root 'package.json') -Raw | ConvertFrom-Json
$ver = [string]$pkg.version
if (-not $ver) { throw 'package.json 缺少 version' }

$outDir = Join-Path $root "dist\$ver"
Write-Host "Q-Music dist → $outDir (version $ver)"

npm test
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

npx vite build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

New-Item -ItemType Directory -Force -Path $outDir | Out-Null

npx electron-builder --win portable --config electron-builder.yml --config.directories.output="dist/$ver"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Done: $outDir"
Get-ChildItem $outDir | Format-Table Name, Length, LastWriteTime
