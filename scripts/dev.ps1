# Q-Music 开发启动（兼容兜底，跨机器可用）
# 主路径：npm run dev
# 兜底：npm run dev:compat
#
# 故意不写死任何本机绝对路径（如 D:\Study\...、某台电脑的 Cursor 目录）。
# 只从：环境变量 → PATH → 常见版本管理器相对用户目录 中查找 Node。
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Test-NodeVersion([string]$exe, [int]$minMajor = 18) {
  if (-not $exe -or -not (Test-Path -LiteralPath $exe)) { return $false }
  $ver = & $exe -p "process.versions.node" 2>$null
  if ($ver -match '^(\d+)') { return [int]$Matches[1] -ge $minMajor }
  return $false
}

$candidates = New-Object System.Collections.Generic.List[string]

# 1) 用户显式指定（任意机器可设）
if ($env:QMUSIC_NODE) { [void]$candidates.Add($env:QMUSIC_NODE) }

# 2) 当前 PATH 中的 node（最可移植）
$cmd = Get-Command node -ErrorAction SilentlyContinue
if ($cmd -and $cmd.Source) { [void]$candidates.Add($cmd.Source) }

# 3) 常见版本管理器：相对用户主目录，不绑死盘符/用户名
$home = if ($env:USERPROFILE) { $env:USERPROFILE } else { $env:HOME }
if ($home) {
  @(
    (Join-Path $home '.nvmd\bin\node.exe'),
    (Join-Path $home '.nvm\nodejs\node.exe'),
    (Join-Path $home 'AppData\Roaming\nvm\nodejs\node.exe'),
    (Join-Path $home '.fnm\current\node.exe'),
    (Join-Path $home '.local\share\fnm\aliases\default\bin\node')
  ) | ForEach-Object { [void]$candidates.Add($_) }
}

# 4) Cursor 自带 Node：仅用环境变量拼相对路径，无写死盘符
#    若本机未装 Cursor，自然跳过
if ($env:LOCALAPPDATA) {
  [void]$candidates.Add((Join-Path $env:LOCALAPPDATA 'Programs\cursor\resources\app\resources\helpers\node.exe'))
}
if ($env:CURSOR_HELPER_NODE) {
  [void]$candidates.Add($env:CURSOR_HELPER_NODE)
}

$node = $null
foreach ($c in $candidates) {
  if (Test-NodeVersion $c 18) {
    $node = $c
    break
  }
}

if (-not $node) {
  Write-Error @"
未找到 Node.js >= 18。
请在本机安装 Node（推荐 24，见 .node-version），确保 node 在 PATH 中；
或设置环境变量 QMUSIC_NODE 指向可用的 node 可执行文件。
主开发请使用：npm run dev
"@
}

Write-Host "[compat] Using Node: $node ($(& $node -v))"
$vite = Join-Path $root 'node_modules\vite\bin\vite.js'
if (-not (Test-Path -LiteralPath $vite)) {
  Write-Error "未找到 $vite ，请先在项目目录执行 npm install"
}
& $node $vite @args
