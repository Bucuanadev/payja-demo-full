# 📊 Integração de Base de Dados - USSD Simulator

## 📋 Visão Geral

Este guia detalha como integrar a base de dados PostgreSQL com o simulador USSD e a aplicação backend PayJA.

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────┐
│      USSD Simulator (Frontend)              │
│  - Smartphone UI com React                  │
│  - Painel de Controle                       │
│  - customers.html para visualizar dados     │
└────────────────┬────────────────────────────┘
                 │ HTTP/JSON
                 ▼
┌─────────────────────────────────────────────┐
│    Node.js Express API (Backend)            │
│  - /api/ussd/session (criar sessão)         │
│  - /api/ussd/continue (processar input)     │
│  - /api/ussd/customers (CRUD clientes)      │
└────────────────┬────────────────────────────┘
                 │ SQL/Prisma
                 ▼
┌─────────────────────────────────────────────┐
│   PostgreSQL Database                       │
│  - Tabela: customers                        │
│  - Tabela: ussd_sessions                    │
│  - Tabela: loans                            │
│  - Tabela: scoring_results                  │
└─────────────────────────────────────────────┘
```

## 📝 Fluxo de Registro de Cliente via USSD

```
1. Cliente disca *898#
   └─ POST /api/ussd/session
      └─ Cria entrada em ussd_sessions

2. Cliente entra dados (Nome, BI, NUIT, etc)
   └─ POST /api/ussd/continue
      └─ Valida dados contra banco de dados
      └─ Atualiza estado da sessão

3. Confirmação com sucesso
   └─ POST /api/ussd/customers
      └─ Cria/Atualiza registro em customers
      └─ Define verified = true

4. Acesso via customers.html
   └─ GET /api/ussd/customers
      └─ Retorna lista de clientes registados
```

## 🔧 Passos de Implementação

### 1️⃣ Setup PostgreSQL (ver POSTGRES_SETUP.md)

```bash
# Criar base de dados e usuário
createuser -P payja  # Criar usuário
createdb -O payja payja_ussd  # Criar DB
```

### 2️⃣ Configurar Prisma Schema

Edite `backend/prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Customer {
  id          String   @id @default(cuid())
  phoneNumber String   @unique
  name        String?
  nuit        String?  @unique
  dateOfBirth DateTime?
  address     String?
  district    String?
  province    String?
  verified    Boolean  @default(false)
  blocked     Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  lastAccess  DateTime?
  
  loans       Loan[]
  ussdSessions UssdSession[]
  
  @@map("customers")
}

model UssdSession {
  id        String   @id @default(cuid())
  sessionId String   @unique
  phoneNumber String
  currentStep String  @default("MENU_PRINCIPAL")
  state     String   @default("{}")
  isActive  Boolean  @default(true)
  startedAt DateTime @default(now())
  lastActivity DateTime @default(now())
  endedAt   DateTime?
  
  @@map("ussd_sessions")
}
```

### 3️⃣ Executar Migrações

```bash
cd backend

# Instalar Prisma
npm install @prisma/client prisma

# Criar migration
npx prisma migrate dev --name init

# Aplicar schema
npx prisma db push
```

### 4️⃣ Integrar Rotas de Clientes

Adicione as rotas do arquivo `USSD_CUSTOMERS_ROUTES.js` ao seu Express server:

```javascript
// backend/src/routes/ussd.routes.js
import { Router } from 'express';
import { prisma } from '../prisma.service';

const router = Router();

// ... copiar endpoints de USSD_CUSTOMERS_ROUTES.js

export default router;
```

### 5️⃣ Integrar com USSD Flow

No endpoint `POST /api/ussd/continue`, adicione a lógica de salvar cliente:

```javascript
// Após confirmação bem-sucedida do registro
if (flowStep === 'REGISTRATION_COMPLETE') {
  // Salvar cliente no banco
  await prisma.customer.upsert({
    where: { phoneNumber },
    update: {
      name: sessionState.name,
      nuit: sessionState.nuit,
      dateOfBirth: new Date(sessionState.dateOfBirth),
      address: sessionState.address,
      district: sessionState.district,
      province: sessionState.province,
      verified: true,
      lastAccess: new Date()
    },
    create: {
      phoneNumber,
      name: sessionState.name,
      nuit: sessionState.nuit,
      dateOfBirth: new Date(sessionState.dateOfBirth),
      address: sessionState.address,
      district: sessionState.district,
      province: sessionState.province,
      verified: true
    }
  });
}
```

## 📱 Campos Capturados no Fluxo USSD

| Campo | Tipo | Obrigatório | Validação |
|-------|------|-------------|-----------|
| phoneNumber | String | ✅ Sim | 86/87 + 7 dígitos |
| name | String | ✅ Sim | Min 3 caracteres |
| nuit | String | ✅ Sim | Único no sistema |
| dateOfBirth | Date | ❌ Não | Formato DD/MM/YYYY |
| address | String | ❌ Não | Max 255 caracteres |
| district | String | ❌ Não | Seleção de distritos |
| province | String | ❌ Não | Seleção de províncias |

## 🔍 Consultas SQL Úteis

```sql
-- Total de clientes
SELECT COUNT(*) FROM customers;

