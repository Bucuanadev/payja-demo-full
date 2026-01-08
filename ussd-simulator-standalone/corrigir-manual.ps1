
# corrigir-manual.ps1 - Corrige rotas Express para async no USSD Simulator
$file = "src/main.cjs"
Write-Host "🔧 Corrigindo USSD Simulator..." -ForegroundColor Cyan
if (-not (Test-Path $file)) {
    Write-Host "❌ Arquivo não encontrado: $file" -ForegroundColor Red
    exit 1
}
$lines = Get-Content $file
$changed = $false
for ($i = 0; $i -lt $lines.Count; $i++) {
    $line = $lines[$i]
    if ($line -like '*req, res) =>*' -and $line -notlike '*async*') {
        $lines[$i] = $line.Replace('(req, res) =>', 'async (req, res) =>')
        Write-Host "🔧 Linha $($i+1): async adicionado" -ForegroundColor Green
        $changed = $true
    }
}
if ($changed) {
    Set-Content -Path $file -Value $lines -Encoding UTF8
    Write-Host "✅ Arquivo corrigido!" -ForegroundColor Green
    Write-Host "🔍 Verificando sintaxe..." -ForegroundColor Cyan
    $syntax = node -c $file 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Sintaxe OK!" -ForegroundColor Green
    } else {
        Write-Host "❌ Erro de sintaxe!" -ForegroundColor Red
        Write-Host $syntax -ForegroundColor Red
    }
} else {
    Write-Host "ℹ️ Nenhuma alteração necessária" -ForegroundColor Yellow
}
Write-Host "" -ForegroundColor Cyan
Write-Host "pm2 start src/main.cjs --name ussd-simulator" -ForegroundColor White
Write-Host "curl http://localhost:3001/api/payja/ussd/new-customers" -ForegroundColor White
