# payja-backend
NestJS + Prisma API usada como core da demo.

## Requisitos
- Node.js 18+
- npm
- Banco: SQLite (default em prisma/schema.prisma)

## Setup
```powershell
cd backend
npm install
npm run prisma:generate
# se precisar migrar/seed (opcional): npm run prisma:migrate
```
Crie um `.env` com pelo menos:
```
DATABASE_URL="file:./dev.db"
PORT=3000
```

## Executar
- Desenvolvimento: `npm run start:dev`
- Produção local (PM2):
  1. `npm run build`
  2. `pm2 start ../pm2.payja-backend.config.js`

PM2 usa `dist/src/main.js`, então sempre rode `npm run build` antes de reiniciar pelo PM2.

## Scripts úteis
- `npm run prisma:studio` para inspecionar o DB
- `npm run db:seed` se o seed estiver configurado
- `npm run lint` para checar lint
