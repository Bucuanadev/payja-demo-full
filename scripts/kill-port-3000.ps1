$pids = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
if ($pids) {
  foreach ($p in $pids) {
    Write-Host "Killing PID $p"
    try { Stop-Process -Id $p -Force -ErrorAction Stop } catch { Write-Host 'Failed to stop PID' $p ':' $_ }
  }
} else {
  Write-Host "No process found on port 3000"
}
