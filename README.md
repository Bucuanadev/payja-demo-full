# PayJA - Sistema de Microcrédito via USSD

Sistema completo de microcrédito para funcionários públicos em Moçambique, com integração USSD Movitel, scoring de crédito inteligente e gestão de empréstimos.

## 🚀 Tecnologias

### Backend
- **NestJS** 10.3.0
- **Prisma** 5.8.0 (SQLite)
- **TypeScript** 5.1.3
- **Passport JWT**
- **Class Validator**

### Frontend
- **React** 18.2.0
- **Vite** 5.4.21
- **Ant Design** 5.13.0
- **Zustand**
- **Axios**

## 📁 Estrutura

```
payja-demo/
├── backend/           # API NestJS + Prisma
│   ├── src/modules/
│   │   ├── auth/             # Autenticação JWT
│   │   ├── ussd-movitel/     # Integração USSD
│   │   ├── scoring/          # Score de crédito
│   │   ├── loans/            # Empréstimos
│   │   ├── sms/              # SMS Service
│   │   ├── admin/            # Dashboard
│   │   ├── bank-adapters/    # Bancos
│   │   └── mobile-operator-adapters/
│   └── prisma/
│
└── desktop/           # React + Vite
    └── src/
        ├── pages/
        ├── components/
        └── services/
```

## 🎯 Funcionalidades

### USSD Movitel
- Registro via *123#
- Simulação de empréstimos
- Menu interativo

### Scoring (300-850)
- Análise de histórico
- Avaliação de salário
- Categorização de risco

### Empréstimos
- Cálculo automático
- Comissões (3%+3%+8%)
- Status completo
- Histórico

### Bancos
- Letsego
- Millennium BIM
- BCI
- Standard Bank
- Emola

### Dashboard
- Estatísticas em tempo real
- Gestão de aprovações
- Logs de auditoria

## 🔧 Instalação

### 1. Dependências

```powershell
# Backend
cd backend
npm install

# Backend do Banco-Mock
cd banco-mock/backend
npm install

# Frontend do Banco-Mock
cd banco-mock/frontend
npm install

# Desktop PayJA
cd desktop
npm install
```

### 2. Banco de Dados

```powershell
cd backend
npx prisma generate
npx prisma migrate deploy
```

### 3. Executar Services

**Terminal 1 - PayJA Backend (porta 3000):**
```powershell
cd backend
npm run start:dev
```

**Terminal 2 - Banco-Mock Backend (porta 4000):**
```powershell
cd banco-mock/backend
node src/index.js
```

**Terminal 3 - Banco-Mock Frontend (porta 4100):**
```powershell
cd banco-mock/frontend
npm run dev -- --host --port 4100
```

**Terminal 4 - PayJA Desktop (porta 5173):**
```powershell
cd desktop
npm run dev
```

## 🌐 Acessar

- **PayJA Dashboard**: http://localhost:5173
- **Banco-Mock Admin**: http://localhost:4100
- **PayJA API**: http://localhost:3000/api/v1
- **Banco-Mock API**: http://localhost:4000/api

## 💡 Fluxo de Uso

### 1. Registrar Cliente via USSD (*899#)
```
*899# → Nome → BI → NUIT → Confirmar
```

Sistema:
1. Busca dados do cliente no Banco-Mock
2. Valida NUIT + Nome + BI
3. Compara dados com banco
4. Se aprovado: registra com limite do banco
5. Envia SMS com aprovação e limite

### 2. Solicitar Empréstimo via USSD (*898#)
```
*898# → Valor → Propósito → Confirmar
```

Sistema:
1. Valida se cliente é registrado
2. Verifica creditLimit (do banco)
3. Se aprovado: chama Banco para desembolso
4. Envia SMS ao cliente com referência
5. Notifica PayJA com webhook

## 🏦 Integração com Bancos

### Banco-Mock (Desenvolvimento)
- Simula banco GHW
- 5 clientes fictícios pré-carregados
- Endpoints de elegibilidade, capacidade e desembolso

### Configuração Dinâmica
Todos os bancos são configuráveis via tabela `bank_partners`:

```sql
SELECT code, name, apiUrl, active FROM bank_partners;
```

Bancos ativos encontram-se em:
- Dashboard: Integrations → Bank Partners
- API: GET /api/v1/bank-partners

### Fluxo de Validação

Durante registro, PayJA:
1. Busca lista de bancos ativos
2. Loop: para cada banco
   - Chama POST /api/validacao/verificar
   - Compara dados do cliente
   - Se score >= 70%: aprova e usa banco
3. Registra customer com creditLimit do banco
4. Define salaryBank para referência

## 🔌 APIs do Banco-Mock

### POST /api/validacao/verificar
Verifica elegibilidade do cliente

```json
Request:
{
  "nuit": "100234567",
  "nome": "João Pedro da Silva",
  "bi": "1234567890123N"
}

Response (aprovado):
{
  "sucesso": true,
  "elegivel": true,
  "limite_aprovado": 50000,
  "cliente": {
    "nuit": "100234567",
    "nome": "João Pedro da Silva",
    "score_credito": 750,
    "renda_mensal": 35000
  }
}
```

