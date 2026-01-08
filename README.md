# PayJA Demo Full Project

Este repositório contém os três projetos principais do ecossistema PayJA:
1.  **PayJA (Backend & Frontend)**
2.  **USSD Simulator**
3.  **Banco Mock (Backend & Frontend)**

## Estrutura do Projeto

- `backend/`: API principal do PayJA (NestJS).
- `desktop/`: Frontend principal do PayJA (Vite/React).
- `ussd-simulator-standalone/`: Simulador de USSD (Node.js/Express).
- `banco-mock/backend/`: API do Banco Mock.
- `banco-mock/frontend/`: Frontend do Banco Mock.

## Pré-requisitos

- Node.js (v18 ou superior)
- npm ou yarn
- PM2 (para gerenciamento de processos)

## Instruções de Deploy

### 1. Clonar o Repositório
```bash
git clone https://github.com/Bucuanadev/payja-demo-full.git
cd payja-demo-full
```

### 2. Instalar Dependências
Você deve instalar as dependências em cada pasta do projeto:

```bash
# PayJA Backend
cd backend && npm install && npx prisma generate && cd ..

# PayJA Frontend
cd desktop && npm install && cd ..

# USSD Simulator
cd ussd-simulator-standalone && npm install && cd ..

# Banco Mock Backend
cd banco-mock/backend && npm install && cd ..

# Banco Mock Frontend
cd banco-mock/frontend && npm install && cd ..
```

### 3. Iniciar com PM2
O projeto já inclui arquivos de configuração do PM2 para facilitar a execução:

```bash
pm2 start pm2.ussd-simulator.config.js
pm2 start pm2.payja-backend.config.js
pm2 start pm2.payja-frontend.config.js
pm2 start pm2.banco-mock-backend.config.js
pm2 start pm2.banco-mock-frontend.config.js
```

### 4. Portas Utilizadas
Certifique-se de que as seguintes portas estão abertas no seu firewall:
- **3000**: PayJA Backend
- **5173**: PayJA Frontend
- **3001**: USSD Simulator
- **4500**: Banco Mock Backend
- **4100**: Banco Mock Frontend

## Manutenção
Para visualizar os logs:
```bash
pm2 logs
```

Para salvar a lista de processos para reinicialização automática:
```bash
pm2 save
```
