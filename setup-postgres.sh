#!/bin/bash

# ============================================================
# USSD Simulator - PostgreSQL Setup Script
# Configura automaticamente a base de dados PostgreSQL
# ============================================================

set -e

echo "🚀 Iniciando Setup PostgreSQL para USSD Simulator..."
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar se PostgreSQL está instalado
if ! command -v psql &> /dev/null; then
    echo -e "${RED}❌ PostgreSQL não está instalado!${NC}"
    echo "Instale com: apt-get install postgresql postgresql-contrib"
    exit 1
fi

echo -e "${GREEN}✓ PostgreSQL encontrado${NC}"
echo ""

# Configurações padrão
DB_USER="payja"
DB_NAME="payja_ussd"
DB_PASSWORD="${PAYJA_DB_PASSWORD:-payja_secure_password_123}"
DB_HOST="104.207.142.188"
DB_PORT="5432"

echo "📋 Configuração:"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo "  Host: $DB_HOST:$DB_PORT"
echo ""

# Pedir confirmação
read -p "Deseja continuar com estas configurações? (s/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    echo "Operação cancelada."
    exit 0
fi

echo ""
echo "⏳ Criando usuario e base de dados..."

# Criar usuário e database
sudo -u postgres psql << EOF
-- Criar usuário
CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';
ALTER ROLE $DB_USER CREATEDB;

-- Criar base de dados
CREATE DATABASE $DB_NAME OWNER $DB_USER;

-- Conceder permissões
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $DB_USER;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $DB_USER;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO $DB_USER;

-- Mostrar resultado
\du
\l
EOF

echo -e "${GREEN}✓ Usuario e database criados com sucesso!${NC}"
echo ""

# Criar arquivo .env se não existir
if [ ! -f "backend/.env" ]; then
    echo "📝 Criando arquivo backend/.env..."
    cat > backend/.env << EOF
# Database
DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME"

# USSD API
USSD_API_URL="http://104.207.142.188:3001"
USSD_SESSION_TIMEOUT=600

# JWT
JWT_SECRET="sua_chave_secreta_jwt_aqui_mudar_em_producao"
JWT_EXPIRATION="7d"

# Ambiente
NODE_ENV="development"
PORT=3000
EOF
    echo -e "${GREEN}✓ Arquivo .env criado${NC}"
else
    echo "ℹ️  Arquivo .env já existe, pulando..."
fi

echo ""
echo "🔧 Executando migrações Prisma..."

cd backend

# Instalar dependências se necessário
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependências..."
    npm install
fi

# Executar migrações
echo "Aplicando schema ao banco de dados..."
npx prisma migrate deploy || {
    echo -e "${YELLOW}⚠️  Primeira execução - criando schema...${NC}"
    npx prisma db push
}

# Gerar Prisma Client
npx prisma generate

cd ..

echo ""
echo -e "${GREEN}✅ Setup concluído com sucesso!${NC}"
echo ""
echo "📊 Próximos passos:"
echo "  1. Verificar conexão: psql -U $DB_USER -d $DB_NAME"
echo "  2. Visualizar schema: npx prisma studio"
echo "  3. Iniciar servidor: npm start"
echo ""
echo "🎉 Sistema pronto para uso!"
