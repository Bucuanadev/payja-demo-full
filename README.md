# PayJA - Plataforma de Microcrédito Digital

Sistema completo de microcrédito digital integrado com operadoras móveis e bancos parceiros.

## 🚀 Visão Geral

O PayJA é uma plataforma de microcrédito que permite aos clientes solicitarem empréstimos através de diferentes canais (web, mobile, USSD), com análise de crédito automatizada e integração com bancos parceiros para desembolso.

## 📦 Arquitetura do Sistema

O projeto é composto por 5 serviços independentes gerenciados via PM2:

### Serviços Principais

| Serviço | Porta | Descrição |
|---------|-------|-----------|
| **PayJA Backend** | 3000 | API principal (NestJS + Prisma + SQLite) |
| **Banco Mock Backend** | 4000 | Simulador de API bancária |
| **Banco Mock Frontend** | 4100 | Interface administrativa do banco |
| **PayJA Desktop** | 5173 | Aplicação Electron para gestão |
| **USSD Simulator** | 3001 | Simulador USSD standalone |

## 🛠️ Tecnologias

- **Backend**: NestJS, TypeScript, Prisma ORM, SQLite
- **Frontend**: React, Vite, TailwindCSS
- **Desktop**: Electron
- **Process Manager**: PM2
- **APIs**: RESTful, Webhooks

## ⚡ Início Rápido

### Pré-requisitos

- Node.js 18+
- npm ou yarn
- PM2 (instalado globalmente)

### Instalação

```powershell
# Instalar PM2 globalmente
npm install -g pm2

# Instalar dependências do backend
cd backend
npm install

# Compilar backend
npm run build

# Instalar dependências do banco-mock
cd ../banco-mock/backend
npm install

cd ../frontend
npm install

# Instalar dependências do desktop
cd ../../desktop
npm install

# Instalar dependências do USSD simulator (opcional)
cd ../../ussd-simulator-standalone
npm install
```

### Iniciar Todos os Serviços

```powershell
# Backend PayJA (porta 3000)
pm2 start "node dist/src/main.js" --name payja-backend --cwd "C:\caminho\para\payja-demo\backend"

# Banco Mock Backend (porta 4000)
pm2 start "npm start" --name banco-mock --cwd "C:\caminho\para\payja-demo\banco-mock\backend"

# Banco Mock Frontend (porta 4100)
pm2 start start-pm2.js --name banco-mock-frontend --cwd "C:\caminho\para\payja-demo\banco-mock\frontend"

# PayJA Desktop (porta 5173)
pm2 start start-pm2.cjs --name payja-desktop --cwd "C:\caminho\para\payja-demo\desktop"

# USSD Simulator (porta 3001) - Opcional
pm2 start start-pm2.cjs --name ussd-simulator --cwd "C:\caminho\para\ussd-simulator-standalone"
```

### Gerenciar Serviços

```powershell
# Ver status de todos os serviços
pm2 list

# Verificar logs
pm2 logs [nome-do-servico]

# Reiniciar todos os serviços
pm2 restart all

# Parar todos os serviços
pm2 stop all

# Remover serviço
pm2 delete [nome-do-servico]
```

## 📚 Estrutura do Projeto

```
payja-demo/
├── backend/                    # API principal NestJS
│   ├── prisma/                # Schema e migrations
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/         # Autenticação
│   │   │   ├── loans/        # Gestão de empréstimos
│   │   │   ├── scoring/      # Análise de crédito
│   │   │   ├── decision/     # Motor de decisão
│   │   │   └── ...
│   │   └── main.ts
│   └── package.json
│
├── banco-mock/
│   ├── backend/              # Simulador de API bancária
│   └── frontend/             # Interface administrativa
│
├── desktop/                   # Aplicação Electron
│   ├── src/
│   │   ├── pages/           # Páginas da aplicação
│   │   └── components/      # Componentes React
│   └── start-pm2.cjs        # Wrapper PM2
│
└── simulador/                 # Simulador USSD (legado)
```

## 🔌 APIs Principais

### Backend PayJA (porta 3000)

- `POST /auth/login` - Autenticação
- `POST /loans/apply` - Solicitar empréstimo
- `GET /loans` - Listar empréstimos
- `GET /customers` - Listar clientes
- `POST /scoring/analyze` - Análise de crédito

### Banco Mock (porta 4000)

- `POST /api/accounts/validate` - Validar conta bancária
- `POST /api/disbursements` - Efetuar desembolso
- `GET /api/disbursements/:id` - Consultar status
- `POST /webhook/notifications` - Receber notificações

## 🔐 Variáveis de Ambiente

### Backend (.env)

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET=seu-secret-aqui
PORT=3000
BANCO_MOCK_URL=http://localhost:4000
```

### USSD Simulator (.env)

```env
PORT=3001
PAYJA_API_URL=http://localhost:3000
DATABASE_PATH=./data/ussd.db
```

## 🧪 Testes

```powershell
# Backend
cd backend
npm test

# Frontend
cd banco-mock/frontend
npm test
```

## 📖 Documentação Adicional

- [Integração com Bancos](./docs/INTEGRACAO_BANCOS.md)
- [Fluxo de Crédito](./docs/FLUXO_CREDITO.md)
- [APIs Webhook](./docs/WEBHOOKS.md)

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/NovaFeature`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova feature'`)
4. Push para a branch (`git push origin feature/NovaFeature`)
5. Abra um Pull Request

## 📝 Licença

Este projeto é proprietário e confidencial.

## 👥 Suporte

Para questões ou suporte, contacte a equipe de desenvolvimento.

---

**Desenvolvido com ❤️ pela equipe Bucuanadev**
