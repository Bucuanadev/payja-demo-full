# PayJA Demo - Serviços Principais

Monorepo com os serviços usados nas demos PayJA. Serviços críticos:
- payja-backend (NestJS + Prisma)
- ussd-simulator (Express + Prisma + frontend embarcado)
- banco-mock-backend (API simulada)
- banco-mock-frontend (painel do banco)
- payja-desktop (painel web/electron)

## Requisitos
- Node.js 18+
- npm
- PM2 instalado globalmente: `npm install -g pm2`

## Instalação Rápida
Execute na raiz do repo:

```powershell
# Backend PayJA
cd backend
npm install
npm run prisma:generate
npm run build

# USSD Simulator
cd ../ussd-simulator-standalone
npm install

# Banco Mock (API)
cd ../banco-mock/backend
npm install

# Banco Mock (Frontend)
cd ../frontend
npm install

# Desktop (painel)
cd ../../desktop
npm install
```

## Subir tudo com PM2
Na raiz do repo (após instalar deps e build do backend):

```powershell
pm2 start pm2.payja-backend.config.js         # porta 3000
pm2 start pm2.ussd-simulator.config.js        # porta 3001
pm2 start pm2.banco-mock-backend.config.js    # porta 4500
pm2 start pm2.frontends.config.js             # banco frontend 4100, desktop 5173
```

Comandos úteis:
- `pm2 list` para status
- `pm2 logs <name>` para logs
- `pm2 restart <name>` ou `pm2 restart all`
- `pm2 stop <name>` / `pm2 delete <name>`

## Portas e Endpoints Principais
- payja-backend: 3000 (NestJS API)
- ussd-simulator: 3001 (API + páginas public/index.html, customers.html)
- banco-mock-backend: 4500 (mock bancário)
- banco-mock-frontend: 4100 (painel mock)
- payja-desktop: 5173 (versão web da app desktop)

## READMEs por Serviço
- backend: ./backend/README.md
- ussd-simulator-standalone: ./ussd-simulator-standalone/README.md
- banco-mock backend: ./banco-mock/backend/README.md
- banco-mock frontend: ./banco-mock/frontend/README.md
- desktop: ./desktop/README.md
