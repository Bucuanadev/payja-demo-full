# 📱 USSD Simulator - Sistema de Registro de Clientes com PostgreSQL

## 🎯 Visão Geral

Sistema completo de simulador USSD com interface React e banco de dados PostgreSQL para registar clientes que ligam para o *898# (Solicitar Empréstimo).

### ✨ Funcionalidades

✅ **Interface USSD Simulada**
- Smartphone mockup realista com React
- Fluxo de registro interativo
- Captura de dados: Nome, NUIT, Data de Nascimento, Endereço, etc.
- Mensagens em tempo real com auto-scroll

✅ **Painel de Controle**
- Teste de conexão API
- Configuração de número de telefone
- Botão para acessar dashboard de clientes
- Status em tempo real

✅ **Dashboard de Clientes** (`customers.html`)
- Visualização de todos os clientes registados
- Filtro por nome, telefone ou NUIT
- Estatísticas de registros (total, verificados, pendentes, bloqueados)
- Modal com detalhes completos de cada cliente
- Status visual (Verificado, Pendente, Bloqueado)

✅ **Base de Dados PostgreSQL**
- Armazenamento seguro de dados de clientes
- Histórico de sessões USSD
- Dados de empréstimos
- Scoring de crédito automático

## 🚀 Setup Rápido

### Pré-requisitos
- Node.js 16+
- PostgreSQL 12+
- npm ou yarn

### 1️⃣ Configurar PostgreSQL

**Windows (PowerShell):**
```powershell
# Executar script de setup
.\setup-postgres.ps1
```

**Linux/Mac (Bash):**
```bash
# Executar script de setup
chmod +x setup-postgres.sh
./setup-postgres.sh
```

**Manual (qualquer OS):**
```bash
# Conectar a PostgreSQL
psql -U postgres

# Executar no shell PostgreSQL:
CREATE USER payja WITH PASSWORD 'payja_secure_password_123';
CREATE DATABASE payja_ussd OWNER payja;
GRANT ALL PRIVILEGES ON DATABASE payja_ussd TO payja;
\q

# Testar conexão
psql -U payja -d payja_ussd
```

### 2️⃣ Configurar Backend

```bash
cd backend

# Instalar dependências
npm install

# Copiar .env.example (se não usar script)
cp .env.example .env

# Editar .env com credenciais PostgreSQL
# DATABASE_URL="postgresql://payja:payja_secure_password_123@localhost:5432/payja_ussd"

# Aplicar migrações
npx prisma migrate deploy

# Gerar Prisma Client
npx prisma generate

# Iniciar servidor
npm start
```

### 3️⃣ Configurar Frontend

```bash
cd ../simulador

# Arquivos já estão prontos:
# - index.html (Simulator UI)
# - customers.html (Dashboard)

# O PM2 já está servindo em http://localhost:3001
pm2 restart ussd-simulator
```

## 📁 Arquivos Criados/Modificados

```
payja-demo/
├── POSTGRES_SETUP.md              # Guia detalhado PostgreSQL
├── DATABASE_INTEGRATION.md        # Guia de integração de dados
├── USSD_CUSTOMERS_ROUTES.js       # Endpoints API para clientes
├── setup-postgres.sh              # Script setup Linux/Mac
├── setup-postgres.ps1             # Script setup Windows
├── simulador/
│   ├── index.html                 # Interface USSD + Painel de Controle
│   └── customers.html             # Dashboard de clientes
└── backend/
    ├── prisma/
    │   └── schema.prisma          # Schema do banco de dados
    └── .env                       # Configurações (DATABASE_URL, JWT, etc)
```

## 🔄 Fluxo de Dados

```
Cliente disca *898#
    ↓
[USSD Simulator - index.html]
    ├─ Valida número (86/87 + 7 dígitos)
    └─ POST /api/ussd/session
         ↓
[Backend API]
    ├─ Cria sessão em ussd_sessions
    └─ Retorna welcome message
         ↓
Cliente entra dados (Nome, BI, NUIT, etc)
    └─ POST /api/ussd/continue
         ↓
[Backend valida e processa]
    ├─ Valida campos
    ├─ POST /api/ussd/customers
    │   └─ Salva em PostgreSQL
    └─ Retorna confirmação
         ↓
Cliente vê confirmação
    └─ Sessão encerra
         ↓
[Dashboard - customers.html]
    └─ GET /api/ussd/customers
       └─ Exibe cliente registado
```

## 📊 Endpoints API

### Sessões USSD

**Criar Sessão**
```bash
POST /api/ussd/session
Content-Type: application/json

{
  "phoneNumber": "875551234"
}

Resposta:
{
  "sessionId": "uuid-xxx",
  "message": "Bem-vindo ao PayJA...",
  "flow": "unified"
}
```

**Continuar Sessão**
```bash
POST /api/ussd/continue
Content-Type: application/json

{
  "sessionId": "uuid-xxx",
  "userInput": "João Silva"
}

Resposta:
{
  "message": "Próxima pergunta...",
  "endSession": false
}
```

### Clientes

**Listar Todos**
```bash
GET /api/ussd/customers

Resposta:
{
  "success": true,
  "customers": [
    {
      "phoneNumber": "875551234",
      "name": "João Silva",
      "nuit": "123456789",
      "verified": true,
      "createdAt": "2024-12-11T10:30:00Z"
    }
  ],
  "stats": {
    "total": 10,
    "verified": 8,
    "pending": 2,
    "blocked": 0
  }
}
```

