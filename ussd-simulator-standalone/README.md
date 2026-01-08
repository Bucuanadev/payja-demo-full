# USSD Simulator Standalone — documentação actualizada

Resumo rápido
- Simulador USSD leve (Express + SQLite) para desenvolvimento e testes E2E com PayJA.
- Expondo endpoints REST para registo de clientes, sessões USSD e integração compatível com PayJA.

Estado (2026-01-06)
- Serviço executável via PM2 em `localhost:3001` no ambiente local.
- DB local em `ussd-simulator-standalone/data/ussd.db` (SQLite).
- Implementado debouncing em memória para SMS e flags de notificação persistidas "best-effort" (`eligibility_notified`, `confirmation_notified`).

Principais responsabilidades
- Simular registos USSD e fluxos de empréstimo
- Fornecer endpoints compatíveis com PayJA para ingestão (polling)
- Simular envio de SMS (logs + opção forward para gateway)

Estrutura resumida
- `src/` — código do servidor (entradas `app.module.js` e `main.cjs`)
- `src/payja-compatible-simulator.cjs` — adaptador/compatibilidade PayJA
- `src/database.cjs` — wrapper SQLite + migrações em runtime
- `public/` — UI (customers.html)
- `data/ussd.db` — ficheiro SQLite

Requisitos
- Node.js 18+
- npm
- PM2 (opcional) para executar em background: `npm install -g pm2`

Instalar e executar
1) Instalar dependências

```powershell
cd ussd-simulator-standalone
npm install
```

2) Executar em dev

```powershell
# ESM
node src/app.module.js
# ou CJS
node src/main.cjs
```

3) Executar com PM2 (recomendado para testes replicáveis)

```powershell
pm2 start pm2.ussd-simulator.config.js
pm2 logs ussd-simulator --lines 200
pm2 restart ussd-simulator --update-env
```

Endpoints principais
- `GET /health` — healthcheck
- `GET /api/customers` — listar clientes
- `POST /api/customers/register` — registar cliente via frontend
- `GET /api/payja/ussd/new-customers` — clientes não sincronizados (usado pelo PayJA)
- `POST /api/payja/ussd/mark-verified` — marcar cliente como verificado (PayJA compat)
- `GET /api/sms/logs` — histórico de SMS enviados
- `POST /api/ussd/session` e `POST /api/ussd/continue` — iniciar/continuar sessões USSD

SMS e problema de duplicação (contexto)
- Actualmente existem múltiplos pontos no código que podem disparar SMS (polling, sync, endpoints compat, UI). Foi implementado um debouncing em memória e flags persistidas para reduzir reenvios.
- Remanescente: quando vários caminhos disparam quase simultaneamente, podem ser gravadas múltiplas entradas históricas antes da flag ser persistida (corrida).

Correção recomendada (alta prioridade)
- Implementar uma operação atómica no DB que marque a flag e retorne se a alteração ocorreu. Em SQLite/Node isto é feito com um `UPDATE` condicional e checando `this.changes` no callback:

```js
const sql = `UPDATE customers SET eligibility_notified = 1
  WHERE msisdn = ? AND (eligibility_notified IS NULL OR eligibility_notified = 0)`;
this.db.run(sql, [msisdn], function (err) {
  if (err) { /* log e fallback */ return; }
  if (this.changes && this.changes > 0) {
    // ganho a corrida -> enviar SMS e gravar em sms_logs
  } else {
    // outro processo já marcou -> não enviar
  }
});
```

Recomendações operacionais
- Centralizar o emissor de SMS num helper único que execute o `UPDATE` atómico e faça logging.
- Adicionar migração para as colunas `eligibility_notified`, `confirmation_notified` e opcionais `notified_at` (timestamp).
- Usar apenas um processo a escrever no ficheiro SQLite em cenários locais; para ambiente multi-processo, usar Postgres/DB central.

Debugging e verificações rápidas
- Ver logs PM2: `C:\Users\User\.pm2\logs\ussd-simulator-out.log` e `...-error.log`.
- Ver base de dados: `ussd-simulator-standalone/data/ussd.db` (abra com DB Browser for SQLite).
- Testar endpoints:

```powershell
curl -X POST http://localhost:3001/api/payja/ussd/mark-verified -H "Content-Type: application/json" -d '{"phoneNumber":"872345678","creditLimit":30000}'
Invoke-RestMethod http://localhost:3001/api/sms/logs
```

Notas finais
- Este README documenta o estado actual do simulador e recomenda a correção atómica para eliminação definitiva de duplicados de SMS.

---
Última actualização: 2026-01-06
# 📱 USSD Simulator Standalone

Um simulador USSD independente com banco de dados SQLite para gerenciar clientes, fluxos USSD e integração bancária. Perfeito para testes e desenvolvimento de aplicações de microfinanças.

## 🎯 Características

