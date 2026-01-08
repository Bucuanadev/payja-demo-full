USSD Simulator — documentação actualizada

Resumo
- O `ussd-simulator-standalone` é um simulador USSD leve (Express + SQLite) que armazena clientes localmente e expõe endpoints usados pelo PayJA backend para testes E2E.

Principais responsabilidades
- Simular registo de clientes via USSD/UI
- Expor endpoints compatíveis com PayJA para ingestão (`/api/payja/ussd/*`)
- Gerir histórico de SMS (em memória + persistido em `smsLogs` no DB)

Estrutura chave
- `src/` — código do servidor (entradas `app.module.js`, `main.cjs`)
- `src/payja-compatible-simulator.cjs` — camada compatibilidade PayJA
- `src/database.cjs` — wrapper SQLite + migrations
- `public/` — UI (customers.html)
- `data/ussd.db` — ficheiro SQLite local

Portas e endpoints úteis
- Porta padrão: `3001` (env `PORT` para override)
- Health: `GET /health`
- Registar cliente: `POST /api/customers/register`
- Listar: `GET /api/customers`
- PayJA compat:
  - `GET /api/payja/ussd/new-customers` — retorna clientes não sincronizados
  - `POST /api/payja/ussd/mark-verified` — marca cliente como verificado (usado no fluxo PayJA)
  - `POST /api/payja/ussd/eligibility` — endpoint de elegibilidade (quando usado)
- Logs SMS: `GET /api/sms/logs`

Execução local rápida
1) Instalar dependências

```powershell
cd ussd-simulator-standalone
npm install
```

2) Executar em desenvolvimento

```powershell
# ESM
node src/app.module.js
# ou CJS
node src/main.cjs
```

3) Executar com PM2 (produção local)

```powershell
pm2 start pm2.ussd-simulator.config.js
pm2 logs ussd-simulator --lines 200
```

Comportamento de envio de SMS (estado actual)
- Implementado debouncing em memória (`recentSmsSent*`) para evitar envios rápidos repetidos.
- Existe persistência "best-effort" de flags `eligibility_notified` / `confirmation_notified` no SQLite para evitar reenvios entre módulos/instâncias.
- Observou-se que, em corridas (vários caminhos a enviar quase simultaneamente), podem ser gravadas múltiplas entradas históricas antes da flag ser escrita.

Correção recomendada (implementar no emissor central)
- Use uma operação atómica no DB: executar um `UPDATE` condicional que marque `eligibility_notified = 1` e só envie quando `changes > 0`.

Exemplo (SQLite / Node):

```js
const sql = `UPDATE customers
  SET eligibility_notified = 1
  WHERE msisdn = ? AND (eligibility_notified IS NULL OR eligibility_notified = 0)`;
this.db.run(sql, [msisdn], function (err) {
  if (err) { /* log e fallback */ return; }
  if (this.changes && this.changes > 0) {
    // enviar SMS e gravar em smsLogs
  } else {
    // já marcado por outro processo — ignorar
  }
});
```

Debugging & Inspeção
- DB local: `ussd-simulator-standalone/data/ussd.db` (abra com `sqlite3` ou DB Browser)
- Logs PM2: `C:\Users\User\.pm2\logs\ussd-simulator-out.log`
- Endpoints para testar manualmente: `POST /api/payja/ussd/mark-verified` e `GET /api/sms/logs`.

Notas finais
- Recomenda-se centralizar o emissor de SMS num helper único e aplicar a operação atómica para eliminar duplicados remanescentes.
USSD Simulator (payja-demo/ussd-simulator-standalone)

Overview
- Lightweight USSD simulator that stores customers in a local SQLite/Prisma DB and exposes REST endpoints used by the PayJA backend.
- Primary use: simulate USSD customer registrations and test PayJA ingestion flows.

Main folders / files
- src/
  - app.module.js / main.cjs           -> Express server entrypoints (ESM and CJS variants)
  - routes/                           -> USSD and customers routes
  - modules/payja/                    -> HTTP client & sync service to PayJA
- public/
  - customers.html                    -> Frontend page to list/create customers
- prisma/                             -> Prisma schema (if used) and seed scripts
- simulator-customers.json            -> exported sample data

Ports / URLs
- Default server port: 3001 (configurable via `PORT` env var)
- Key endpoints:
  - POST /api/customers/register      -> register a customer
  - GET  /api/customers               -> list customers
  - GET  /api/payja/ussd/new-customers -> aggregated new customers endpoint (used by PayJA sync)

Prerequisites
- Node.js (>=18)
- npm or yarn
- (optional) pm2 for background runs

Quick setup
1. Install dependencies
   cd ussd-simulator-standalone
   npm install

2. Start locally (dev)
   # ESM server
   node src/app.module.js
   # or CJS server
   node src/main.cjs

3. If using pm2
   npx pm2 start src/app.module.js --name ussd-simulator

4. Access the UI
   Open http://localhost:3001/customers.html

Notes & testing
- Register a customer via the UI or curl to `POST /api/customers/register` with JSON payload.
- The simulator normalizes phone fields (phoneNumber/msisdn) and stores into local DB.
- The simulator can export to JSON (legacy) but the public UI posts directly to the `/register` endpoint.

Example: register payload (POST /api/customers/register)
```json
{
   "phoneNumber": "862345678",
   "name": "Maria Santos Machado",
   "nuit": "100345678",
   "biNumber": "2345678901234M",
   "channel": "USSD"
}
```

Example response
```json
{
   "ok": true,
   "id": "0412007e-c70b-47a2-9e6b-653890013fa2"
}
```

Troubleshooting
- EADDRINUSE: check for existing node processes using port 3001 and kill or restart them.
- If server fails importing payja sync module, ensure `src/modules/payja/payja-sync.service.js` exists.

Optional: Push-to-PayJA
- By default PayJA polls the simulator; you can add a POST from `/register` to PayJA import endpoint for immediate push.

