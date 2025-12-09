# 🔗 Sistema Universal de Integração Bancária - PayJA

## 📋 Visão Geral

O PayJA implementa um **sistema universal de integração bancária** que permite adicionar **qualquer banco parceiro** de forma dinâmica através do painel administrativo, sem necessidade de modificar código.

## 🎯 Características Principais

- ✅ **Integração Universal**: Adaptador genérico que funciona com qualquer API bancária
- ✅ **Configuração via Interface**: Administrador adiciona bancos manualmente no frontend
- ✅ **Endpoints Configuráveis**: Cada banco pode ter seus próprios endpoints personalizados
- ✅ **Gerenciamento Completo**: CRUD de bancos, teste de conexão, estatísticas
- ✅ **Sem Hard-Code**: Nenhum nome de banco fixo no código
- ✅ **Persistência em BD**: Todos os bancos armazenados no banco de dados

## 🗄️ Modelo de Dados

### BankPartner (Prisma Schema)

```prisma
model BankPartner {
  id              String   @id @default(uuid())
  
  // Identificação
  code            String   @unique // Ex: GHW, BCI, STANDARD
  name            String   // Ex: Banco GHW
  
  // Configuração da API
  apiUrl          String   // Ex: http://localhost:4500
  apiKey          String?  // Opcional
  
  // Endpoints configuráveis
  healthEndpoint          String @default("/api/health")
  eligibilityEndpoint     String @default("/api/validacao/verificar")
  capacityEndpoint        String @default("/api/capacidade/consultar")
  disbursementEndpoint    String @default("/api/desembolso/executar")
  loansEndpoint           String @default("/api/emprestimos/consultar")
  webhookEndpoint         String @default("/api/webhooks/pagamento")
  
  // Configurações
  timeout         Int      @default(30000)
  retryAttempts   Int      @default(3)
  
  // Status
  active          Boolean  @default(true)
  verified        Boolean  @default(false)
  
  // Metadados
  description     String?
  contactEmail    String?
  contactPhone    String?
  
  // Estatísticas
  lastHealthCheck DateTime?
  lastHealthStatus String?
  totalRequests   Int      @default(0)
  successfulRequests Int   @default(0)
  failedRequests  Int      @default(0)
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

## 🏗️ Arquitetura Backend

### 1. Adaptador Universal (`universal.adapter.ts`)

```typescript
export class UniversalBankAdapter {
  configure(bankConfig) {
    // Configuração dinâmica
  }
  
  async testConnection() {
    // Testa saúde do banco
  }
  
  async checkEligibility(request) {
    // Verifica elegibilidade
  }
  
  async requestDisbursement(request) {
    // Solicita desembolso
  }
  
  // Outros métodos...
}
```

### 2. Service (`bank-adapters-v2.service.ts`)

```typescript
export class BankAdaptersService {
  async initializeAdapters() {
    // Carrega bancos do BD ao iniciar
    const banks = await this.prisma.bankPartner.findMany();
    for (const bank of banks) {
      const adapter = new UniversalBankAdapter();
      adapter.configure(bank);
      this.adapters.set(bank.code, adapter);
    }
  }
  
  async createBank(data) {
    // Criar novo banco
  }
  
  async updateBank(code, data) {
    // Atualizar banco
  }
  
  async deleteBank(code) {
    // Remover banco
  }
  
  async testConnection(code) {
    // Testar conexão
  }
}
```

### 3. Endpoints da API

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/api/v1/bank-partners` | Listar todos os bancos |
| `GET` | `/api/v1/bank-partners/:code` | Detalhes de um banco |
| `POST` | `/api/v1/bank-partners` | Criar novo banco |
| `PUT` | `/api/v1/bank-partners/:code` | Atualizar banco |
| `DELETE` | `/api/v1/bank-partners/:code` | Deletar banco |
| `POST` | `/api/v1/bank-partners/:code/test-connection` | Testar conexão |
| `POST` | `/api/v1/bank-partners/:code/check-eligibility` | Verificar elegibilidade |
| `POST` | `/api/v1/bank-partners/disburse` | Solicitar desembolso |

## 🎨 Interface Frontend

### Página: Bancos Parceiros (`BankPartnersPage.jsx`)

**Funcionalidades:**
- ✅ Listar todos os bancos com estatísticas
- ✅ Adicionar novo banco com formulário completo
- ✅ Editar banco existente
- ✅ Deletar banco (com confirmação)
- ✅ Testar conexão em tempo real
- ✅ Visualizar status de saúde (online/offline)
- ✅ Ver taxa de sucesso das requisições
- ✅ Dashboard com estatísticas gerais