- **🔄 Simulador USSD Completo** - Fluxos de registro e empréstimo
- **💾 Banco de Dados SQLite** - Persistência de clientes e transações
- **🏦 Integração Bancária** - Suporte para múltiplos bancos parceiros
- **📊 Dashboard** - Visualização de clientes e transações
- **📡 API REST** - Endpoints para controle do simulador
- **📞 SMS Simulation** - Log de SMS enviados

## 📋 Estrutura do Projeto

```
ussd-simulator-standalone/
├── src/
│   ├── modules/
│   │   ├── ussd/              # Simulador USSD
│   │   ├── customer/          # Gerenciamento de clientes
│   │   └── bank/              # Integração bancária
│   ├── database/              # Schema e migrações
│   ├── common/                # Utilities e tipos
│   └── main.ts                # Ponto de entrada
├── data/                      # Banco de dados SQLite
├── logs/                      # Logs da aplicação
└── package.json
```

## 🚀 Quick Start

### Pré-requisitos
- Node.js 18+
- npm ou yarn

### Instalação

```bash
# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env

# Criar banco de dados
npm run migrate

# Iniciar em desenvolvimento
npm run dev
```

### Servidor rodando em desenvolvimento

```
✅ USSD Simulator rodando em http://localhost:3001
📊 API disponível em http://localhost:3001/api
```

## 📚 API Endpoints

### Clientes

```bash
# Listar clientes
GET /api/customers

# Obter cliente por NUIT
GET /api/customers/:nuit

# Registrar novo cliente (via USSD)
POST /api/customers
{
  "phoneNumber": "258841234567",
  "nuit": "100234567",
  "name": "João Silva",
  "biNumber": "1234567890123N"
}

# Atualizar cliente
PATCH /api/customers/:nuit
```

### USSD - Customers (novo)

Endpoints para integração USSD e sincronização com PayJA (expostos em `/api/ussd`).

GET /api/ussd/customers
- Lista todos os clientes no formato usado pelo frontends USSD/PayJA.

Example curl:

```bash
curl -sS http://localhost:3001/api/ussd/customers
```

Example Node.js (fetch):

```javascript
import fetch from 'node-fetch';

const res = await fetch('http://localhost:3001/api/ussd/customers');
const body = await res.json();
console.log(body);
```

GET /api/ussd/customers/:phoneNumber
- Retorna detalhes de um cliente (inclui campos básicos e timestamps).

Example curl:

```bash
curl -sS http://localhost:3001/api/ussd/customers/258871234567
```

POST /api/ussd/customers
- Criar ou atualizar cliente via fluxo USSD. Body JSON esperado:

```json
{
  "phoneNumber": "258871234567",
  "name": "João Silva",
  "nuit": "100234567",
  "dateOfBirth": "1990-01-01"
}
```

Exemplo de resposta (GET /api/ussd/customers):

```json
{
  "success": true,
  "customers": [
    {
      "id": 5,
      "phoneNumber": "871234567",
      "name": "João Pedro da Silva",
      "nuit": "100234567",
      "dateOfBirth": null,
      "address": "",
      "district": "",
      "province": "",
      "verified": false,
      "blocked": false,
      "createdAt": "2025-12-26T19:00:00.000Z",
      "updatedAt": "2025-12-26T19:00:00.000Z"
    }
  ],
  "stats": { "total": 1, "verified": 0, "pending": 1, "blocked": 0 }
}
```

Notas:
- As rotas USSD estão montadas em `/api/ussd` e usam o `Prisma Client` para ler/escrever na tabela `customers`.
- O endpoint é compatível com o formato esperado pela integração PayJA (campos `phoneNumber`, `name`, `nuit`, `verified`, `balance`, etc.).

### Frontend direct registration (novo)

Para facilitar o fluxo do smartphone, o frontend pode gravar clientes diretamente no banco do simulador.

- Endpoint: `POST /api/customers/register`
- Body esperado (exemplo):

```json
{
  "phoneNumber": "258841234567",
  "name": "João Silva",
  "nuit": "100234567",
  "email": "joao@example.com",
  "balance": 100.5,
  "verified": true
}
```

- Comportamento: o servidor faz upsert (inserção ou atualização) por `phoneNumber`/`phone`, normaliza alguns campos e grava no SQLite do simulador. O frontend público (`public/customers.html`) já foi atualizado para postar cada cliente para esse endpoint automaticamente (com `localStorage` como fallback).

### Recomendações: concorrência, backup e considerações operacionais

