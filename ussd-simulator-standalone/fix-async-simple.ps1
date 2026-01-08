# fix-async-simple.ps1 - Correção simplificada que FUNCIONA
$file = "C:\Users\User\Downloads\ussd\payja-demo\ussd-simulator-standalone\src\main.cjs"

Write-Host "🔧 Corrigindo erro de async no USSD Simulator..." -ForegroundColor Cyan

if (-not (Test-Path $file)) {
    Write-Host "❌ Arquivo não encontrado: $file" -ForegroundColor Red
    exit 1
}

# 1. Primeiro, faça backup
$backupFile = "$file.backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
Copy-Item $file $backupFile
Write-Host "📁 Backup criado: $backupFile" -ForegroundColor Gray

# 2. Ler o conteúdo
$content = Get-Content $file -Raw

# 3. Corrigir a rota específica que está dando erro (linha ~300)
Write-Host "`n🔍 Procurando a rota problemática..." -ForegroundColor Yellow


# Padrão simplificado sem problemas de escape
$pattern1 = 'app\.get\(\'/api/payja/ussd/new-customers\', \(req, res\) =>'
$pattern2 = 'app\.get\(\"/api/payja/ussd/new-customers\", \(req, res\) =>'

if ($content -match $pattern1 -or $content -match $pattern2) {
    Write-Host "✅ Encontrada rota /api/payja/ussd/new-customers sem 'async'" -ForegroundColor Green
    
    # Substituir ambas as variações
    $content = $content -replace $pattern1, "app.get('/api/payja/ussd/new-customers', async (req, res) =>"
    $content = $content -replace $pattern2, 'app.get("/api/payja/ussd/new-customers", async (req, res) =>'
    
    Write-Host "✅ 'async' adicionado à rota /api/payja/ussd/new-customers" -ForegroundColor Green
} else {
    Write-Host "⚠️  Padrão exato não encontrado. Buscando por 'await' próximo..." -ForegroundColor Yellow
    
    # Buscar por 'await db.all' e corrigir a função que o contém
    $lines = $content -split "`n"
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match 'await db\.all\(') {
            Write-Host "📍 'await' encontrado na linha aproximadamente $($i+1)" -ForegroundColor Cyan
            
            # Procurar para trás pela função que contém este await
            for ($j = $i; $j -ge 0; $j--) {
                if ($lines[$j] -match 'app\.(get|post|put|patch|delete)\(') {
                    Write-Host "🔍 Função encontrada: $($lines[$j].Trim())" -ForegroundColor Cyan
                    
                    if ($lines[$j] -notmatch 'async') {
                        # Adicionar async antes de (req, res)
                        $lines[$j] = $lines[$j] -replace '\(req,\s*res\)\s*=>', 'async (req, res) =>'
                        $content = $lines -join "`n"
                        Write-Host "✅ 'async' adicionado à função" -ForegroundColor Green
                    }
                    break
                }
            }
            break
        }
    }
}

# 4. Verificar e corrigir outras rotas comuns que usam banco de dados
Write-Host "`n🔍 Verificando outras rotas que podem precisar de 'async'..." -ForegroundColor Yellow

$commonRoutes = @(
    '/api/customers',
    '/api/customers/',
    '/api/sync',
    '/api/payja/ussd/eligibility',
    '/api/payja/ussd/mark-verified',
    '/api/customers/register',
    '/api/customers/sync-from-localStorage',
    '/api/customers/reset-all'
)

foreach ($route in $commonRoutes) {
    # Padrão para rotas GET
    $getPattern = 'app\.get\(\'' + $route + '\', \(req, res\) =>'
    $getPattern2 = 'app\.get\(\"' + $route + '\", \(req, res\) =>'
    # Padrão para rotas POST
    $postPattern = 'app\.post\(\'' + $route + '\', \(req, res\) =>'
    $postPattern2 = 'app\.post\(\"' + $route + '\", \(req, res\) =>'
    
    $patterns = @($getPattern, $getPattern2, $postPattern, $postPattern2)
    
    foreach ($pattern in $patterns) {
        if ($content -match $pattern) {
            Write-Host "   ✅ Encontrada rota: $route" -ForegroundColor Gray
            
            # Verificar se já tem async
            if ($pattern -notmatch 'async') {
                # Adicionar async
                $content = $content -replace $pattern, ($pattern -replace '\(req,\s*res\)\s*=>', 'async (req, res) =>')
                Write-Host "   🔧 'async' adicionado a: $route" -ForegroundColor Green
            }
        }
    }
}

# 5. Salvar o arquivo corrigido
Set-Content $file $content -Encoding UTF8

Write-Host "`n✅ Arquivo corrigido e salvo!" -ForegroundColor Green

# 6. Verificar sintaxe
Write-Host "`n🔍 Verificando sintaxe do arquivo..." -ForegroundColor Cyan
try {
    node -c $file
    Write-Host "✅ Sintaxe OK! Nenhum erro encontrado." -ForegroundColor Green
} catch {
    Write-Host "❌ Erro de sintaxe encontrado:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    
    # Mostrar linha do erro
    if ($_.Exception.Message -match 'line (\d+)') {
        $errorLine = [int]$Matches[1]
        Write-Host "`n🔍 Mostrando linha $errorLine e contexto:" -ForegroundColor Yellow
        
        $lines = Get-Content $file
        $start = [Math]::Max(0, $errorLine - 3)
        $end = [Math]::Min($lines.Count - 1, $errorLine + 2)
        
        for ($i = $start; $i -le $end; $i++) {
            $marker = if ($i + 1 -eq $errorLine) { ">>>" } else { "   " }
            Write-Host "$marker $($i+1): $($lines[$i])" -ForegroundColor $(if ($i + 1 -eq $errorLine) { "Red" } else { "Gray" })
        }
    }
}

Write-Host "`n📋 Próximos passos:" -ForegroundColor Cyan
Write-Host "1. Reinicie o serviço: pm2 start src/main.cjs --name ussd-simulator" -ForegroundColor White
Write-Host "2. Teste: curl http://localhost:3001/api/payja/ussd/new-customers" -ForegroundColor White
Write-Host "3. Backup original em: $backupFile" -ForegroundColor Gray
