# 在探测窗口存活期间用 SendKeys 模拟 Ctrl+Alt+Shift+F9
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$env:QMUSIC_PROBE_SECONDS = '12'
$env:QMUSIC_PROBE_SECOND = '0'
$env:QMUSIC_PROBE_ACCEL = 'CommandOrControl+Alt+Shift+F9'

Get-Process electron -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

$electron = Join-Path $root 'node_modules\electron\dist\electron.exe'
if (-not (Test-Path $electron)) { throw "electron.exe not found: $electron" }

$out = Join-Path $env:TEMP 'qmusic-hk-out.log'
$err = Join-Path $env:TEMP 'qmusic-hk-err.log'
Remove-Item $out, $err -Force -ErrorAction SilentlyContinue

$p = Start-Process -FilePath $electron `
  -ArgumentList @((Join-Path $root 'scripts\probe-global-hotkey.mjs')) `
  -WorkingDirectory $root -PassThru `
  -RedirectStandardOutput $out -RedirectStandardError $err

Start-Sleep -Seconds 3
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::SendWait('^%+{F9}')
Start-Sleep -Milliseconds 400
[System.Windows.Forms.SendKeys]::SendWait('^%+{F9}')

Wait-Process -Id $p.Id -Timeout 18 -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

Write-Host '===== probe log ====='
Get-Content $out, $err -ErrorAction SilentlyContinue
Write-Host '===== end ====='

if (Select-String -Path $out, $err -Pattern 'HIT' -Quiet -ErrorAction SilentlyContinue) {
  Write-Host 'VERDICT: GLOBAL_CALLBACK_OK'
  exit 0
}
if (Select-String -Path $out, $err -Pattern 'register .+ OK' -Quiet -ErrorAction SilentlyContinue) {
  Write-Host 'VERDICT: REGISTER_OK_BUT_NO_CALLBACK'
  exit 2
}
Write-Host 'VERDICT: REGISTER_FAILED_OR_NO_LOG'
exit 1
