# banco-mock-frontend
Painel React/Vite para operar o banco mock.

## Requisitos
- Node.js 18+
- npm

## Setup
```powershell
cd banco-mock/frontend
npm install
```

## Executar
- Desenvolvimento: `npm run dev -- --host --port 4100`
- Build: `npm run build`
- Preview: `npm run preview`
- PM2: `pm2 start ../../pm2.frontends.config.js` (usa o entry configurado para `banco-mock-frontend`)