**Registar Cliente**
```bash
POST /api/ussd/customers
Content-Type: application/json

{
  "phoneNumber": "875551234",
  "name": "João Silva",
  "nuit": "123456789",
  "dateOfBirth": "1990-05-15",
  "address": "Av. Julius Nyerere, Maputo",
  "district": "Maputo",
  "province": "Maputo"
}
```

**Ver Detalhes**
```bash
GET /api/ussd/customers/875551234

Resposta inclui: dados completos + histórico de empréstimos
```

## 🗄️ Estrutura do Banco de Dados

```sql
-- Clientes registados
customers
├── id (UUID)
├── phoneNumber (VARCHAR UNIQUE)
├── name
├── nuit (VARCHAR UNIQUE)
├── dateOfBirth
├── address
├── district
├── province
├── verified (BOOLEAN)
├── blocked (BOOLEAN)
├── createdAt
├── updatedAt
└── lastAccess

-- Sessões USSD
ussd_sessions
├── id (UUID)
├── sessionId (VARCHAR UNIQUE)
├── phoneNumber
├── currentStep
├── state (JSONB)
├── isActive
├── startedAt
├── lastActivity
└── endedAt

-- Empréstimos
loans
├── id (UUID)
├── customerId (FK → customers)
├── amount
├── interestRate
├── termMonths
├── status
├── createdAt
└── ...

-- Scoring de Crédito
scoring_results
├── id (UUID)
├── customerId (FK → customers)
├── finalScore
├── risk
├── decision
└── calculatedAt
```

## 🎮 Como Usar

### Acessar o Simulador

1. Abrir browser em `http://localhost:3001`
2. Clique em "*898# - Solicitar Empréstimo"
3. Altere o número se desejar (padrão: 875551234)
4. Preencha os dados conforme solicitado
5. Complete o fluxo de registro

### Visualizar Clientes Registados

1. Clique no botão verde "👥 Ver Clientes Registados"
2. Abre `customers.html`
3. Veja estatísticas de registros
4. Busque por nome, telefone ou NUIT
5. Clique "Ver" para detalhes completos

### Testar API Manualmente

```bash
# Criar sessão
curl -X POST http://localhost:3001/api/ussd/session \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"875551234"}'

# Listar clientes
curl http://localhost:3001/api/ussd/customers

# Ver Prisma Studio
cd backend
npx prisma studio
# Acessa em http://localhost:5555
```

## 🔐 Segurança - Implementar em Produção

```javascript
// 1. Autenticação na API
router.use(authenticate);  // JWT middleware
router.use(authorizeAdmin); // Role-based access

// 2. Validação de entrada
const schema = z.object({
  phoneNumber: z.string().regex(/^(86|87)\d{7}$/),
  nuit: z.string().length(12)
});

// 3. Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});

// 4. Variáveis de ambiente
DATABASE_URL=postgresql://...  // Nunca commitar!
JWT_SECRET=...                 // Gerar com openssl rand -base64 32

// 5. HTTPS
// Usar certificados SSL em produção
```

## 📈 Próximos Passos

- [ ] Implementar autenticação de admin
- [ ] Exportar clientes para CSV/Excel
- [ ] Relatórios de aprovação de empréstimos
- [ ] Notificações por SMS para clientes
- [ ] Dashboard de analytics
- [ ] Webhooks para eventos importantes
- [ ] Backup automático de base de dados
- [ ] Replicação PostgreSQL para alta disponibilidade

## 🐛 Troubleshooting

### Erro: "could not connect to server"
```bash
# Verificar se PostgreSQL está em execução
psql -U postgres -c "SELECT 1"

# Iniciar PostgreSQL
sudo systemctl start postgresql  # Linux
pg_ctl -D "C:\Program Files\PostgreSQL\15\data" start  # Windows
```

### Erro: "role does not exist"
```bash
# Criar user
sudo -u postgres createuser payja
sudo -u postgres psql -c "ALTER ROLE payja WITH PASSWORD 'senha';"
```

### Erro: "database does not exist"
```bash
# Criar database
sudo -u postgres createdb payja_ussd -O payja

# Ou via psql:
psql -U postgres -c "CREATE DATABASE payja_ussd OWNER payja;"
```

### customers.html mostra vazio
```bash
# Verificar se API está respondendo
curl http://localhost:3001/api/ussd/customers

# Verificar logs do backend
pm2 logs

# Verificar banco de dados
psql -U payja -d payja_ussd -c "SELECT * FROM customers;"
```

## 📚 Documentação Detalhada

- `POSTGRES_SETUP.md` - Setup completo PostgreSQL
- `DATABASE_INTEGRATION.md` - Integração da base de dados
- `USSD_CUSTOMERS_ROUTES.js` - Endpoints da API
- Backend: `src/modules/ussd/ussd.routes.js` - Lógica USSD

## 🆘 Suporte

Para dúvidas ou problemas:

1. Verificar logs: `pm2 logs ussd-simulator`
2. Testar conexão DB: `psql -U payja -d payja_ussd`
3. Validar schema: `npx prisma studio`
4. Verificar API: `curl http://localhost:3001/api/health`

## 📝 Licença

PayJA - Sistema de Empréstimos por USSD

---

**Desenvolvido com ❤️ para Moçambique**

Versão: 2.0 (PostgreSQL Ready)  
Data: Dezembro 2024
