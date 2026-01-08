# fix-all-async.ps1 - Corrigir todas as rotas que precisam de async

$file = "C:\Users\User\Downloads\ussd\payja-demo\ussd-simulator-standalone\src\main.cjs"

Write-Host "🔧 Corrigindo todas as rotas async em $file" -ForegroundColor Cyan

if (-not (Test-Path $file)) {
    Write-Host "❌ Arquivo não encontrado" -ForegroundColor Red
    exit 1
}

$content = Get-Content $file -Raw


# Lista de padrões que usam await e precisam de async
$patterns = [System.Collections.ArrayList]@()
# Padrão 1: Funções com await mas sem async
$patterns.Add(@{
  Pattern = '(app\.(get|post|put|patch|delete)\(["\"]/api/[^"\"]+["\"],\s*)(\(req,\s*res\)\s*=>\s*\{[^}]*?await)';
  Replacement = '$1async $3'
})
# Padrão 2: Funções que usam operações de banco (db.all, db.run, db.get)
$patterns.Add(@{
  Pattern = '(app\.(get|post|put|patch|delete)\(["\"]/api/(customers|payja|sync|ussd)[^"\"]*["\"],\s*)(\(req,\s*res\)\s*=>)';
  Replacement = '$1async $4'
})

$changesMade = 0

foreach ($patternInfo in $patterns) {
    $matches = [regex]::Matches($content, $patternInfo.Pattern, [System.Text.RegularExpressions.RegexOptions]::Singleline)
    
    if ($matches.Count -gt 0) {
        Write-Host "✅ Encontradas $($matches.Count) rotas para corrigir com padrão" -ForegroundColor Green
        foreach ($match in $matches) {
            Write-Host "   📍 Rota: $($match.Groups[3].Value)" -ForegroundColor Gray
        }
        
        $content = [regex]::Replace($content, $patternInfo.Pattern, $patternInfo.Replacement, [System.Text.RegularExpressions.RegexOptions]::Singleline)
        $changesMade += $matches.Count
    }
}

# Correção específica para a rota problemática na linha ~300
$specificFix = @'
// ROTA CORRIGIDA: /api/payja/ussd/new-customers
app.get('/api/payja/ussd/new-customers', async (req, res) => {
  console.log(`📥 Requisição recebida de ${req.ip} para /api/payja/ussd/new-customers`);
  
  if (!db) {
    console.error('❌ DB não disponível');
    return res.status(500).json({ error: 'DB não disponível' });
  }
  
  try {
    const customers = await db.all('SELECT * FROM customers WHERE isActive = 1 OR verified = 1');
    console.log(`📊 Retornando ${customers.length} clientes ativos`);
    
    const formatted = customers.map(c => {
      // Corrigir nome - remover "null"
      const firstName = c.firstName || '';
      const lastName = c.lastName || '';
      const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
      
      return {
        phoneNumber: c.msisdn || '',
        name: fullName || 'Cliente',
        nuit: c.nuit || null,
        biNumber: c.biNumber || null,
        institution: c.salaryBank || '',
        verified: c.isActive === 1 || c.verified === 1
      };
    });
    
    console.log(`✅ Enviando ${formatted.length} clientes formatados`);
    
    // Headers importantes
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Keep-Alive', 'timeout=30');
    
    res.json(formatted);
    
  } catch (error) {
    console.error('❌ Erro ao buscar clientes:', error);
    res.status(500).json({ error: error.message });
  }
});
'@

# Substituir a rota problemática específica
$oldRoutePattern = "app\.get\(['\"]/api/payja/ussd/new-customers['\"],\s*.*?res\.json\(formatted\);\s*\n\s*\}"
$content = [regex]::Replace($content, $oldRoutePattern, $specificFix, [System.Text.RegularExpressions.RegexOptions]::Singleline)
$changesMade++

# Salvar o arquivo
Set-Content $file $content

Write-Host "`n✅ $changesMade correções aplicadas!" -ForegroundColor Green

# Verificar sintaxe
Write-Host "`n🔍 Verificando sintaxe do arquivo..." -ForegroundColor Cyan
try {
    node -c $file
    Write-Host "✅ Sintaxe OK!" -ForegroundColor Green
} catch {
    Write-Host "❌ Erro de sintaxe encontrado:" -ForegroundColor Red
    $_
}

Write-Host "`n📋 Próximos passos:" -ForegroundColor Cyan
Write-Host "1. Reinicie o serviço: pm2 start src/main.cjs --name ussd-simulator" -ForegroundColor White
Write-Host "2. Teste: curl http://localhost:3001/api/payja/ussd/new-customers" -ForegroundColor White
