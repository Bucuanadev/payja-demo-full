param()
$ErrorActionPreference = 'SilentlyContinue'

function Test-Backend {
  try {
    $resp = Invoke-WebRequest -Uri "http://155.138.227.26:3000/api/v1/health" -UseBasicParsing -TimeoutSec 5
    return $resp.StatusCode -eq 200
  } catch {
    return $false
  }
}

if (-not (Test-Backend)) {
  Write-Host "[Watchdog] Backend offline, restarting via PM2..." -ForegroundColor Yellow
  pm2 restart payja-backend | Out-Null
  Start-Sleep -Seconds 3
  if (Test-Backend) {
    Write-Host "[Watchdog] Backend restored" -ForegroundColor Green
  } else {
    Write-Host "[Watchdog] Restart failed, starting fresh..." -ForegroundColor Red
    pm2 start "$(Resolve-Path "$PSScriptRoot\..\pm2.payja-backend.config.js")" --only payja-backend --update-env | Out-Null
  }
}
