# Fluxo USSD — documentação actualizada

Resumo
- Fluxos USSD implementados para registo e empréstimos (*898# / *899#), compatíveis com chamadas HTTP (sessões) e com a interface pública `customers.html`.

Validação de número
- Regex: `/^(86|87)\d{7}$/` (começa com 86 ou 87 + 7 dígitos = 9 dígitos totais)

Fluxo geral — Registo (novo cliente)
1. Cliente marca *898# → `POST /api/ussd/session` (server valida número).
2. Se não registado: envia mensagem `CON` com convite para registo.
3. Sequência de prompts: nome → BI → NUIT → banco → validar → atribuir limite.
4. Finalizar com `END ✓ Registrado` e enviar SMS de confirmação (apenas se operação atómica permitir).

Fluxo geral — Cliente registado (empréstimo)
1. Cliente marca *898# → system identifica cliente registado.
2. Menu: solicitar empréstimo / sair.
3. Solicitar valor → confirmar → processar → desembolso → `END` e SMS de confirmação.

APIs relevantes
- `POST /api/ussd/session` — iniciar sessão USSD. Body: `{ phoneNumber }`.
- `POST /api/ussd/continue` — continuar sessão. Body: `{ sessionId, userInput }`.
- `GET /api/ussd/sessions` — listar sessões ativas.
- `POST /api/customers/register` — registo directo via UI.

Mensagens padrão
- `CON` — continua sessão
- `END` — encerra sessão
- Erros e validações retornam `END` com texto explicativo quando irreversíveis

Timeouts e gestão de sessão
- Duração da sessão: 5 minutos por defeito
- Renovação a cada input; limpeza automática após timeout ou `END`

SMS: comportamento e garantia de uma única notificação
- Problema: múltiplos caminhos (sync, poll, compat endpoint, UI) podem tentar enviar SMS simultaneamente.
- Implementação actual: debouncing em memória e persistência "best-effort" de flags (`eligibility_notified`, `confirmation_notified`).
- Correção segura (recomendada): operação atómica no DB antes de enviar — execute um `UPDATE ... WHERE ... AND notified IS NULL/0` e só envie se `changes > 0`.

Exemplo atómico (SQLite/Node):

```js
const sql = `UPDATE customers SET eligibility_notified = 1
  WHERE phoneNumber = ? AND (eligibility_notified IS NULL OR eligibility_notified = 0)`;
db.run(sql, [phoneNumber], function (err) {
  if (err) { console.error(err); return; }
  if (this.changes && this.changes > 0) {
    // enviar SMS e gravar em sms_logs
  } else {
    // outro processo já marcou -> não enviar
  }
});
```

Recomendações para testes E2E
- Usar um número de teste e executar o fluxo completo: iniciar sessão, registar, permitir PayJA sincronizar e verificar `GET /api/sms/logs` para garantir apenas 1 entrada por tipo.
- Se replicar duplicados, verificar logs PM2 e aplicar a operação atómica no emissor central.

Observability
- Logs PM2: `pm2 logs ussd-simulator`
- SMS logs endpoint: `GET /api/sms/logs`
- DB: `ussd-simulator-standalone/data/ussd.db`

Última actualização: 2026-01-06
# Fluxo USSD do PayJA - Simulador Standalone

## 📋 Visão Geral

O fluxo USSD (*898#) implementado no simulador standalone segue esta lógica:

### 1️⃣ Validação do Número (Primeira Coisa)

Quando o usuário marca **\*898#**, o número é imediatamente validado:

```
✓ Deve começar com 86 ou 87
✓ Deve ter 9 dígitos no total (86/87 + 7 dígitos)
✗ Qualquer outro formato é rejeitado
```

**Exemplos válidos:**
- `868801234` ✅
- `870123456` ✅
- `868999999` ✅

**Exemplos inválidos:**
- `868` ❌ (muito curto)
- `8601234567` ❌ (muito longo)
- `758801234` ❌ (não começa com 86 ou 87)

---

## 🔄 Fluxo por Cenários

### Cenário A: Cliente NÃO está registado

```
CLIENTE MARCA: *898#
        ↓
VALIDAÇÃO: Número é 86/87? ✓
        ↓
CHECK_REGISTRATION: Cliente existe no PayJA? ❌
        ↓
MENSAGEM:
"CON Bem-vindo ao PayJA!

Registro rápido e gratuito.
Leva apenas 2 minutos!

Continue..."
        ↓
CLIENTE DIGITA: Qualquer tecla
        ↓
REQUEST_REGISTER: "Introduza seu nome completo:"
        ↓
CLIENTE DIGITA: João Silva
        ↓
REQUEST_NAME: "Introduza seu número de BI:"
        ↓
CLIENTE DIGITA: 123456789
        ↓
REQUEST_BI: "Introduza seu número NUIT:"
        ↓
CLIENTE DIGITA: 000000000
        ↓
REQUEST_NUIT: "Introduza seu banco (nome):"
        ↓
CLIENTE DIGITA: BCI
        ↓
VALIDATING: "Validando dados..."
        ↓
REGISTRATION_COMPLETE:
"END ✓ Registrado com sucesso!

Limite aprovado: 10000 MZN

Receba SMS com confirmaçao."
        ↓
SESSÃO ENCERRA
```

### Cenário B: Cliente JÁ está registado

```
CLIENTE MARCA: *898#
        ↓
VALIDAÇÃO: Número é 86/87? ✓
        ↓
CHECK_REGISTRATION: Cliente existe no PayJA? ✓
        ↓
MENSAGEM:
"CON Bem-vindo João Silva!

Seu limite: 10000 MZN

1. Solicitar empréstimo
0. Sair"
        ↓
CLIENTE DIGITA: 1
        ↓
REQUEST_AMOUNT: "Solicitação de Empréstimo

Seu limite: 10000 MZN

Introduza o valor desejado:"
        ↓
CLIENTE DIGITA: 5000
        ↓
CONFIRM_LOAN: "Confirma empréstimo de 5000 MZN?

Taxa: 2.5% ao mês

1. Confirmar
0. Cancelar"
        ↓
CLIENTE DIGITA: 1
        ↓
PROCESSING: "Processando seu pedido...
Aguarde..."
        ↓
LOAN_COMPLETE:
"END ✓ Empréstimo aprovado!

Valor: 5000 MZN
Desembolsado.

Receba SMS com detalhes."
        ↓
SESSÃO ENCERRA
```

---

## 🔌 Endpoints da API

### 1. Iniciar Sessão

```bash
POST /api/ussd/session
Content-Type: application/json

{
  "phoneNumber": "868801234"
}
```

**Response (Cliente Novo):**
```json
{
  "sessionId": "uuid-xxx",
  "phoneNumber": "868801234",
  "flow": "unified",
  "message": "CON Bem-vindo ao PayJA!\n\nRegistro rápido e gratuito.\nLeva apenas 2 minutos!\n\nContinue...",
  "isNewCustomer": true,
  "payjaConnection": "new"
}
```

**Response (Cliente Registado):**
```json
{
  "sessionId": "uuid-xxx",
  "phoneNumber": "868801234",
  "flow": "unified",
  "message": "CON Bem-vindo João Silva!\n\nSeu limite: 10000 MZN\n\n1. Solicitar empréstimo\n0. Sair",
  "isNewCustomer": false,
  "payjaConnection": "found"
}
```

### 2. Continuar Fluxo

```bash
POST /api/ussd/continue
Content-Type: application/json

{
  "sessionId": "uuid-xxx",
  "userInput": "João Silva"
}
```

**Response:**
```json
{
  "sessionId": "uuid-xxx",
  "message": "CON Introduza seu número de BI:",
  "currentStep": 3
}
```

### 3. Listar Sessões Ativas

```bash
GET /api/ussd/sessions
```

**Response:**
```json
{
  "activeSessions": 2,
  "sessions": [
    {
      "id": "uuid-1",
      "phoneNumber": "868801234",
      "currentStep": 1,
      "isNewCustomer": true,
      "status": "active",
      "expiresAt": "2025-12-11T14:00:00Z"
    }
  ]
}
```

---

## 🛠️ Mensagens do Fluxo

### Códigos USSD

- `CON` = Continue (continua na sessão)
- `END` = Encerra (fecha a sessão)

### Mensagens por Passo

| Passo | Mensagem |
|-------|----------|
| CHECK_REGISTRATION (Novo) | Bem-vindo ao PayJA!<br>Registro rápido e gratuito.<br>Leva apenas 2 minutos!<br>Continue... |
| CHECK_REGISTRATION (Registado) | Bem-vindo João Silva!<br>Seu limite: 10000 MZN<br>1. Solicitar empréstimo<br>0. Sair |
| REQUEST_REGISTER | Para completar o registro:<br>Introduza seu nome completo: |
| REQUEST_NAME | Introduza seu número de BI: |
| REQUEST_BI | Introduza seu número NUIT: |
| REQUEST_NUIT | Introduza seu banco (nome): |
| VALIDATING | Validando dados...<br>Aguarde... |
| REGISTRATION_COMPLETE | ✓ Registrado com sucesso!<br>Limite aprovado: 10000 MZN<br>Receba SMS com confirmaçao. |
| REQUEST_AMOUNT | Solicitação de Empréstimo<br>Seu limite: 10000 MZN<br>Introduza o valor desejado: |
| CONFIRM_LOAN | Confirma empréstimo de 5000 MZN?<br>Taxa: 2.5% ao mês<br>1. Confirmar<br>0. Cancelar |
| PROCESSING | Processando seu pedido...<br>Aguarde... |
| LOAN_COMPLETE | ✓ Empréstimo aprovado!<br>Valor: 5000 MZN<br>Desembolsado.<br>Receba SMS com detalhes. |

---

## ⏰ Timeouts e Sessões

- **Duração da sessão**: 5 minutos
- **Renovação**: Automática a cada input
- **Limpeza**: Automática após conclusão

---

## 🔐 Validações

### Número de Telemóvel
```javascript
/^(86|87)\d{7}$/
```
- Começa com 86 ou 87
- Seguido de 7 dígitos
- Total: 9 dígitos

### Valores de Empréstimo
- Não pode ser negativo ou zero
- Não pode exceder o limite de crédito
- Deve ser numérico

---

## 🧪 Teste Rápido

```bash
# 1. Iniciar
curl -X POST http://localhost:3001/api/ussd/session \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"868801234"}'

# 2. Continuar (substituir SESSION_ID)
curl -X POST http://localhost:3001/api/ussd/continue \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"SESSION_ID","userInput":"João"}'
```

---

**Implementação concluída! O fluxo está pronto para teste.**