- Banco compartilhado: use apenas um processo servidor para aceitar gravações no mesmo arquivo SQLite. Evite múltiplos processos concorrentes escrevendo no mesmo `.db`.
- Backups: agende cópias periódicas do arquivo `backend/prisma/dev.db` (ou configure `DATABASE_BACKUP_PATH`) antes de operações de massa.
- Idempotência: o endpoint faz upsert por telefone para evitar duplicados — o frontend deve enviar `phoneNumber` no formato E.164 quando possível.
- Validação: o backend valida e normaliza entradas; ainda é recomendado validar tamanhos e formatos no frontend para reduzir erros.
- Recuperação: mantemos a exportação `simulator-customers.json` como fallback para recuperar registros caso haja problemas com a gravação direta.

### USSD Simulation

```bash
# Iniciar fluxo USSD
POST /api/ussd/session
{
  "phoneNumber": "258841234567",
  "flow": "registration" | "loan"
}

# Enviar resposta USSD
POST /api/ussd/session/:sessionId/respond
{
  "step": 1,
  "input": "1"
}

# Listar sessões ativas
GET /api/ussd/sessions

# Status de sessão
GET /api/ussd/sessions/:sessionId
```

### Bancos Parceiros

```bash
# Listar bancos
GET /api/banks

# Registrar novo banco
POST /api/banks
{
  "code": "GHW",
  "name": "Banco GHW",
  "apiUrl": "http://localhost:4000"
}

# Verificar elegibilidade
POST /api/banks/:code/check-eligibility
{
  "nuit": "100234567",
  "amount": 5000
}
```

### SMS Logs

```bash
# Listar SMS enviados
GET /api/sms/logs

# SMS por cliente
GET /api/sms/logs/:phoneNumber

# Limpar logs
DELETE /api/sms/logs
```

## 🗄️ Schema do Banco de Dados

### Tabela: customers

```sql
CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  phoneNumber TEXT UNIQUE NOT NULL,
  nuit TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  biNumber TEXT,
  creditLimit REAL DEFAULT 0,
  salaryBank TEXT,
  verified BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'active',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Tabela: ussd_sessions

```sql
CREATE TABLE ussd_sessions (
  id TEXT PRIMARY KEY,
  phoneNumber TEXT NOT NULL,
  flow TEXT NOT NULL,
  currentStep INTEGER DEFAULT 0,
  data JSON,
  status TEXT DEFAULT 'active',
  startedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expiresAt TIMESTAMP,
  FOREIGN KEY (phoneNumber) REFERENCES customers(phoneNumber)
);
```

### Tabela: bank_partners

```sql
CREATE TABLE bank_partners (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  apiUrl TEXT NOT NULL,
  apiKey TEXT,
  active BOOLEAN DEFAULT true,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Tabela: sms_logs

```sql
CREATE TABLE sms_logs (
  id TEXT PRIMARY KEY,
  phoneNumber TEXT NOT NULL,
  message TEXT,
  type TEXT,
  status TEXT DEFAULT 'sent',
  sentAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (phoneNumber) REFERENCES customers(phoneNumber)
);
```

## 🔄 Fluxos USSD

### Fluxo de Registro (*899#)

```
1. Solicitar NUIT
2. Solicitar Nome Completo
3. Solicitar Número BI
4. Validar contra banco
5. Atribuir limite de crédito
6. Confirmação
7. SMS aprovação/rejeição
```

### Fluxo de Empréstimo (*898#)

```
1. Validar cliente registado
2. Solicitar valor
3. Validar contra limite
4. Confirmação
5. Desembolso
6. SMS confirmação
```

## 🔐 Segurança

- Todas sessões USSD têm timeout automático
- Clientes não verificados não podem solicitar empréstimos
- Validação de limites de crédito por banco
- Logs de todas operações

## 📊 Dados de Teste

O banco vem pré-carregado com 5 clientes para testes:

| NUIT | Nome | Limite |
|------|------|--------|
| 100234567 | João Pedro da Silva | 50.000 MZN |
| 100345678 | Maria Santos Machado | 30.000 MZN |
| 100456789 | Carlos Alberto Mondlane | 80.000 MZN |
| 100567890 | Fatima Ismael Hassan | 25.000 MZN |
| 100678901 | Miguel Jácomo Mubwelo | 60.000 MZN |

Para usar: Digite o NUIT durante simulação USSD.

## 🚀 Deployment

### Docker

```bash
docker build -t ussd-simulator .
docker run -p 3001:3001 -v $(pwd)/data:/app/data ussd-simulator
```

### Produção

```bash
npm run build
NODE_ENV=production npm start
```

## 📝 Logs

Verifique logs em:
- API: `logs/app.log`
- USSD: `logs/ussd.log`
- SMS: `data/sms.log`

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit mudanças (`git commit -m 'Add AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📜 Licença

MIT License - veja LICENSE.md para detalhes

## 📞 Suporte

Para dúvidas ou issues:
- GitHub Issues: https://github.com/bucuanadev/ussd-simulator
- Email: dev@bucuanadev.com

---

**Desenvolvido por:** Bucuanadev | **Versão:** 1.0.0 | **Última atualização:** 11/12/2025
