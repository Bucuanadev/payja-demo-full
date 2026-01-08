# ============================================================
# USSD Simulator - PostgreSQL Setup Script (Windows)
# Configura automaticamente a base de dados PostgreSQL
# ============================================================

Write-Host "🚀 Iniciando Setup PostgreSQL para USSD Simulator..." -ForegroundColor Green
Write-Host ""

# Configurações padrão
$DbUser = "payja"
$DbName = "payja_ussd"
$DbPassword = if ($env:PAYJA_DB_PASSWORD) { $env:PAYJA_DB_PASSWORD } else { "payja_secure_password_123" }
$DbHost = "localhost"
$DbPort = "5432"

Write-Host "📋 Configuração:" -ForegroundColor Cyan
Write-Host "  Database: $DbName"
Write-Host "  User: $DbUser"
Write-Host "  Host: $DbHost`:$DbPort"
Write-Host ""

# Pedir confirmação
$confirmation = Read-Host "Deseja continuar com estas configurações? (s/n)"
if ($confirmation -ne "s" -and $confirmation -ne "S") {
    Write-Host "Operação cancelada."
    exit 0
}

Write-Host ""
Write-Host "⏳ Criando usuario e base de dados..." -ForegroundColor Yellow

# SQL para criar usuario e database
$sqlScript = @"
-- Criar usuário
CREATE USER $DbUser WITH PASSWORD '$DbPassword';
ALTER ROLE $DbUser CREATEDB;

-- Criar base de dados
CREATE DATABASE $DbName OWNER $DbUser;

-- Conceder permissões
GRANT ALL PRIVILEGES ON DATABASE $DbName TO $DbUser;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $DbUser;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $DbUser;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO $DbUser;

-- Listar usuarios
\du

-- Listar databases
\l
"@

# Executar script SQL
$sqlScript | psql -U postgres -h $DbHost -p $DbPort

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Usuario e database criados com sucesso!" -ForegroundColor Green
} else {
    Write-Host "❌ Erro ao criar usuario e database!" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Criar arquivo .env se não existir
$envPath = "backend\.env"
if (-not (Test-Path $envPath)) {
    Write-Host "📝 Criando arquivo backend\.env..." -ForegroundColor Yellow
    
    $envContent = @"
# Database
DATABASE_URL="postgresql://$DbUser`:$DbPassword@$DbHost`:$DbPort/$DbName"

# USSD API
USSD_API_URL="http://localhost:3001"
USSD_SESSION_TIMEOUT=600

# JWT
JWT_SECRET="sua_chave_secreta_jwt_aqui_mudar_em_producao"
JWT_EXPIRATION="7d"

# Ambiente
NODE_ENV="development"
PORT=3000
"@
    
    Set-Content -Path $envPath -Value $envContent
    Write-Host "✓ Arquivo .env criado" -ForegroundColor Green
} else {
    Write-Host "ℹ️  Arquivo .env já existe, pulando..." -ForegroundColor Gray
}

Write-Host ""
Write-Host "🔧 Executando migrações Prisma..." -ForegroundColor Yellow

Push-Location backend

# Instalar dependências se necessário
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Instalando dependências..." -ForegroundColor Yellow
    npm install
}

# Executar migrações
Write-Host "Aplicando schema ao banco de dados..." -ForegroundColor Cyan
npx prisma migrate deploy

if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Primeira execução - criando schema..." -ForegroundColor Yellow
    npx prisma db push
}

# Gerar Prisma Client
npx prisma generate

Pop-Location

Write-Host ""
Write-Host "✅ Setup concluído com sucesso!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Próximos passos:" -ForegroundColor Cyan
Write-Host "  1. Verificar conexão: psql -U $DbUser -d $DbName"
Write-Host "  2. Visualizar schema: npx prisma studio"
Write-Host "  3. Iniciar servidor: npm start"
Write-Host ""
Write-Host "🎉 Sistema pronto para uso!" -ForegroundColor Green
