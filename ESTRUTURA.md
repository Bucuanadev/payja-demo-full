# Estrutura do Projeto PayJA

## 📁 Organização de Arquivos

```
payja-demo/
│
├── 📄 README.md                    # Documentação principal
├── 📄 ESTRUTURA.md                 # Este arquivo
├── 📄 INICIO_RAPIDO.md             # Guia de início rápido
├── 📄 .gitignore                   # Arquivos ignorados pelo Git
│
├── ⚡ Scripts PowerShell
│   ├── start.ps1                   # Iniciar backend
│   ├── stop.ps1                    # Parar serviços
│   └── check.ps1                   # Verificar status
│
├── 🗄️ backend/                     # Backend NestJS
│   ├── src/
│   │   ├── app.module.ts           # Módulo raiz
│   │   ├── main.ts                 # Entry point
│   │   ├── prisma.service.ts       # Prisma client
│   │   │
│   │   └── modules/
│   │       ├── admin/              # Administração
│   │       │   ├── admin.controller.ts
│   │       │   ├── admin.service.ts
│   │       │   └── admin.module.ts
│   │       │
│   │       ├── auth/               # Autenticação JWT
│   │       │   ├── auth.controller.ts
│   │       │   ├── auth.service.ts
│   │       │   ├── auth.module.ts
│   │       │   ├── jwt-auth.guard.ts
│   │       │   ├── jwt.strategy.ts
│   │       │   └── local.strategy.ts
│   │       │
│   │       ├── bank-adapters/      # Integração com bancos
│   │       │   ├── bank-adapters.controller.ts
│   │       │   ├── bank-adapters.service.ts
│   │       │   ├── bank-adapters.module.ts
│   │       │   └── adapters/
│   │       │       ├── letsego.adapter.ts
│   │       │       ├── bim.adapter.ts
│   │       │       ├── bci.adapter.ts
│   │       │       ├── standard-bank.adapter.ts
│   │       │       └── emola.adapter.ts
│   │       │
│   │       ├── decision/           # Motor de decisão
│   │       │   ├── decision.service.ts
│   │       │   └── decision.module.ts
│   │       │
│   │       ├── loans/              # Empréstimos
│   │       │   ├── loans.controller.ts
│   │       │   ├── loans.service.ts
│   │       │   ├── loans.module.ts
│   │       │   ├── bank-validation.service.ts
│   │       │   ├── commission.service.ts
│   │       │   ├── disbursement.service.ts
│   │       │   └── installment.service.ts
│   │       │
│   │       ├── mobile-operator-adapters/  # Operadoras móveis
│   │       │   ├── mobile-operator-adapters.controller.ts
│   │       │   ├── mobile-operator-adapters.service.ts
│   │       │   ├── mobile-operator-adapters.module.ts
│   │       │   └── adapters/
│   │       │       ├── movitel.adapter.ts
│   │       │       └── vodacom.adapter.ts
│   │       │
│   │       ├── registration-ussd/  # USSD de registro
│   │       │   ├── registration-ussd.controller.ts
│   │       │   ├── registration-ussd.service.ts
│   │       │   └── registration-ussd.module.ts
│   │       │
│   │       ├── scoring/            # Score de crédito
│   │       │   ├── scoring.controller.ts
│   │       │   ├── scoring.service.ts
│   │       │   └── scoring.module.ts
│   │       │
│   │       ├── sms/                # Serviço de SMS
│   │       │   ├── sms.controller.ts
│   │       │   ├── sms.service.ts
│   │       │   └── sms.module.ts
│   │       │
│   │       ├── ussd/               # USSD base
│   │       │   ├── ussd.controller.ts
│   │       │   ├── ussd.service.ts
│   │       │   └── ussd.module.ts
│   │       │
│   │       └── ussd-movitel/       # USSD Movitel
│   │           ├── ussd-movitel.controller.ts
│   │           ├── ussd-movitel.service.ts
│   │           └── ussd-movitel.module.ts
│   │
│   ├── prisma/
│   │   ├── schema.prisma           # Schema do banco
│   │   ├── seed.ts                 # Dados iniciais
│   │   └── migrations/             # Migrações
│   │
│   ├── package.json
│   ├── tsconfig.json
│   └── nest-cli.json
│
└── 💻 desktop/                     # Frontend React
    ├── src/
    │   ├── main.jsx                # Entry point
    │   ├── App.jsx                 # Componente raiz
    │   ├── index.css               # Estilos globais
    │   │
    │   ├── components/
    │   │   └── DashboardLayout.jsx # Layout principal
    │   │
    │   ├── pages/
    │   │   ├── LoginPage.jsx       # Login
    │   │   ├── DashboardPage.jsx   # Dashboard
    │   │   ├── CustomersPage.jsx   # Clientes
    │   │   ├── LoansPage.jsx       # Empréstimos
    │   │   ├── IntegrationsPage.jsx# Integrações
    │   │   ├── UssdSimulatorPage.jsx # Simulador USSD
    │   │   ├── SmsSimulatorPage.jsx  # Simulador SMS
    │   │   └── MockControlPage.jsx   # Controle Mock APIs
    │   │
    │   ├── services/
    │   │   └── api.js              # Cliente Axios
    │   │
    │   ├── stores/
    │   │   └── authStore.js        # Estado autenticação
    │   │
    │   └── electron/
    │       └── main.js             # Electron (futuro)
    │
    ├── index.html
    ├── package.json
    └── vite.config.js
```

