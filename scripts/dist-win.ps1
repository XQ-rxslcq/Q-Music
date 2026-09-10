# 按 package.json 版本输出到 dist/<version>/
# 产物：win-unpacked/、便携包 *-portable.exe、安装包 *-setup.exe（可选安装路径）
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

# portable + nsis（nsis 安装的就是 win-unpacked 那套目录内容）
npx electron-builder --win portable nsis --config electron-builder.yml --config.directories.output="dist/$ver"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Done: $outDir"
Write-Host "  win-unpacked/              免安装目录（可直接运行）"
Write-Host "  Q-Music-$ver-portable.exe  便携单文件"
Write-Host "  Q-Music-$ver-setup.exe     安装包（可选路径；默认数据在安装目录/qmdata）"
Get-ChildItem $outDir | Format-Table Name, Length, LastWriteTime
