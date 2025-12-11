# API Documentation - PayJA

Documentação completa das APIs do sistema PayJA.

## 🌐 Base URLs

- **PayJA Backend**: `http://localhost:3000`
- **Banco Mock**: `http://localhost:4000`
- **USSD Simulator**: `http://localhost:3001`

## 🔐 Autenticação

A maioria dos endpoints requer autenticação via JWT.

### Headers Necessários

```http
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

### Obter Token

**POST** `/auth/login`

```json
{
  "username": "admin",
  "password": "senha123"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-id",
    "username": "admin",
    "role": "ADMIN"
  }
}
```

---

## 👤 Auth Module

### Login

**POST** `/auth/login`

Autentica usuário e retorna token JWT.

**Request:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response:** `200 OK`
```json
{
  "access_token": "string",
  "user": {
    "id": "string",
    "username": "string",
    "role": "string"
  }
}
```

### Logout

**POST** `/auth/logout`

Invalida o token atual.

**Response:** `200 OK`

### Refresh Token

**POST** `/auth/refresh`

Renova o token de acesso.

**Response:** `200 OK`
```json
{
  "access_token": "string"
}
```

---

## 💰 Loans Module

### Solicitar Empréstimo

**POST** `/loans/apply`

Cria uma nova solicitação de empréstimo.

**Request:**
```json
{
  "customerId": "string",
  "amount": 5000.00,
  "termMonths": 12,
  "purpose": "string"
}
```

**Response:** `201 Created`
```json
{
  "id": "loan-id",
  "customerId": "customer-id",
  "amount": 5000.00,
  "interestRate": 2.5,
  "termMonths": 12,
  "status": "PENDING",
  "createdAt": "2025-12-11T10:00:00Z"
}
```

### Listar Empréstimos

**GET** `/loans`

Lista empréstimos com filtros e paginação.

**Query Parameters:**
- `status` - Filtrar por status (PENDING, APPROVED, etc.)
- `customerId` - Filtrar por cliente
- `page` - Número da página (default: 1)
- `limit` - Itens por página (default: 10)

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "string",
      "customer": {
        "id": "string",
        "name": "string"
      },
      "amount": 5000.00,
      "status": "APPROVED",
      "createdAt": "2025-12-11T10:00:00Z"
    }
  ],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 10,
    "totalPages": 10
  }
}
```

### Obter Empréstimo

**GET** `/loans/:id`

Retorna detalhes de um empréstimo específico.

**Response:** `200 OK`
```json
{
  "id": "string",
  "customerId": "string",
  "customer": {
    "name": "string",
    "phoneNumber": "string"
  },
  "amount": 5000.00,
  "interestRate": 2.5,
  "termMonths": 12,
  "status": "DISBURSED",
  "approvedAt": "2025-12-11T10:05:00Z",
  "disbursedAt": "2025-12-11T10:10:00Z",
  "payments": [],
  "createdAt": "2025-12-11T10:00:00Z"
}
```

### Aprovar Empréstimo

**POST** `/loans/:id/approve`

Aprova manualmente um empréstimo.

**Request:**
```json
{
  "approvedAmount": 4500.00,
  "interestRate": 2.5,
  "notes": "string"
}
```

**Response:** `200 OK`

### Rejeitar Empréstimo

**POST** `/loans/:id/reject`

Rejeita um empréstimo.

**Request:**
```json
{
  "reason": "string"
}
```

**Response:** `200 OK`

---

## 🎯 Scoring Module

### Analisar Crédito

**POST** `/scoring/analyze`

Realiza análise de crédito de um cliente.

**Request:**
```json
{
  "customerId": "string",
  "requestedAmount": 5000.00
}
```

**Response:** `200 OK`
```json
{
  "score": 750,
  "risk": "LOW",
  "approved": true,
  "maxAmount": 10000.00,
  "recommendedRate": 2.5,
  "factors": [
    {
      "name": "payment_history",
      "score": 100,
      "weight": 0.35
    },
    {
      "name": "credit_utilization",
      "score": 85,
      "weight": 0.30
    }
  ]
}
```

### Histórico de Análises

**GET** `/scoring/history/:customerId`

Retorna histórico de análises de crédito.

**Response:** `200 OK`
```json
{
  "analyses": [
    {
      "id": "string",
      "score": 750,
      "risk": "LOW",
      "createdAt": "2025-12-11T10:00:00Z"
    }
  ]
}
```

---

## 👥 Customers Module

### Criar Cliente

**POST** `/customers`

