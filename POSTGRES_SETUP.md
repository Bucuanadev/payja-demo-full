# PostgreSQL Setup para USSD Simulator

## 📋 Requisitos

- PostgreSQL 12+ instalado e em execução
- Node.js 16+
- Prisma CLI (`npm install -g @prisma/cli`)

## 🚀 Passo 1: Criar Base de Dados PostgreSQL

```bash
# Conectar ao PostgreSQL
psql -U postgres

# Criar usuário para a aplicação
CREATE USER payja WITH PASSWORD 'payja_secure_password_123';

# Criar base de dados
CREATE DATABASE payja_ussd OWNER payja;

# Conceder permissões
GRANT ALL PRIVILEGES ON DATABASE payja_ussd TO payja;
ALTER ROLE payja CREATEDB;

# Verificar conexão
psql -U payja -d payja_ussd -h localhost
```

## 🔧 Passo 2: Atualizar Configuração do Prisma

Edite o arquivo `backend/prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

## 🔐 Passo 3: Configurar Variáveis de Ambiente

Edite o arquivo `backend/.env`:

```env
DATABASE_URL="postgresql://payja:payja_secure_password_123@localhost:5432/payja_ussd"
```

## ✨ Passo 4: Executar Migrações

```bash
cd backend

# Instalar dependências
npm install

# Aplicar migrações
npx prisma migrate deploy

# Gerar Prisma Client
npx prisma generate
```

## 📊 Passo 5: Verificar Instalação

```bash
# Executar Prisma Studio (interface gráfica)
npx prisma studio
```

A interface estará disponível em `http://localhost:5555`

## 🛠️ Estrutura de Tabelas (PostgreSQL)

```sql
-- Clientes
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(255),
  nuit VARCHAR(20) UNIQUE,
  date_of_birth TIMESTAMP,
  address TEXT,
  district VARCHAR(100),
  province VARCHAR(100),
  verified BOOLEAN DEFAULT false,
  blocked BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_access TIMESTAMP
);

-- Sessões USSD
CREATE TABLE ussd_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(255) UNIQUE NOT NULL,
  phone_number VARCHAR(20),
  current_step VARCHAR(100) DEFAULT 'MENU_PRINCIPAL',
  state JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP
);

-- Empréstimos
CREATE TABLE loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  amount DECIMAL(15,2),
  interest_rate DECIMAL(5,2) DEFAULT 15.0,
  term_months INT,
  purpose TEXT,
  total_amount DECIMAL(15,2),
  monthly_payment DECIMAL(15,2),
  status VARCHAR(50) DEFAULT 'PENDING',
  approved_by VARCHAR(255),
  approved_at TIMESTAMP,
  rejected_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  disbursed_at TIMESTAMP,
  due_date TIMESTAMP
);
```

## 🔄 Sincronizar dados existentes

Se você já tem dados em SQLite, use este script para migrar:

```bash
node scripts/migrate-sqlite-to-postgres.js
```

## 📝 Variáveis de Ambiente Completas

```env
# Base de Dados
DATABASE_URL="postgresql://payja:payja_secure_password_123@localhost:5432/payja_ussd"

# API USSD
USSD_API_URL="http://localhost:3001"
USSD_SESSION_TIMEOUT=600

# JWT
JWT_SECRET="sua_chave_secreta_jwt_aqui"
JWT_EXPIRATION="7d"

# Ambiente
NODE_ENV="development"
PORT=3000
```

## ✅ Verificação Final

```bash
# Conectar e verificar schema
psql -U payja -d payja_ussd -c "\dt"

# Contar clientes registados
psql -U payja -d payja_ussd -c "SELECT COUNT(*) FROM customers;"
```

## 🐛 Troubleshooting

**Erro: "could not connect to server"**
- Verificar se PostgreSQL está em execução: `sudo systemctl status postgresql`
- Iniciar serviço: `sudo systemctl start postgresql`

**Erro: "role does not exist"**
- Confirmar user: `psql -U postgres -c "\du"`
- Recriar user se necessário

**Erro: "permission denied"**
- Garantir permissões: `GRANT ALL ON DATABASE payja_ussd TO payja;`

## 🌐 Conexão Remota (Produção)

Para conectar a uma instância PostgreSQL remota:

```env
DATABASE_URL="postgresql://payja:PASSWORD@seu-servidor.com:5432/payja_ussd"
```

Certifique-se de configurar regras de firewall adequadas.
