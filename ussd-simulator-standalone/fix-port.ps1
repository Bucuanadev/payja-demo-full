Write-Host "🛠️  Corrigindo problemas de porta..." -ForegroundColor Yellow

# 1. Parar tudo
pm2 stop all 2>$null
pm2 delete all 2>$null
pm2 kill 2>$null

# 2. Matar processos Node
Get-Process node* -ErrorAction SilentlyContinue | Stop-Process -Force

# 3. Verificar portas em uso
Write-Host "`n🔍 Verificando portas em uso:" -ForegroundColor Cyan
$ports = @(3001, 3002, 3003, 8080, 5000)
foreach ($port in $ports) {
    $process = netstat -ano | findstr ":$port"
    if ($process) {
        Write-Host "   Porta $port: ❌ EM USO" -ForegroundColor Red
        # Extrair e matar PID
        $pid = ($process[0] -split '\s+')[-1]
        taskkill /PID $pid /F 2>$null
        Write-Host "     → Processo $pid finalizado" -ForegroundColor Yellow
    } else {
        Write-Host "   Porta $port: ✅ DISPONÍVEL" -ForegroundColor Green
    }
}

# 4. Limpar PM2
pm2 flush 2>$null
pm2 cleardump 2>$null

# 5. Modificar porta no código (opcional - faça backup primeiro)
$mainFile = "src/main.cjs"
if (Test-Path $mainFile) {
    $content = Get-Content $mainFile -Raw
    # Muda porta para 3001
    $newContent = $content -replace 'const PORT = process\.env\.PORT \|\| 3002;', 'const PORT = process.env.PORT || 3001;'
    Set-Content $mainFile $newContent
    Write-Host "`n✅ Porta alterada para 3001 em $mainFile" -ForegroundColor Green
}

Write-Host "`n✅ Limpeza completa!" -ForegroundColor Green
Write-Host "`n📌 Comandos para iniciar:" -ForegroundColor Cyan
Write-Host "   cd '$pwd'" -ForegroundColor White
Write-Host "   pm2 start src/main.cjs --name ussd-simulator" -ForegroundColor White
Write-Host "   pm2 logs ussd-simulator" -ForegroundColor White
