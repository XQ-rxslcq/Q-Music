# 回归测试：在任意机器项目根执行
#   npm test
# 或：
#   powershell -File scripts/run-regression.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$cmd = Get-Command npm -ErrorAction SilentlyContinue
if (-not $cmd) {
  Write-Error "需要 npm（Node >= 18）。请先安装 Node 并加入 PATH。"
}

Write-Host "==> Q-Music regression: vitest run"
npm test
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "==> OK: all regression tests passed"
