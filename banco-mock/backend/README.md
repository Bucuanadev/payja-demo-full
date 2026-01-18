# banco-mock-backend
API Express simples que simula respostas do banco.

## Requisitos
- Node.js 18+
- npm

## Setup
```powershell
cd banco-mock/backend
npm install
```

## Executar
- Desenvolvimento: `npm run dev` (nodemon em src/index.js)
- Produção local: `npm start`
- PM2: `pm2 start ../../pm2.banco-mock-backend.config.js` (porta 4500 por default)

## Endpoints
Confira `src/index.js` para os endpoints de validação/transferência usados pelo PayJA.
