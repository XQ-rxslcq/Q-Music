# Q-Music 全局快捷键多方法探测
#
# 重要限制（请先读）：
#   SendKeys / keybd_event / SendInput 都是「合成输入」，会绕过中文输入法选词。
#   它们 **不能** 证明「人手按 Ctrl+数字 + 微软拼音开启」时是否可用。
#   本脚本只验证：注册、合成触发、打包应用 hotkey:fire 日志。
#
# 用法（项目根）：
#   powershell -File .\scripts\test-hotkeys-e2e.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$electron = Join-Path $root 'node_modules\electron\dist\electron.exe'
if (-not (Test-Path $electron)) { throw "electron.exe not found" }

Get-Process electron, 'Q-Music' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

function Invoke-SendInputChord([int[]]$vkDownUp) {
  # vkDownUp: sequence of VKs to press then release in reverse
  Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class QmHkSend {
  [StructLayout(LayoutKind.Sequential)] public struct KEYBDINPUT {
    public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public IntPtr dwExtraInfo;
  }
  [StructLayout(LayoutKind.Explicit)] public struct INPUT {
    [FieldOffset(0)] public int type;
    [FieldOffset(8)] public KEYBDINPUT ki;
  }
  [DllImport("user32.dll", SetLastError=true)]
  public static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);
  const uint KEYUP = 0x0002;
  public static void Chord(ushort[] keys) {
    var downs = new INPUT[keys.Length];
    for (int i = 0; i < keys.Length; i++) {
      downs[i].type = 1; downs[i].ki.wVk = keys[i];
    }
    SendInput((uint)downs.Length, downs, Marshal.SizeOf(typeof(INPUT)));
    var ups = new INPUT[keys.Length];
    for (int i = 0; i < keys.Length; i++) {
      ushort vk = keys[keys.Length - 1 - i];
      ups[i].type = 1; ups[i].ki.wVk = vk; ups[i].ki.dwFlags = KEYUP;
    }
    SendInput((uint)ups.Length, ups, Marshal.SizeOf(typeof(INPUT)));
  }
}
"@ -ErrorAction SilentlyContinue
  $keys = [UInt16[]]@($vkDownUp | ForEach-Object { [UInt16]$_ })
  [QmHkSend]::Chord($keys)
}

Write-Host '=== 1) Register matrix (defaults + Ctrl+digit) ==='
$regScript = Join-Path $env:TEMP 'qmusic-hk-reg.mjs'
@'
import { app, globalShortcut } from "electron";
const list = [
  "CommandOrControl+Alt+Space","CommandOrControl+Alt+Left","CommandOrControl+Alt+Right",
  "CommandOrControl+Alt+Up","CommandOrControl+Alt+Down","CommandOrControl+Alt+[",
  "CommandOrControl+Alt+]","CommandOrControl+Alt+D","CommandOrControl+Alt+L",
  "CommandOrControl+Alt+Shift+Q","CommandOrControl+Alt+7","CommandOrControl+7",
  "CommandOrControl+Alt+Shift+F9"
];
app.whenReady().then(() => {
  let fail = 0;
  for (const a of list) {
    let ok = false;
    try { ok = globalShortcut.register(a, () => {}); } catch { ok = false; }
    console.log(`REG ${ok ? "OK" : "FAIL"} ${a}`);
    if (!ok) fail++;
    try { globalShortcut.unregister(a); } catch {}
  }
  console.log(fail === 0 ? "REG_MATRIX_OK" : "REG_MATRIX_FAIL");
  app.quit();
});
'@ | Set-Content -Path $regScript -Encoding UTF8
$regOut = & $electron $regScript 2>&1 | ForEach-Object { "$_" }
$regOut | Out-Host
$regText = $regOut -join "`n"
if ($regText -notmatch 'REG_MATRIX_OK') { throw 'Register matrix failed' }

