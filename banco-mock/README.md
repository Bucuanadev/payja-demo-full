# 🏦 Banco Mock - Sistema Bancário Simulado

Sistema bancário mock para integração com PayJA. Simula um banco real com APIs de validação, elegibilidade e desembolso de empréstimos.

## 🚀 Instalação

```bash
cd banco-mock/backend
npm install
```

## ▶️ Executar

```bash
npm run dev
```

O servidor iniciará em: **http://localhost:4000**

## 📡 APIs Disponíveis

### 1. **Validação de Elegibilidade**

**Endpoint usado pelo PayJA para verificar se cliente é elegível**

```
POST /api/validacao/verificar
```

**Request:**
```json
{
  "nuit": "100234567",
  "nome": "João Pedro da Silva",
  "telefone": "258841234567",
  "bi": "1234567890123N",
  "valor_solicitado": 5000
}
```

**Response (Aprovado):**
```json
{
  "sucesso": true,
  "elegivel": true,
  "cliente": {
    "nuit": "100234567",
    "nome": "João Pedro da Silva",
    "telefone": "258841234567",
    "numero_conta": "0001000000001",
    "score_credito": 750,
    "renda_mensal": 35000
  },
  "limite_aprovado": 50000,
  "score_comparacao": 100,
  "detalhes_comparacao": [...]
}
```

**Response (Rejeitado):**
```json
{
  "sucesso": true,
  "elegivel": false,
  "motivo": "Cliente não possui conta neste banco",
  "codigo": "CLIENTE_NAO_ENCONTRADO"
}
```

---

### 2. **Desembolso de Empréstimo**

**Endpoint para PayJA solicitar transferência do valor aprovado**

```
POST /api/desembolso/executar
```

**Request:**
```json
{
  "nuit": "100234567",
  "valor": 10000,
  "numero_emola": "258841234567",
  "referencia_payja": "LOAN-12345",
  "descricao": "Desembolso empréstimo pessoal"
}
```

**Response:**
```json
{
  "sucesso": true,
  "mensagem": "Desembolso iniciado com sucesso",
  "desembolso": {
    "id": "uuid-xxx",
    "valor": 10000,
    "numero_emola": "258841234567",
    "status": "PROCESSANDO",
    "tempo_estimado": "2-5 segundos"
  },
  "cliente": {
    "nome": "João Pedro da Silva",
    "saldo_anterior": 25000,
    "saldo_novo": 15000
  }
}
```

---

### 3. **Consultar Status do Desembolso**

```
GET /api/desembolso/status/:id
```

---

### 4. **Simular Desembolso**

**Verificar se desembolso pode ser executado sem executar**

```
POST /api/desembolso/simular
```

**Request:**
```json
{
  "nuit": "100234567",
  "valor": 10000
}
```

---

### 5. **Gerenciar Clientes**

```
GET  /api/clientes              # Listar todos
GET  /api/clientes/nuit/:nuit   # Buscar por NUIT
GET  /api/clientes/:id          # Buscar por ID
POST /api/clientes              # Criar novo
PATCH /api/clientes/:id         # Atualizar
```

---

### 6. **Históricos**

```
GET /api/validacao/historico    # Todas validações
GET /api/desembolso/historico   # Todos desembolsos
```

---

## 📊 Clientes Fictícios (Seed Data)

O sistema vem com 5 clientes pré-cadastrados:

| NUIT      | Nome                    | Score | Limite    | Renda Mensal |
|-----------|-------------------------|-------|-----------|--------------|
| 100234567 | João Pedro da Silva     | 750   | 50.000 MZN | 35.000 MZN  |
| 100345678 | Maria Santos Machado    | 680   | 30.000 MZN | 25.000 MZN  |
| 100456789 | Carlos Alberto Mondlane | 820   | 80.000 MZN | 55.000 MZN  |
| 100567890 | Ana Isabel Cossa        | 590   | 15.000 MZN | 18.000 MZN  |
| 100678901 | Pedro Manuel Sitoe      | 710   | 60.000 MZN | 42.000 MZN  |

---

## 🔄 Fluxo de Integração com PayJA

```
1. Cliente registra no USSD (*123#)
   ↓
2. PayJA chama: POST /api/validacao/verificar
   ← Banco responde: elegível + limite
   ↓
3. PayJA aprova empréstimo
   ↓
4. PayJA chama: POST /api/desembolso/executar
   ← Banco processa (2-5 seg)
   ↓
5. Banco debita conta e transfere para Emola
   ↓
6. Cliente recebe dinheiro no telemóvel
```

---

## 🎯 Critérios de Aprovação

O banco avalia:

1. **Score de Comparação** (mínimo 70%):
   - NUIT: 30%
   - Nome: 25%
   - Telefone: 20%
   - BI: 15%
   - Conta Ativa: 10%

2. **Score de Crédito**:
   - < 600: Limite reduzido a 50%
   - 600-699: Limite reduzido a 70%
   - ≥ 700: Limite completo

3. **Empréstimos Ativos**:
   - Com empréstimos: -40% do limite

4. **Saldo Mínimo**:
   - Saldo < 1.000 MZN: -20% do limite

---

## 💾 Banco de Dados

- **SQLite** (`banco.db`)
- Tabelas:
  - `clientes` - Cadastro de clientes
  - `transacoes` - Movimentações financeiras
  - `validacoes` - Histórico de verificações
  - `desembolsos` - Histórico de empréstimos

---

## 🔐 Segurança

- API Key: `banco-mock-secret-key-2025` (definida no `.env`)
- Em produção, implementar autenticação JWT
- Validar assinatura das requisições

---

## 📝 Logs

O sistema registra todas as operações:

```
🔍 Requisição de validação recebida do PayJA
✅ Cliente João Pedro da Silva APROVADO
💰 Limite aprovado: 50000 MZN
💰 Requisição de desembolso recebida do PayJA
✅ Desembolso iniciado: 10000 MZN para 258841234567
```

---

## 🧪 Testar APIs

### Validação:
```bash
curl -X POST http://localhost:4000/api/validacao/verificar \
  -H "Content-Type: application/json" \
  -d '{
    "nuit": "100234567",
    "nome": "João Pedro da Silva",
    "telefone": "258841234567"
  }'
```

### Desembolso:
```bash
curl -X POST http://localhost:4000/api/desembolso/executar \
  -H "Content-Type: application/json" \
  -d '{
    "nuit": "100234567",
    "valor": 10000,
    "numero_emola": "258841234567",
    "referencia_payja": "LOAN-123"
  }'
```

---

## 🎨 Frontend (Em construção)

Painel administrativo para:
- Visualizar clientes
- Acompanhar validações
- Monitorar desembolsos
- Estatísticas em tempo real
