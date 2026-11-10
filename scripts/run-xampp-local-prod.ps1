# Build + run production Next.js against XAMPP MySQL (Windows).
# Usage (from project root):
#   powershell -ExecutionPolicy Bypass -File scripts/run-xampp-local-prod.ps1
#   powershell -ExecutionPolicy Bypass -File scripts/run-xampp-local-prod.ps1 -SkipBuild

param(
  [switch]$SkipBuild,
  [int]$Port = 3000
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

$xamppMysql = "C:\xampp\mysql\bin\mysqld.exe"
if (Test-Path $xamppMysql) {
  Write-Host "XAMPP found at C:\xampp"
} else {
  Write-Host "XAMPP not at C:\xampp — ensure MySQL is running (any install) before continuing."
}

Write-Host "Checking .env and MySQL ..."
node scripts/xampp-check-env.js
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if (-not $SkipBuild) {
  Write-Host "Building production bundle (same as live) ..."
  npm run build
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

$env:NODE_ENV = "production"
Write-Host ""
Write-Host "Starting Next.js on http://127.0.0.1:$Port"
Write-Host "Press Ctrl+C to stop."
Write-Host ""

& npx next start -H 127.0.0.1 -p $Port