-- Clientes registados hoje
SELECT * FROM customers WHERE DATE(created_at) = CURRENT_DATE;

-- Clientes verificados
SELECT COUNT(*) FROM customers WHERE verified = true;

-- Últimos 10 acessos
SELECT phone_number, last_access FROM customers 
ORDER BY last_access DESC LIMIT 10;

-- Clientes por distrito
SELECT district, COUNT(*) as total 
FROM customers 
GROUP BY district;

-- Sessões ativas
SELECT COUNT(*) FROM ussd_sessions WHERE is_active = true;
```

## 🌐 API Endpoints Disponíveis

### Listar Clientes
```bash
GET /api/ussd/customers

Resposta:
{
  "success": true,
  "customers": [...],
  "stats": {
    "total": 10,
    "verified": 8,
    "pending": 2,
    "blocked": 0
  }
}
```

### Ver Detalhes de Cliente
```bash
GET /api/ussd/customers/:phoneNumber

Resposta:
{
  "success": true,
  "customer": {
    "id": "uuid",
    "phoneNumber": "875551234",
    "name": "João Silva",
    "nuit": "123456789",
    "verified": true,
    "createdAt": "2024-12-11T10:30:00Z",
    "loans": [...]
  }
}
```

### Registar Cliente
```bash
POST /api/ussd/customers

Body:
{
  "phoneNumber": "875551234",
  "name": "João Silva",
  "nuit": "123456789",
  "district": "Maputo",
  "province": "Maputo"
}
```

### Atualizar Cliente
```bash
PUT /api/ussd/customers/:phoneNumber

Body:
{
  "name": "João da Silva",
  "address": "Avenida Julius Nyerere, Maputo"
}
```

## 📊 Painel de Visualização (customers.html)

O arquivo `simulador/customers.html` fornece:

✅ **Estatísticas**
- Total de clientes
- Clientes verificados
- Pendentes de verificação
- Clientes bloqueados

✅ **Tabela com filtros**
- Busca por nome, telefone ou NUIT
- Status visual (Verificado, Pendente, Bloqueado)
- Data de registo
- Botão para ver detalhes completos

✅ **Modal de Detalhes**
- Informações completas do cliente
- Histórico de acessos
- Últimos empréstimos (se houver)

## 🔐 Segurança

### Recomendações

1. **Autenticação**: Proteja endpoints `/customers` com JWT
   ```javascript
   router.get('/customers', authenticate, authorizeAdmin, (req, res) => {...})
   ```

2. **Validação**: Sempre validar dados de entrada
   ```javascript
   const schema = z.object({
     phoneNumber: z.string().regex(/^(86|87)\d{7}$/),
     nuit: z.string().length(12)
   });
   ```

3. **Rate Limiting**: Aplicar limite de requisições
   ```javascript
   const limiter = rateLimit({
     windowMs: 15 * 60 * 1000,
     max: 100
   });
   ```

4. **Variáveis de Ambiente**: Nunca commitar credenciais
   ```
   DATABASE_URL=postgresql://...
   JWT_SECRET=...
   ```

## 🚀 Deploy para Produção

1. **Usar PostgreSQL gerenciado** (AWS RDS, Heroku Postgres, etc)
2. **Configurar HTTPS** para todas as requisições
3. **Implementar backups automáticos** do banco de dados
4. **Usar connection pooling** (PgBouncer, Pgpool)
5. **Monitorar performance** com Grafana/DataDog

## 📞 Suporte

Para dúvidas ou problemas:
1. Verificar logs: `journalctl -u postgresql`
2. Testar conexão: `psql -U payja -d payja_ussd`
3. Validar schema: `npx prisma studio`

