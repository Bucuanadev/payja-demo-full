$nodes = Get-Process node -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id
if ($nodes) {
  foreach ($i in $nodes) {
    $c = Get-CimInstance Win32_Process -Filter "ProcessId=$i" -ErrorAction SilentlyContinue
    if ($c) {
      Write-Output ("--- PID:{0} ---" -f $i)
      Write-Output $c.CommandLine
    }
  }
} else {
  Write-Output "No node processes"
}