Registra um novo cliente.

**Request:**
```json
{
  "name": "João Silva",
  "phoneNumber": "+258840000000",
  "idDocument": "123456789",
  "email": "joao@example.com",
  "address": "string",
  "bankAccount": "0123456789"
}
```

**Response:** `201 Created`
```json
{
  "id": "customer-id",
  "name": "João Silva",
  "phoneNumber": "+258840000000",
  "createdAt": "2025-12-11T10:00:00Z"
}
```

### Listar Clientes

**GET** `/customers`

Lista todos os clientes.

**Query Parameters:**
- `search` - Busca por nome ou telefone
- `page` - Número da página
- `limit` - Itens por página

**Response:** `200 OK`

### Obter Cliente

**GET** `/customers/:id`

Retorna detalhes de um cliente.

**Response:** `200 OK`
```json
{
  "id": "string",
  "name": "string",
  "phoneNumber": "string",
  "idDocument": "string",
  "bankAccount": "string",
  "creditLimit": 15000.00,
  "loans": [],
  "createdAt": "2025-12-11T10:00:00Z"
}
```

### Atualizar Cliente

**PATCH** `/customers/:id`

Atualiza informações do cliente.

**Request:**
```json
{
  "name": "string",
  "phoneNumber": "string",
  "bankAccount": "string"
}
```

**Response:** `200 OK`

---

## 🏦 Banco Mock API

### Validar Conta Bancária

**POST** `/api/accounts/validate`

Valida se uma conta bancária existe e está ativa.

**Request:**
```json
{
  "accountNumber": "0123456789",
  "holderName": "João Silva"
}
```

**Response:** `200 OK`
```json
{
  "valid": true,
  "accountNumber": "0123456789",
  "holderName": "João Silva",
  "accountType": "CHECKING"
}
```

### Solicitar Desembolso

**POST** `/api/disbursements`

Solicita um desembolso para uma conta.

**Request:**
```json
{
  "loanId": "loan-id",
  "accountNumber": "0123456789",
  "amount": 5000.00,
  "reference": "LOAN-001",
  "webhookUrl": "http://localhost:3000/webhook/bank-notification"
}
```

**Response:** `202 Accepted`
```json
{
  "disbursementId": "disb-id",
  "status": "PROCESSING",
  "estimatedTime": "2-5 minutes"
}
```

### Consultar Status de Desembolso

**GET** `/api/disbursements/:id`

Verifica o status de um desembolso.

**Response:** `200 OK`
```json
{
  "id": "disb-id",
  "loanId": "loan-id",
  "amount": 5000.00,
  "status": "COMPLETED",
  "processedAt": "2025-12-11T10:15:00Z"
}
```

### Listar Desembolsos

**GET** `/api/disbursements`

Lista todos os desembolsos.

**Response:** `200 OK`

---

## 🔔 Webhooks

### Notificação de Desembolso

**POST** `/webhook/bank-notification`

Webhook enviado pelo banco quando desembolso é processado.

**Request:**
```json
{
  "event": "disbursement.completed",
  "disbursementId": "disb-id",
  "loanId": "loan-id",
  "amount": 5000.00,
  "status": "COMPLETED",
  "timestamp": "2025-12-11T10:15:00Z",
  "signature": "hash-signature"
}
```

**Response:** `200 OK`

---

## ⚠️ Códigos de Erro

### Formato de Erro

```json
{
  "statusCode": 400,
  "message": "Descrição do erro",
  "error": "Bad Request"
}
```

### Códigos HTTP

- `200` - OK
- `201` - Created
- `204` - No Content
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `422` - Unprocessable Entity
- `500` - Internal Server Error

---

## 📊 Rate Limiting

- **Limite**: 100 requisições por minuto por IP
- **Header**: `X-RateLimit-Remaining`

---

## 🧪 Exemplos de Uso

### Fluxo Completo de Empréstimo

```bash
# 1. Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "senha123"}'

# 2. Criar cliente
curl -X POST http://localhost:3000/customers \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "João Silva",
    "phoneNumber": "+258840000000",
    "idDocument": "123456789",
    "bankAccount": "0123456789"
  }'

# 3. Solicitar empréstimo
curl -X POST http://localhost:3000/loans/apply \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "<customer-id>",
    "amount": 5000,
    "termMonths": 12
  }'

# 4. Verificar status
curl -X GET http://localhost:3000/loans/<loan-id> \
  -H "Authorization: Bearer <token>"
```

---

**API v2.0 - Dezembro 2025**
