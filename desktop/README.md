# payja-desktop
Painel React/Vite com alvo Electron; também roda como SPA na porta 5173.

## Requisitos
- Node.js 18+
- npm

## Setup
```powershell
cd desktop
npm install
```

## Executar
- Dev web: `npm run dev` (porta 5173)
- Dev Electron: `npm run electron:dev` (abre Electron após Vite estar pronto)
- Build web: `npm run build`
- PM2 (modo web): `pm2 start ../pm2.frontends.config.js` (entrada `payja-desktop`)

## Notas
- Configuração Electron está em `src/electron/` e build com `npm run electron:build`.
