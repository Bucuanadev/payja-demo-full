# Banco Mock - Simulador de API Bancária

Simulador completo de API bancária para desenvolvimento e testes do PayJA.

## 📋 Visão Geral

O Banco Mock simula as operações de um banco real, incluindo validação de contas, processamento de desembolsos e envio de webhooks.

## 🚀 Componentes

### Backend (Porta 4000)

API REST simulando operações bancárias:
- Validação de contas
- Processamento de desembolsos
- Webhooks assíncronos
- Banco de dados em memória

### Frontend (Porta 4100)

Interface administrativa web:
- Dashboard de transações
- Gestão de contas bancárias
- Visualização de desembolsos
- Logs de webhooks

## 🔧 Configuração

### Backend

```powershell
cd banco-mock/backend
npm install
npm start
```

O servidor inicia em `http://localhost:4000` e se liga a `127.0.0.1` (localhost apenas).

### Frontend

```powershell
cd banco-mock/frontend
npm install

# Desenvolvimento
npm run dev

# Ou via PM2
pm2 start start-pm2.js --name banco-mock-frontend
```

A interface fica disponível em `http://localhost:4100`.

## 📡 APIs Disponíveis

### 1. Validar Conta Bancária

**POST** `/api/accounts/validate`

Verifica se uma conta existe e está ativa.

```json
// Request
{
  "accountNumber": "0123456789",
  "holderName": "João Silva"
}

// Response 200 OK
{
  "valid": true,
  "accountNumber": "0123456789",
  "holderName": "João Silva",
  "accountType": "CHECKING",
  "status": "ACTIVE"
}
```

### 2. Criar Desembolso

**POST** `/api/disbursements`

Solicita um desembolso para uma conta bancária.

```json
// Request
{
  "loanId": "loan-123",
  "accountNumber": "0123456789",
  "amount": 5000.00,
  "reference": "LOAN-001",
  "webhookUrl": "http://localhost:3000/webhook/bank-notification"
}

// Response 202 Accepted
{
  "disbursementId": "disb-abc123",
  "status": "PROCESSING",
  "estimatedTime": "2-5 minutes",
  "createdAt": "2025-12-11T10:00:00Z"
}
```

### 3. Consultar Desembolso

**GET** `/api/disbursements/:id`

Verifica o status de um desembolso.

```json
// Response 200 OK
{
  "id": "disb-abc123",
  "loanId": "loan-123",
  "accountNumber": "0123456789",
  "amount": 5000.00,
  "status": "COMPLETED",
  "processedAt": "2025-12-11T10:05:00Z"
}
```

### 4. Listar Desembolsos

**GET** `/api/disbursements`

Lista todos os desembolsos com filtros.

**Query Parameters:**
- `status` - Filtrar por status (PROCESSING, COMPLETED, FAILED)
- `page` - Página (default: 1)
- `limit` - Itens por página (default: 10)

### 5. Criar Conta Bancária

**POST** `/api/accounts`

Cria uma nova conta bancária (apenas para testes).

```json
// Request
{
  "accountNumber": "9876543210",
  "holderName": "Maria Santos",
  "accountType": "SAVINGS"
}

// Response 201 Created
{
  "id": "acc-123",
  "accountNumber": "9876543210",
  "holderName": "Maria Santos",
  "accountType": "SAVINGS",
  "status": "ACTIVE"
}
```

## 🔔 Webhooks

### Notificação de Desembolso

O Banco Mock envia webhooks quando o desembolso é processado.

**Payload:**
```json
{
  "event": "disbursement.completed",
  "disbursementId": "disb-abc123",
  "loanId": "loan-123",
  "amount": 5000.00,
  "accountNumber": "0123456789",
  "status": "COMPLETED",
  "timestamp": "2025-12-11T10:05:00Z",
  "signature": "sha256-hash-signature"
}
```

**Eventos:**
- `disbursement.processing` - Desembolso iniciado
- `disbursement.completed` - Desembolso concluído
- `disbursement.failed` - Desembolso falhou

### Verificação de Assinatura

```javascript
const crypto = require('crypto');

function verifySignature(payload, signature, secret) {
  const hash = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return hash === signature;
}
```

## 🎨 Interface Frontend