**Campos do Formulário:**
- Código do Banco (ex: GHW, BCI)
- Nome do Banco
- URL da API
- API Key (opcional)
- Endpoints customizados (6 endpoints)
- Timeout e retry attempts
- Descrição
- Contatos (email, telefone)
- Status (ativo/inativo)

## 📖 Como Usar

### 1. Adicionar Novo Banco

1. **Acessar**: Desktop > Bancos Parceiros
2. **Clicar**: "Adicionar Banco"
3. **Preencher formulário**:
   ```
   Código: GHW
   Nome: Banco GHW
   URL: http://localhost:4500
   API Key: banco-ghw-api-key-2025
   
   Endpoints (usar padrões ou customizar):
   - Health: /api/health
   - Elegibilidade: /api/validacao/verificar
   - Capacidade: /api/capacidade/consultar
   - Desembolso: /api/desembolso/executar
   - Empréstimos: /api/emprestimos/consultar
   - Webhook: /api/webhooks/pagamento
   ```
4. **Salvar**: Banco será criado e adaptador inicializado
5. **Testar**: Clicar em "Testar Conexão"

### 2. Usar Banco em Empréstimos

```javascript
// O sistema automaticamente usa os bancos ativos
const banks = await api.get('/bank-partners');

// Verificar elegibilidade
const eligibility = await api.post(
  `/bank-partners/${bankCode}/check-eligibility`,
  { customerId, phoneNumber, nuit }
);

// Solicitar desembolso
const disbursement = await api.post('/bank-partners/disburse', {
  customerId,
  loanId,
  amount,
  bankCode
});
```

## 🔄 Fluxo de Requisição

```
1. Admin adiciona Banco GHW via frontend
   ↓
2. Backend salva no banco de dados
   ↓
3. Service cria e configura adaptador universal
   ↓
4. Adaptador registrado no Map com código "GHW"
   ↓
5. Cliente solicita empréstimo
   ↓
6. PayJA busca adaptador pelo código
   ↓
7. Adaptador faz chamada para API do banco
   ↓
8. Resposta normalizada retornada ao PayJA
```

## 📡 APIs que o Banco DEVE Implementar

### Endpoints Mínimos Obrigatórios

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/health` | GET | Status do sistema |
| `/api/validacao/verificar` | POST | Verificar elegibilidade |
| `/api/desembolso/executar` | POST | Executar desembolso |

### Endpoints Opcionais

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/capacidade/consultar` | POST | Capacidade financeira |
| `/api/emprestimos/consultar` | POST | Consultar empréstimos |
| `/api/webhooks/pagamento` | POST | Receber notificação de pagamento |

## 🔐 Segurança

- ✅ Autenticação via JWT nos endpoints do PayJA
- ✅ API Key armazenada de forma segura
- ✅ Validação de dados nas requisições
- ✅ Retry com backoff exponencial
- ✅ Timeout configurável
- ✅ Logs de auditoria para todas as operações

## 📊 Estatísticas e Monitoramento

Cada banco mantém:
- Total de requisições
- Requisições bem-sucedidas
- Requisições falhadas
- Taxa de sucesso (%)
- Último health check
- Status (online/offline)

## 🚀 Instalação e Migração

### 1. Executar Migração

```bash
cd backend
npx prisma migrate dev --name add_bank_partners
npx prisma generate
```

### 2. Iniciar Backend

```bash
npm run start:dev
```

O sistema irá:
- Carregar bancos ativos do BD
- Inicializar adaptadores
- Registrar no Map de adaptadores

### 3. Iniciar Frontend

```bash
cd desktop
npm run dev
```

### 4. Adicionar Primeiro Banco

- Acessar: `http://localhost:5173/bank-partners`
- Adicionar Banco GHW manualmente
- Testar conexão

## ✅ Vantagens do Sistema Universal

1. **Flexibilidade**: Qualquer banco pode ser adicionado
2. **Escalabilidade**: Sem limites de bancos
3. **Manutenibilidade**: Não precisa modificar código
4. **Configurabilidade**: Endpoints personalizados por banco
5. **Monitoramento**: Estatísticas em tempo real
6. **Confiabilidade**: Retry automático e timeout
7. **Auditoria**: Logs completos de todas operações

---

**Sistema pronto para produção!** 🎉

**Próximos passos:**
1. Executar migração do Prisma
2. Adicionar bancos parceiros via interface
3. Testar integrações
4. Configurar ambientes de produção