Write-Host '=== 2) Synthetic fire: SendKeys / keybd_event / SendInput (Ctrl+Alt+Shift+F9) ==='
$methods = @('SendKeys', 'keybd_event', 'SendInput')
foreach ($method in $methods) {
  Get-Process electron -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep 1
  $env:QMUSIC_PROBE_SECONDS = '10'
  $env:QMUSIC_PROBE_ACCEL = 'CommandOrControl+Alt+Shift+F9'
  $env:QMUSIC_PROBE_SECOND = '0'
  $out = Join-Path $env:TEMP "qmusic-hk-e2e-$method-out.log"
  $err = Join-Path $env:TEMP "qmusic-hk-e2e-$method-err.log"
  Remove-Item $out, $err -Force -ErrorAction SilentlyContinue
  $p = Start-Process -FilePath $electron -ArgumentList @((Join-Path $root 'scripts\probe-global-hotkey.mjs')) `
    -WorkingDirectory $root -PassThru -RedirectStandardOutput $out -RedirectStandardError $err
  Start-Sleep 3
  if ($method -eq 'SendKeys') {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.SendKeys]::SendWait('^%+{F9}')
    Start-Sleep -Milliseconds 250
    [System.Windows.Forms.SendKeys]::SendWait('^%+{F9}')
  } elseif ($method -eq 'keybd_event') {
    Add-Type -TypeDefinition @"
using System; using System.Runtime.InteropServices;
public class QmKbe { [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
  public static void Go(){ keybd_event(0x11,0,0,UIntPtr.Zero); keybd_event(0x12,0,0,UIntPtr.Zero); keybd_event(0x10,0,0,UIntPtr.Zero); keybd_event(0x78,0,0,UIntPtr.Zero);
    keybd_event(0x78,0,2,UIntPtr.Zero); keybd_event(0x10,0,2,UIntPtr.Zero); keybd_event(0x12,0,2,UIntPtr.Zero); keybd_event(0x11,0,2,UIntPtr.Zero);} }
"@ -ErrorAction SilentlyContinue
    [QmKbe]::Go(); Start-Sleep -Milliseconds 250; [QmKbe]::Go()
  } else {
    Invoke-SendInputChord @(0x11, 0x12, 0x10, 0x78)
    Start-Sleep -Milliseconds 250
    Invoke-SendInputChord @(0x11, 0x12, 0x10, 0x78)
  }
  Wait-Process -Id $p.Id -Timeout 14 -ErrorAction SilentlyContinue
  Start-Sleep 1
  $hit = Select-String -Path $out, $err -Pattern 'HIT' -Quiet -ErrorAction SilentlyContinue
  Write-Host ("SYNTH {0}: {1}" -f $method, ($(if ($hit) { 'HIT_OK' } else { 'NO_HIT' })))
  if (-not $hit) { throw "Synthetic $method failed" }
}

Write-Host '=== 3) Packaged Q-Music: SendInput Ctrl+Alt+Shift+Q → hotkey:fire ==='
$distRoot = Join-Path $root 'dist'
$exe = $null
$log = $null
$latest = Get-ChildItem $distRoot -Directory -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -match '^\d+\.\d+\.\d+$' } |
  Sort-Object { [version]$_.Name } -Descending |
  Select-Object -First 1
if ($latest) {
  $cand = Join-Path $latest.FullName 'win-unpacked\Q-Music.exe'
  if (Test-Path $cand) {
    $exe = $cand
    $log = Join-Path $latest.FullName 'win-unpacked\qmdata\logs\main.log'
  }
}
if (-not $exe) {
  Write-Host 'SKIP packaged (exe missing)'
} else {
  # ensure qmdata + safe defaults beside exe
  $qm = Join-Path (Split-Path $exe) 'qmdata'
  if (-not (Test-Path $qm)) {
    New-Item -ItemType Directory -Path $qm -Force | Out-Null
  }
  $hk = Join-Path $qm 'hotkeys.json'
  if (-not (Test-Path $hk)) {
    Copy-Item (Join-Path $root 'qmdata\hotkeys.json') $hk -Force -ErrorAction SilentlyContinue
  }
  Get-Process 'Q-Music' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep 1
  $marker = "[e2e-marker] $(Get-Date -Format o)"
  New-Item -ItemType Directory -Path (Split-Path $log) -Force | Out-Null
  Add-Content -Path $log -Value $marker
  $null = Start-Process -FilePath $exe -PassThru
  # 等到主进程写完注册日志（最多 20s），避免过早注入
  $ready = $false
  for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 500
    if (-not (Test-Path $log)) { continue }
    $chunk = Get-Content $log -Raw -ErrorAction SilentlyContinue
    if ($chunk -and $chunk.Contains($marker) -and $chunk -match 'hotkeys:registered') {
      $ready = $true
      break
    }
  }
  if (-not $ready) { throw 'Packaged app did not register hotkeys in time' }
  Start-Sleep 1
  Add-Type -AssemblyName System.Windows.Forms
  [System.Windows.Forms.SendKeys]::SendWait('^%+q')
  Start-Sleep -Milliseconds 400
  [System.Windows.Forms.SendKeys]::SendWait('^%+q')
  Start-Sleep 1
  Invoke-SendInputChord @(0x11, 0x12, 0x10, 0x51)
  Start-Sleep 2
  $after = Get-Content $log -Raw -ErrorAction SilentlyContinue
  $idx = $after.LastIndexOf($marker)
  $tail = if ($idx -ge 0) { $after.Substring($idx) } else { $after }
  $fire = $tail -match 'hotkey:fire show-main'
  Write-Host ("PACKAGED_FIRE ({0}): {1}" -f $latest.Name, ($(if ($fire) { 'OK' } else { 'NO_FIRE' })))
  Get-Process 'Q-Music' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  if (-not $fire) {
    Write-Host '--- log after marker ---'
    $tail
    throw 'Packaged hotkey:fire not seen'
  }
}

Write-Host ''
Write-Host 'VERDICT: SYNTHETIC_PATH_OK'
Write-Host 'LIMIT: Cannot auto-verify physical keyboard + Chinese IME interception.'
Write-Host 'IME_HOSTILE: bare Ctrl+digit is marked 不可使用 in app (heuristic), even if register returns true.'
exit 0
