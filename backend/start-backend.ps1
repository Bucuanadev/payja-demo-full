param()
$ErrorActionPreference = 'Stop'

Push-Location "$PSScriptRoot"

Write-Host "Building PayJA backend..." -ForegroundColor Cyan
npm run build | Out-String | Write-Verbose

if (!(Test-Path "$PSScriptRoot\dist\main.js")) {
  Write-Host "Build output not found (dist/main.js). Trying dev start..." -ForegroundColor Yellow
  npm run start:dev
  Pop-Location
  exit 0
}

Write-Host "Starting PayJA backend (PM2)..." -ForegroundColor Cyan
pm2 start "$PSScriptRoot\..\pm2.payja-backend.config.js" --only payja-backend --update-env | Out-Null
Start-Sleep -Seconds 3

try {
  $status = (Invoke-WebRequest -Uri "http://localhost:3000/api/v1/health" -UseBasicParsing -TimeoutSec 5).StatusCode
  if ($status -eq 200) {
    Write-Host "✓ Backend online em http://localhost:3000" -ForegroundColor Green
  } else {
    Write-Host "⚠ Backend respondeu com status $status" -ForegroundColor Yellow
  }
} catch {
  Write-Host "✗ Backend não respondeu ainda, checando logs do PM2..." -ForegroundColor Red
  pm2 logs payja-backend --lines 50
}

Pop-Location
