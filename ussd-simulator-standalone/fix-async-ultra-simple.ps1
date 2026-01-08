# fix-async-ultra-simple.ps1 - Correção ultra simplificada
$file = "C:\Users\User\Downloads\ussd\payja-demo\ussd-simulator-standalone\src\main.cjs"

Write-Host "🔧 Corrigindo erro de async no USSD Simulator..." -ForegroundColor Cyan

if (-not (Test-Path $file)) {
    Write-Host "❌ Arquivo não encontrado: $file" -ForegroundColor Red
    exit 1
}

# Backup
$backupFile = "$file.backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
Copy-Item $file $backupFile
Write-Host "📁 Backup criado: $backupFile" -ForegroundColor Gray

$content = Get-Content $file -Raw

# Corrige a rota principal
$content = $content -replace "app.get('/api/payja/ussd/new-customers', (req, res) =>", "app.get('/api/payja/ussd/new-customers', async (req, res) =>"
$content = $content -replace 'app.get("/api/payja/ussd/new-customers", (req, res) =>', 'app.get("/api/payja/ussd/new-customers", async (req, res) =>'

# Corrige outras rotas comuns
$routes = @(
    '/api/customers',
    '/api/customers/',
    '/api/sync',
    '/api/payja/ussd/eligibility',
    '/api/payja/ussd/mark-verified',
    '/api/customers/register',
    '/api/customers/sync-from-localStorage',
    '/api/customers/reset-all'
)
foreach ($route in $routes) {
    $content = $content -replace "app.get('$route', (req, res) =>", "app.get('$route', async (req, res) =>"
    $content = $content -replace "app.get(\"$route\", (req, res) =>", "app.get(\"$route\", async (req, res) =>"
    $content = $content -replace "app.post('$route', (req, res) =>", "app.post('$route', async (req, res) =>"
    $content = $content -replace "app.post(\"$route\", (req, res) =>", "app.post(\"$route\", async (req, res) =>"
}

Set-Content $file $content -Encoding UTF8
Write-Host "\n✅ Arquivo corrigido e salvo!" -ForegroundColor Green

Write-Host "\n📋 Próximos passos:" -ForegroundColor Cyan
Write-Host "1. Reinicie o serviço: pm2 start src/main.cjs --name ussd-simulator" -ForegroundColor White
Write-Host "2. Teste: curl http://localhost:3001/api/payja/ussd/new-customers" -ForegroundColor White
Write-Host "3. Backup original em: $backupFile" -ForegroundColor Gray
