PayJA Backend — documentação actualizada

Resumo
- Backend PayJA implementado em NestJS + Prisma; responsável por ingestão de clientes, administração e fluxo de empréstimos.

Componentes chave
- `backend/src/modules/payja-sync/` — serviço que periodicamente poll/ingesta clientes do USSD Simulator.
- `backend/src/modules/admin/` — endpoints usados pela UI para listar/editar clientes e gerir empréstimos.
- `prisma/` — esquema e migrations (use `npx prisma migrate dev` em dev).

Execução local rápida
1) Instalar dependências e gerar Prisma Client

```powershell
cd backend
npm install
npx prisma generate
npm run build
```

2) Configurar base de dados
- Configure `DATABASE_URL` em `prisma/.env` (Postgres recomendado para produção; SQLite aceitável para testes locais).
- Se usar migrations: `npx prisma migrate dev --name init`

3) Executar

```powershell
npm run start:dev
# ou com PM2 (usar dist build):
npx pm2 start dist/src/main.js --name payja-backend --update-env
```

Endpoints importantes
- `GET /api/v1/admin/customers` — lista clientes
- `GET /api/v1/admin/customers/:id` — detalhes de cliente
- `POST /api/v1/integrations/ussd/reconcile-customers` — trigger manual de reconciliação

PayJA Sync (comportamento e configuração)
- O `payja-sync` por defeito consulta `http://localhost:3001/api/payja/ussd/new-customers` para obter clientes não sincronizados.
- Ajuste a URL via env `PAYJA_SYNC_URL` ou configuração equivalente.
- O sync process formata os clientes e insere/atualiza o PayJA DB; também marca clientes como sincronizados no simulador quando o fluxo é bem-sucedido.

Notas sobre duplicação de SMS (contexto com o simulator)
- O simulador envia SMS de verificação/eligibilidade a partir de múltiplos pontos (poll, sync, compat endpoint). Para evitar duplicações, a correção recomendada é que o simulador implemente um `UPDATE` atómico antes de enviar (ver `USSD-SIMULATOR.md`).

Debug & troubleshooting
- Ver logs do backend: `pm2 logs payja-backend` ou `npm run start:dev` output.
- Se o sync não retornar clientes, verifique: `PAYJA_SYNC_URL`, estado do simulador (porta 3001) e `GET /api/payja/ussd/new-customers`.
- Quando testar reconciliação, use a chamada manual:

```bash
curl -X POST http://localhost:3000/api/v1/integrations/ussd/reconcile-customers
```

Onde procurar código relevante
- `backend/src/modules/payja-sync/payja-sync.service.ts` (lógica de ingestão)
- `backend/src/modules/admin/` (endpoints UI)
PayJA Backend (payja-demo/backend)

Overview
- NestJS + Prisma backend implementing PayJA business logic and an admin API.
- Polls the USSD simulator for new customers via a payja-sync service (default polling ~15s), ingests customers into PayJA DB.

Main folders / files
- src/
  - main.ts                           -> application bootstrap
  - modules/payja-sync/               -> controller & service that polls/imports simulator data
  - modules/admin/                    -> admin API endpoints (customer listing, details)
  - modules/                          -> other domain modules (scoring, loans, etc.)
- scripts/
  - list-customers.js                 -> quick script to inspect DB
- prisma/
  - schema.prisma, migrations, seed   -> Prisma schema and seeds

Ports / URLs
- Default backend port: 3000
- Base API: http://localhost:3000/api/v1
- Important endpoints:
  - GET  /api/v1/admin/customers       -> list customers (used by PayJA frontend)
  - GET  /api/v1/admin/customers/:id   -> customer details used by frontend modal
  - (internal) sync endpoints / integrations
  - POST /api/v1/integrations/ussd/reconcile-customers -> trigger reconciliation between PayJA customers and bank records
  
  - Manual reconciliation: you can manually trigger the reconciliation (PayJA compares `nuit`, `bi`, `nome` and fills missing fields and sets `verified=true`) with:
    ```bash
    curl -X POST http://localhost:3000/api/v1/integrations/ussd/reconcile-customers
    ```

Example response (GET /api/v1/admin/customers)
```json
[
  {
    "id": "0412007e-c70b-47a2-9e6b-653890013fa2",
    "phoneNumber": "862345678",
    "name": "Maria Santos Machado",
    "nuit": "100345678",
    "verified": false,
    "blocked": false,
    "createdAt": "2025-12-27T20:45:01.371Z",
    "loans": []
  },
  {
    "id": "7bd50f8b-ef39-4978-b905-0a10e06ae2fd",
    "phoneNumber": "863456789",
    "name": "Carlos Alberto Mondlane",
    "nuit": "100456789",
    "verified": false,
    "blocked": false,
    "createdAt": "2025-12-27T21:28:55.968Z",
    "loans": []
  }
]
```

Prerequisites
- Node.js (>=18)
- npm or yarn
- Postgres recommended for production; projects may use SQLite for local dev
- Prisma CLI for migrations

Quick setup
1. Install dependencies
   cd backend
   npm install

2. Configure database
   - Edit `prisma/.env` or `DATABASE_URL` to point to your Postgres/SQLite DB
   - Run migrations (if using Prisma migrations):
     npx prisma migrate dev --name init
   - Seed data (if seed script exists):
     node prisma/seed.js

3. Start backend
   npm run start:dev
   # or pm2
   npx pm2 start dist/src/main.js --name payja-backend --update-env

4. Verify
   - Visit http://localhost:3000/api/v1/admin/customers to see customers JSON

Notes & testing
- The `payja-sync` service periodically polls the simulator (default URL http://localhost:3001/api/payja/ussd/new-customers). Adjust `PAYJA_SYNC_URL`/env if needed.
- Use `backend/scripts/list-customers.js` to quickly check the DB contents.

Troubleshooting
- CORS: `main.ts` allows origins used by the frontend (http://localhost:5173). Ensure configured.
- Missing Prisma client: run `npx prisma generate` after editing `schema.prisma`.
- PM2: when running under PM2 use `--update-env` to pick new env vars after edits.