## 🏗️ Módulos Backend (11 ativos)

### 1. **auth** - Autenticação
- JWT tokens
- Passport strategies
- Guards e decorators
- Login/Register

### 2. **ussd-movitel** - USSD Movitel
- Integração *123#
- Menu interativo
- Sessões USSD
- Callbacks Movitel

### 3. **scoring** - Score de Crédito
- Cálculo 300-850
- Análise de histórico
- Categorização de risco
- Validação automática

### 4. **loans** - Empréstimos
- CRUD empréstimos
- Cálculo de juros
- Comissões (3%+3%+8%)
- Desembolso
- Parcelas
- Status tracking

### 5. **sms** - SMS Service
- Envio de SMS
- OTP codes
- Notificações
- Histórico

### 6. **admin** - Dashboard Admin
- Estatísticas
- Aprovações
- Logs de auditoria
- Gestão de usuários

### 7. **bank-adapters** - Integrações Bancárias
- Letsego
- Millennium BIM
- BCI
- Standard Bank
- Emola (desembolso)

### 8. **mobile-operator-adapters** - Operadoras
- Movitel
- Vodacom
- Validações
- APIs específicas

### 9. **registration-ussd** - Registro USSD
- Fluxo de registro
- Validação de dados
- OTP verification
- Cadastro de clientes

### 10. **decision** - Motor de Decisão
- Regras de negócio
- Aprovação automática
- Integração scoring
- Limites de crédito

### 11. **ussd** - USSD Base
- Funcionalidades base USSD
- Gerenciamento de sessões
- Parsers

## 🗄️ Modelos Prisma

```prisma
Customer        # Clientes
Loan            # Empréstimos
Installment     # Parcelas
ScoringResult   # Scores de crédito
UssdSession     # Sessões USSD
SmsLog          # Logs de SMS
AuditLog        # Auditoria
User            # Usuários admin
BankAccount     # Contas bancárias
```

## 🎨 Componentes Frontend

### Layout
- `DashboardLayout.jsx` - Menu lateral e header