### Dashboard Principal

- **Total de contas**: Número de contas cadastradas
- **Desembolsos hoje**: Quantidade processada hoje
- **Volume**: Valor total desembolsado
- **Taxa de sucesso**: % de desembolsos bem-sucedidos

### Gestão de Contas

- Criar novas contas
- Editar informações
- Ativar/desativar contas
- Ver histórico de transações

### Desembolsos

- Lista de todos os desembolsos
- Filtros por status e data
- Detalhes de cada operação
- Logs de webhooks enviados

### Webhooks

- Lista de webhooks enviados
- Status de entrega
- Payload completo
- Retry manual

## 🧪 Cenários de Teste

### Teste de Sucesso

```bash
curl -X POST http://localhost:4000/api/disbursements \
  -H "Content-Type: application/json" \
  -d '{
    "loanId": "loan-123",
    "accountNumber": "0123456789",
    "amount": 5000,
    "webhookUrl": "http://localhost:3000/webhook/bank-notification"
  }'
```

### Teste de Conta Inválida

```bash
curl -X POST http://localhost:4000/api/accounts/validate \
  -H "Content-Type: application/json" \
  -d '{
    "accountNumber": "9999999999",
    "holderName": "Conta Inexistente"
  }'
```

### Teste de Webhook

O webhook é enviado automaticamente após 2-5 segundos do desembolso.

## 🔧 Configuração Avançada

### Arquivo banco.json

```json
{
  "accounts": [
    {
      "id": "acc-1",
      "accountNumber": "0123456789",
      "holderName": "João Silva",
      "accountType": "CHECKING",
      "status": "ACTIVE",
      "balance": 0
    }
  ],
  "disbursements": []
}
```

### Variáveis de Ambiente

```env
PORT=4000
HOST=127.0.0.1
WEBHOOK_DELAY=3000
WEBHOOK_SECRET=banco-mock-secret
LOG_LEVEL=debug
```

## 📊 Estados de Desembolso

```
PROCESSING → Em processamento (0-5 min)
COMPLETED  → Concluído com sucesso
FAILED     → Falha no processamento
CANCELLED  → Cancelado manualmente
```

## 🚨 Erros Comuns

### 404 - Conta não encontrada

```json
{
  "statusCode": 404,
  "message": "Conta bancária não encontrada"
}
```

### 400 - Dados inválidos

```json
{
  "statusCode": 400,
  "message": "Número de conta inválido"
}
```

### 409 - Desembolso duplicado

```json
{
  "statusCode": 409,
  "message": "Desembolso já processado para este empréstimo"
}
```

## 🔄 Integração com PayJA

### 1. Configurar URL no Backend

```env
# backend/.env
BANCO_MOCK_URL=http://localhost:4000
BANCO_MOCK_API_KEY=mock-api-key
```

### 2. Registrar Webhook URL

O PayJA automaticamente registra a URL de webhook ao solicitar desembolso:

```
http://localhost:3000/webhook/bank-notification
```

### 3. Processar Notificações

O backend PayJa recebe e processa os webhooks automaticamente.

## 📈 Monitoramento

### Logs

```powershell
# Logs do backend
pm2 logs banco-mock

# Logs do frontend
pm2 logs banco-mock-frontend
```

### Métricas

Disponíveis na interface frontend:
- Total de desembolsos
- Taxa de sucesso
- Tempo médio de processamento
- Volume por dia/mês

## 🛠️ Desenvolvimento

### Adicionar Nova Rota

```javascript
// src/routes/exemplo.js
router.post('/api/exemplo', (req, res) => {
  // Lógica aqui
  res.json({ success: true });
});
```

### Modificar Tempo de Webhook

```javascript
// src/index.js
const WEBHOOK_DELAY = 3000; // milissegundos
```

## 🔐 Segurança

⚠️ **Apenas para desenvolvimento!**

- Não usar em produção
- Sem autenticação real
- Dados em memória (perdidos ao reiniciar)
- CORS liberado para desenvolvimento

## 📦 Scripts Disponíveis

```json
{
  "start": "node src/index.js",
  "dev": "nodemon src/index.js",
  "test": "jest"
}
```

---

**Banco Mock v1.0 - Simulador para Desenvolvimento**
