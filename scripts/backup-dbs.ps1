<#
  Backup important DB files (backend and simulator) into tmp/backups with timestamp.
  Run from repository root.
#>
Param()

$now = Get-Date -Format "yyyyMMdd-HHmmss"
$out = "tmp\backups\$now"
if (-not (Test-Path "tmp\backups")) { New-Item -ItemType Directory -Path "tmp\backups" | Out-Null }
New-Item -ItemType Directory -Path $out | Out-Null

$candidates = @(
    "backend/dev.db",
    "ussd-simulator-standalone/data/ussd.db",
    "banco-mock/backend/data/db.json"
)

foreach ($p in $candidates) {
    if (Test-Path $p) {
        Copy-Item -Path $p -Destination $out -Force
        Write-Host "Backed up $p -> $out"
    }
}

Write-Host "Backup complete: $out"
