PayJA Frontend — documentação actualizada

Resumo
- Frontend admin (React + Vite + Ant Design) usado para gerir clientes e empréstimos. O cliente comunica com o backend PayJA em `http://localhost:3000/api/v1`.

Estrutura principal
- `desktop/src/pages/CustomersPage.jsx` — listagem e modal de cliente
- `desktop/src/services/api.js` — instância axios apontada ao backend
- `desktop/src/electron/` — wrapper/electron (opcional)

Execução local
1) Instalar dependências

```powershell
cd desktop
npm install
```

2) Iniciar servidor de desenvolvimento (Vite)

```powershell
npm run dev
# Abrir: http://localhost:5173
```

3) Executar Electron (opcional)

```powershell
npm run electron:dev
```

Integração com Backend
- As chamadas do frontend usam `http://localhost:3000/api/v1` por defeito. Configure env vars caso o backend esteja noutro host/porta.
- O cliente lê o token de autenticação de `localStorage['payja-auth']` — garanta login válido antes de testar.

Debug & troubleshooting
- 401: token em `localStorage` ausente ou expirado — faça login novamente.
- Campos vazios na lista: abrir `http://localhost:3000/api/v1/admin/customers` no browser para validar payload e nomes de campos.
- Se alterações de backend não aparecen na UI, reinicie o processo `payja-frontend` no PM2:

```powershell
npx pm2 restart payja-frontend --update-env
```

Nota sobre testes E2E e SMS
- Ao testar o fluxo de verificação, verifique também o simulador: `GET http://localhost:3001/api/sms/logs` e os logs do simulador (`pm2 logs ussd-simulator`) para confirmar envio único de SMS.
PayJA Frontend (payja-demo/desktop)

Overview
- React + Ant Design (Vite) admin frontend used to manage customers and loans.
- Uses internal `api` service configured to `http://localhost:3000/api/v1`.
- There is also an Electron wrapper for desktop usage in `desktop/src/electron`.

Main folders / files
- src/
  - pages/CustomersPage.jsx            -> customers list and modal (main view)
  - services/api.js                    -> axios instance pointing to backend
  - App.jsx, main.jsx                  -> app bootstrap and routes
  - electron/                          -> electron main file (if running desktop)

Ports / URLs
- Dev server (Vite): http://localhost:5173
- Backend API: http://localhost:3000/api/v1

Prerequisites
- Node.js (>=18)
- npm or yarn
- If running desktop: Electron installed via dev script

Quick setup
1. Install dependencies
   cd desktop
   npm install

2. Start dev server
   npm run dev
   # Open http://localhost:5173/customers

3. Run Electron (optional)
   npm run electron:dev

4. If running under pm2 (production-like), restart the `payja-frontend` process so it picks up new builds:
   npx pm2 restart payja-frontend --update-env

Notes & testing
- The frontend calls the admin API to list customers; ensure the backend is running on port 3000 and accessible.
- If the UI shows empty fields, open browser console and inspect `http://localhost:3000/api/v1/admin/customers` JSON to confirm field names. Update `pages/CustomersPage.jsx` mapping if necessary.

Example backend payload (first customers)
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
   }
]
```

Note: the admin API requires authentication; the frontend's `api` client attaches the token from `localStorage['payja-auth']`.

Troubleshooting
- 401 responses: login token missing — clear `localStorage['payja-auth']` and re-login.
- Invalid Date: backend returned `createdAt` in an unexpected format; frontend code normalizes dates before rendering.
- If page not updating after backend changes, restart pm2 process for `payja-frontend`.