### POST /api/desembolso/executar
Executa desembolso para cliente

```json
Request:
{
  "nuit": "100234567",
  "valor": 5000,
  "numero_emola": "82<number>",
  "referencia_payja": "PAYJA-20251209-001"
}

Response:
{
  "sucesso": true,
  "id_transacao": "uuid",
  "status": "PROCESSADO",
  "valor_desembolsado": 5000
}
```

### GET /api/health
Health check do banco

```json
Response:
{
  "status": "online",
  "timestamp": "2025-12-09T08:00:00Z"
}
```

## 📊 Clientes Fictícios (Banco-Mock)

| NUIT | Nome | Score | Limite |
|------|------|-------|--------|
| 100234567 | João Pedro da Silva | 750 | 50000 |
| 100345678 | Maria Santos Machado | 680 | 30000 |
| 100456789 | Carlos Alberto Mondlane | 820 | 80000 |
| 100567890 | Ana Isabel Cossa | 590 | 15000 |
| 100678901 | Pedro Manuel Sitoe | 710 | 60000 |

## 🔐 Segurança

- API Key para Banco-Mock: `banco-ghw-api-key-2025`
- JWT para PayJA API
- Validação de dados em múltiplas camadas
- Logs de auditoria para todas operações

## 📝 Variáveis de Ambiente

**Backend (.env):**
```
DATABASE_URL="file:./dev.db"
JWT_SECRET="seu-secret-seguro"
SMS_API_KEY="sua-chave"
```

**Banco-Mock (.env):**
```
PORT=4000
BANCO_NOME="Banco GHW"
API_KEY=banco-ghw-api-key-2025
PAYJA_API_URL=http://localhost:3000/api/v1
```

## 🐛 Troubleshooting

### Porta 4000 em uso
```powershell
Get-Process -Id (Get-NetTCPConnection -LocalPort 4000).OwningProcess
Stop-Process -Id <PID> -Force
```

### Prisma Migration Error
```powershell
cd backend
npx prisma migrate reset
npx prisma db seed
```

### USSD não funciona
- Verificar PayJA Backend rodando em 3000
- Verificar Banco-Mock Backend rodando em 4000
- Verificar API Key: `banco-ghw-api-key-2025`
- Checar logs: http://localhost:5173 → Integrações

## 📚 Documentação Adicional

- [Estrutura do Projeto](./ESTRUTURA.md)
- [Guia de Integração de APIs](./INTEGRACAO_APIS.md)
- [Integração com Bancos Universais](./INTEGRACAO_UNIVERSAL.md)
- [Início Rápido](./INICIO_RAPIDO.md)

## 👥 Contribuições

Reporte bugs via [Issues](/issues) ou contribua com [Pull Requests](/pulls).

## 📄 Licença

Proprietary - PayJA Corporation
cd backend
npm run start:dev
```
http://localhost:3000

**Frontend:**
```powershell
cd desktop
npm run dev
```
http://localhost:5173

## 🔐 Credenciais

**Admin:**
- Email: `admin@payja.co.mz`
- Senha: `Admin@123`

**Cliente:**
- Telefone: `+258840001234`
- NUIT: `123456789`

## 📡 API Principal

```
POST   /api/v1/auth/login
POST   /api/v1/auth/register
POST   /api/v1/movitel/ussd/callback
GET    /api/v1/loans
POST   /api/v1/loans/:id/disburse
GET    /api/v1/scoring/customer/:customerId
GET    /api/v1/admin/dashboard
```

## 🗄️ Modelos

```prisma
model Customer {
  id           String
  phoneNumber  String @unique
  nuit         String @unique
  name         String
  loans        Loan[]
}

model Loan {
  id             String
  amount         Float
  interestRate   Float
  status         String
  totalAmount    Float
}

model ScoringResult {
  id          String
  finalScore  Int    // 300-850
  risk        String
}
```

## 📊 Fluxo

1. Cliente digita *123#
2. Registro USSD
3. Validação de dados
4. Scoring automático
5. Oferta baseada no score
6. Validação bancária
7. Desembolso Emola
8. Empréstimo ativo

## 🛠️ Scripts

```powershell
# Backend
npm run start:dev
npm run build
npm run test

# Frontend
npm run dev
npm run build
npm run preview
```

## 📝 Documentação

- `ESTRUTURA.md` - Detalhes técnicos
- `INICIO_RAPIDO.md` - Guia rápido

## 🔒 Segurança

- JWT Authentication
- Validação completa
- Sanitização de dados
- Logs de auditoria

## 📈 Status

**Versão:** 1.0.0  
**Status:** Produção  
**Atualização:** Dezembro 2025

### Implementado
✅ Autenticação  
✅ USSD Movitel  
✅ Scoring  
✅ Empréstimos  
✅ SMS  
✅ Bancos  
✅ Dashboard  
✅ Simuladores  

---

**PayJA** - Crédito rápido e justo 🇲🇿
