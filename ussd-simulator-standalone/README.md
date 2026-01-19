# ussd-simulator-standalone
Servidor Express com Prisma/SQLite que expõe a API do simulador USSD e serve o frontend em `public/` (smartphone UI + painel customers.html).

## Requisitos
- Node.js 18+
- npm

## Setup
```powershell
cd ussd-simulator-standalone
npm install
# opcional: copie .env.example para .env e ajuste PORT (default 3001)
```

## Executar
- Desenvolvimento: `npm run dev` (nodemon em src/main.js)
- Produção local: `npm start` (usa dist/main.js depois de `npm run build`)
- PM2: `pm2 start ../pm2.ussd-simulator.config.js`

## Notas
- Banco local SQLite fica em `data/ussd-react.db` (via Prisma).
- Endpoints úteis: `/api/health`, `/api/customers`, `/api/ussd/...`, `/api/sms/logs`.
- Frontend: abra `http://155.138.227.26:3001/` (smartphone) ou `http://155.138.227.26:3001/customers.html`.
