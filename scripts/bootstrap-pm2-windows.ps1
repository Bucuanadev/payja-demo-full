Param(
    [switch]$InstallService
)

Write-Host "==> Ensuring PM2 is installed globally" -ForegroundColor Cyan
if (-not (Get-Command pm2 -ErrorAction SilentlyContinue)) {
    npm install -g pm2 | Out-Null
}

if ($InstallService) {
    Write-Host "==> Installing PM2 Windows Service" -ForegroundColor Cyan
    if (-not (Get-Command pm2-service-install -ErrorAction SilentlyContinue)) {
        npm install -g pm2-windows-service | Out-Null
    }
    pm2-service-install -n PM2 -d "$env:APPDATA\pm2" -u $env:USERNAME -p $env:USERDOMAIN | Out-Null
}

Set-Location "$PSScriptRoot\.."

Write-Host "==> Starting all apps with ecosystem.config.js" -ForegroundColor Cyan
pm2 start ecosystem.config.js

Write-Host "==> Saving PM2 process list for resurrection on boot" -ForegroundColor Cyan
pm2 save

Write-Host "All set. PM2 will restore these processes automatically on startup." -ForegroundColor Green
