# 以指定作者提交（不依赖全局 git config，避免 Agent 身份写入）
param([string]$Message)

$ErrorActionPreference = 'Stop'
if (-not $Message) {
  throw 'Usage: git-commit.ps1 -Message "commit message"'
}

$AuthorName = 'XQ-rxslcq'
$AuthorEmail = '3584002913@qq.com'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$env:GIT_AUTHOR_NAME = $AuthorName
$env:GIT_AUTHOR_EMAIL = $AuthorEmail
$env:GIT_COMMITTER_NAME = $AuthorName
$env:GIT_COMMITTER_EMAIL = $AuthorEmail

$msgFile = [System.IO.Path]::GetTempFileName()
$utf8 = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($msgFile, $Message, $utf8)

git add -A
git commit -F $msgFile --no-gpg-sign
if ($LASTEXITCODE -ne 0) {
  Remove-Item -Force $msgFile -ErrorAction SilentlyContinue
  exit $LASTEXITCODE
}

git commit --amend -F $msgFile --no-gpg-sign
Remove-Item -Force $msgFile -ErrorAction SilentlyContinue
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Committed as $AuthorName <$AuthorEmail>"
git log -1 --format='%h %an <%ae> %s'