### Páginas
- `LoginPage.jsx` - Autenticação
- `DashboardPage.jsx` - Overview do sistema
- `CustomersPage.jsx` - Lista e detalhes de clientes
- `LoansPage.jsx` - Gestão de empréstimos
- `IntegrationsPage.jsx` - Status de integrações
- `UssdSimulatorPage.jsx` - Teste de USSD
- `SmsSimulatorPage.jsx` - Teste de SMS
- `MockControlPage.jsx` - Controle de APIs Mock

### Stores (Zustand)
- `authStore.js` - Estado de autenticação

### Services
- `api.js` - Cliente HTTP (Axios)

## 🔌 APIs e Integrações

### Backend Endpoints
```
/api/v1/auth/*              # Autenticação
/api/v1/movitel/ussd/*      # USSD Movitel
/api/v1/loans/*             # Empréstimos
/api/v1/scoring/*           # Scoring
/api/v1/admin/*             # Admin
/api/v1/sms/*               # SMS
/api/v1/bank-adapters/*     # Bancos
```

### Integrações Externas
- **Movitel USSD Gateway** - *123#
- **Emola API** - Desembolsos
- **SMS Gateway** - Notificações
- **Bancos** - Validações

## 📦 Dependências Principais

### Backend
```json
{
  "@nestjs/core": "^10.3.0",
  "@nestjs/passport": "^10.0.3",
  "@prisma/client": "^5.8.0",
  "passport-jwt": "^4.0.1",
  "class-validator": "^0.14.0"
}
```

### Frontend
```json
{
  "react": "^18.2.0",
  "antd": "^5.13.0",
  "axios": "^1.6.2",
  "zustand": "^4.4.7",
  "vite": "^5.4.21"
}
```

## 🚀 Fluxo de Dados

```
Cliente USSD (*123#)
    ↓
Movitel Gateway
    ↓
ussd-movitel.controller
    ↓
ussd-movitel.service
    ↓
scoring.service (avaliação)
    ↓
decision.service (aprovação)
    ↓
loans.service (criação)
    ↓
bank-adapters.service (validação)
    ↓
disbursement.service (Emola)
    ↓
sms.service (notificação)
```

## 📊 Banco de Dados

- **ORM:** Prisma
- **Database:** SQLite (dev), PostgreSQL (prod)
- **Arquivo:** `backend/prisma/dev.db`
- **Migrações:** `backend/prisma/migrations/`

## 🔐 Segurança

- JWT com refresh tokens
- Password hashing (bcrypt)
- Validação de inputs (class-validator)
- Guards em rotas protegidas
- Sanitização de dados
- Logs de auditoria

## 📝 Configuração

### Variáveis de Ambiente (.env)
```
DATABASE_URL="file:./dev.db"
JWT_SECRET="your-secret-key"
MOVITEL_USSD_URL="https://api.movitel.co.mz/ussd"
EMOLA_API_URL="https://api.emola.co.mz"
SMS_GATEWAY_URL="https://sms.gateway.co.mz"
```

## 🛠️ Comandos Úteis

```powershell
# Backend
cd backend
npm run start:dev     # Desenvolvimento
npm run build         # Build produção
npm run test          # Testes
npx prisma studio     # UI do banco

# Frontend
cd desktop
npm run dev           # Desenvolvimento
npm run build         # Build produção
npm run preview       # Preview build

# Prisma
npx prisma generate   # Gerar client
npx prisma migrate dev # Nova migração
npx prisma db seed    # Seed database
```

## 📈 Status do Projeto

**Versão:** 1.0.0  
**Status:** Produção  
**Última Atualização:** Dezembro 2025

### ✅ Implementado
- Autenticação completa
- USSD Movitel funcional
- Scoring automatizado
- Empréstimos com comissões
- Integrações bancárias
- SMS service
- Dashboard admin
- Simuladores de teste

### ❌ Removido (incompatibilidades)
- mock-apis (sistema de mocks)
- cross-validation (validação cruzada)
- billing-cycle (ciclo de cobrança)
- terms (termos e condições)

---

**PayJA** - Microcrédito via USSD 🇲🇿
