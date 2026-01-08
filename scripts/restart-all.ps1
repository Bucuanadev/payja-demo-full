<#
.SYNOPSIS
  Rebuilds PayJA backend, ensures logs folder, and restarts PM2 processes for PayJA, simulator and banco-mock on Windows.

.DESCRIPTION
  Run this script from the repository root. It will:
    - build the backend TypeScript (calls npm run build in backend)
    - ensure backend/logs exists
    - restart pm2 processes using the known process names

  This script does not modify source files; it runs the canonical build to regenerate dist.
#>

Param()

Push-Location (Split-Path -Path $MyInvocation.MyCommand.Definition -Parent)

Write-Host "[restart-all] Building backend..."
if (Test-Path backend) {
    Push-Location backend
    if (Test-Path package.json) {
        npm install
        npm run build
    }
    Pop-Location
} else {
    Write-Warning "backend folder not found; skipping build"
}

Write-Host "[restart-all] Ensuring backend/logs exists"
$logs = "backend\logs"
if (-not (Test-Path $logs)) { New-Item -ItemType Directory -Path $logs | Out-Null }

Write-Host "[restart-all] Restarting PM2 processes (payja-backend, payja-frontend, banco-mock-backend, banco-mock-frontend, ussd-simulator)"
try {
    pm2 restart payja-backend || pm2 start pm2.payja-backend.config.js
} catch {
    Write-Warning "pm2 restart payja-backend failed; ensure pm2 is installed globally and config path is correct"
}
try { pm2 restart payja-frontend || pm2 start pm2.payja-frontend.config.cjs } catch {}
try { pm2 restart banco-mock-backend || pm2 start banco-mock/backend/pm2.banco-mock-backend.config.js } catch {}
try { pm2 restart banco-mock-frontend || pm2 start banco-mock/frontend/pm2.banco-mock-frontend.config.js } catch {}
try { pm2 restart ussd-simulator || pm2 start pm2.ussd-simulator.config.js } catch {}

Write-Host "[restart-all] Done. Check 'pm2 ls' and backend logs in backend/logs"

Pop-Location
