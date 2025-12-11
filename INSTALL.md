# Guia de Instalação - PayJA

Este guia detalha todos os passos necessários para configurar o ambiente PayJA do zero.

## 📋 Pré-requisitos

### Software Necessário

- **Node.js** v18.0.0 ou superior
- **npm** v9.0.0 ou superior
- **Git** (para controle de versão)
- **PowerShell** (Windows) ou **Bash** (Linux/Mac)
- **VS Code** (recomendado)

### Verificar Instalações

```powershell
node --version    # Deve retornar v18.x.x ou superior
npm --version     # Deve retornar v9.x.x ou superior
git --version     # Qualquer versão recente
```

## 🚀 Instalação Passo a Passo

### 1. Clonar o Repositório

```powershell
cd C:\Users\User\Downloads\ussd
git clone https://github.com/Bucuanadev/payja-ussd.git payja-demo
cd payja-demo
```

### 2. Instalar PM2 Globalmente

```powershell
npm install -g pm2
pm2 --version
```

### 3. Configurar Backend

```powershell
cd backend

# Instalar dependências
npm install

# Gerar cliente Prisma
npx prisma generate

# Executar migrations
npx prisma migrate deploy

# Seed do banco de dados (opcional)
npx prisma db seed

# Compilar TypeScript
npm run build
```

### 4. Configurar Banco Mock

```powershell
# Backend do banco
cd ../banco-mock/backend
npm install

# Frontend do banco
cd ../frontend
npm install
```

### 5. Configurar Desktop

```powershell
cd ../../desktop
npm install
```

### 6. Configurar USSD Simulator (Opcional)

```powershell
cd ../../ussd-simulator-standalone
npm install

# Copiar arquivo de configuração
Copy-Item .env.example .env
```

## 🔧 Configuração de Variáveis de Ambiente

### Backend - `backend/.env`

```env
# Database
DATABASE_URL="file:./dev.db"

# JWT
JWT_SECRET=payja-secret-2024-production
JWT_EXPIRATION=24h

# Server
PORT=3000
NODE_ENV=development

# Banco Mock
BANCO_MOCK_URL=http://localhost:4000
BANCO_MOCK_API_KEY=mock-api-key

# SMS (opcional)
SMS_PROVIDER=twilio
SMS_API_KEY=
```

### USSD Simulator - `ussd-simulator-standalone/.env`

```env
# Server Configuration
PORT=3001
NODE_ENV=development
LOG_LEVEL=debug

# PayJA Integration
PAYJA_API_URL=http://localhost:3000
PAYJA_API_KEY=

# Database
DATABASE_PATH=./data/ussd.db
DATABASE_BACKUP_PATH=./data/backups

# USSD Configuration
USSD_TIMEOUT=60000
USSD_MAX_SESSIONS=1000
```

## 🎯 Iniciar Serviços via PM2

### Iniciar Backend PayJA

```powershell
pm2 start "node dist/src/main.js" `
  --name payja-backend `
  --cwd "C:\Users\User\Downloads\ussd\payja-demo\backend"
```

### Iniciar Banco Mock Backend

```powershell
pm2 start "npm start" `
  --name banco-mock `
  --cwd "C:\Users\User\Downloads\ussd\payja-demo\banco-mock\backend"
```

### Iniciar Banco Mock Frontend

```powershell
pm2 start start-pm2.js `
  --name banco-mock-frontend `
  --cwd "C:\Users\User\Downloads\ussd\payja-demo\banco-mock\frontend"
```

### Iniciar PayJA Desktop

```powershell
pm2 start start-pm2.cjs `
  --name payja-desktop `
  --cwd "C:\Users\User\Downloads\ussd\payja-demo\desktop"
```

### Iniciar USSD Simulator (Opcional)

```powershell
pm2 start start-pm2.cjs `
  --name ussd-simulator `
  --cwd "C:\Users\User\Downloads\ussd\ussd-simulator-standalone"
```

## ✅ Verificação da Instalação

### 1. Verificar Status dos Serviços

```powershell
pm2 list
```

Todos os serviços devem estar com status **online**.

### 2. Verificar Portas

```powershell
netstat -ano | findstr "LISTENING" | findstr ":3000 :3001 :4000 :4100 :5173"
```

Deve retornar 5 linhas mostrando as portas em LISTENING.

### 3. Testar APIs

```powershell
# Testar Backend PayJA
curl http://localhost:3000

# Testar Banco Mock
curl http://localhost:4000

# Testar USSD Simulator
curl http://localhost:3001
```

### 4. Acessar Interfaces

- **Banco Mock Frontend**: http://localhost:4100
- **PayJA Desktop**: http://localhost:5173

## 🔄 Salvar Configuração PM2

Para que os serviços iniciem automaticamente:

```powershell
# Salvar lista de processos
pm2 save

# Configurar startup (Windows)
pm2 startup
```

## 🐛 Resolução de Problemas

### Porta já em uso

```powershell
# Verificar processo usando a porta
netstat -ano | findstr ":3000"

# Matar processo (substitua PID)
taskkill /PID [PID] /F
```

### Serviço não inicia

```powershell
# Ver logs detalhados
pm2 logs [nome-do-servico] --lines 100

# Reiniciar serviço específico
pm2 restart [nome-do-servico]

# Deletar e recriar
pm2 delete [nome-do-servico]
# Executar novamente o comando pm2 start
```

### Erro de compilação TypeScript

```powershell
cd backend

# Limpar cache
rm -rf node_modules dist
npm install

# Recompilar
npm run build
```

### Banco de dados corrompido

```powershell
cd backend

# Resetar banco
rm prisma/dev.db

# Recriar
npx prisma migrate deploy
npx prisma db seed
```

## 📚 Próximos Passos

Após a instalação bem-sucedida:

1. ✅ Criar usuário administrador
2. ✅ Configurar banco parceiro
3. ✅ Testar fluxo completo de empréstimo
4. ✅ Configurar webhooks
5. ✅ Revisar logs e monitoramento

## 🆘 Suporte

Se encontrar problemas:

1. Verificar logs: `pm2 logs`
2. Consultar documentação específica em `/docs`
3. Contactar equipe de desenvolvimento

---

**Instalação completa! 🎉**
