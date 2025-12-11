# Arquitetura do Sistema PayJA

Documentação técnica da arquitetura e design do sistema.

## 🏗️ Visão Geral da Arquitetura

O PayJA segue uma arquitetura de microserviços com separação clara de responsabilidades.

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENTE                              │
│  (Web Browser / Mobile App / USSD / Desktop)                │
└───────────────────────┬─────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│   Desktop    │ │  USSD Sim.   │ │ Banco Mock   │
│   :5173      │ │   :3001      │ │ Frontend     │
│              │ │              │ │   :4100      │
└──────┬───────┘ └──────┬───────┘ └──────┬───────┘
       │                │                │
       └────────────────┼────────────────┘
                        │
                        ▼
            ┌─────────────────────┐
            │   PayJA Backend     │
            │   NestJS :3000      │
            │  ┌───────────────┐  │
            │  │  Auth Module  │  │
            │  │  Loans Module │  │
            │  │ Scoring Module│  │
            │  │Decision Module│  │
            │  └───────────────┘  │
            └──────────┬──────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ▼              ▼              ▼
┌─────────────┐  ┌──────────┐  ┌─────────────┐
│  Database   │  │  Banco   │  │   SMS API   │
│  SQLite     │  │  Mock    │  │  (Externo)  │
│             │  │  :4000   │  │             │
└─────────────┘  └──────────┘  └─────────────┘
```

## 📦 Componentes do Sistema

### 1. PayJA Backend (NestJS)

**Porta:** 3000  
**Tecnologia:** NestJS, TypeScript, Prisma  
**Banco de Dados:** SQLite

#### Módulos Principais

##### Auth Module
- Autenticação de usuários
- Gestão de sessões JWT
- Controle de permissões (RBAC)

##### Loans Module
- Criação de pedidos de empréstimo
- Gestão do ciclo de vida do empréstimo
- Cálculo de juros e parcelas
- Integração com banco para desembolso

##### Scoring Module
- Análise de crédito baseada em regras
- Verificação de histórico
- Cálculo de score
- Integração com bureaus de crédito (futuro)

##### Decision Module
- Motor de decisão automatizado
- Regras de negócio configuráveis
- Aprovação/rejeição automática
- Casos para análise manual

##### Bank Adapters Module
- Abstração de APIs bancárias
- Validação de contas
- Solicitação de desembolsos
- Processamento de webhooks

##### Registration USSD Module (Removido)
- ⚠️ Módulo removido da versão atual
- Funcionalidade migrada para USSD Simulator standalone

#### Estrutura de Diretórios

```
backend/
├── prisma/
│   ├── schema.prisma         # Schema do banco
│   ├── migrations/           # Migrations SQL
│   └── seed.ts              # Dados iniciais
├── src/
│   ├── modules/
│   │   ├── auth/
│   │   ├── loans/
│   │   ├── scoring/
│   │   ├── decision/
│   │   ├── bank-adapters/
│   │   ├── banco-webhooks/
│   │   └── ...
│   ├── app.module.ts
│   ├── main.ts
│   └── prisma.service.ts
└── package.json
```

### 2. Banco Mock

Simulador completo de API bancária para testes.

#### Backend (Porta 4000)
- API REST para operações bancárias
- Validação de contas
- Simulação de desembolsos
- Webhook callbacks
- Banco de dados em memória

#### Frontend (Porta 4100)
- Interface administrativa
- Visualização de transações
- Gestão de contas
- Dashboard de operações

### 3. PayJA Desktop (Electron)

**Porta:** 5173  
**Tecnologia:** Electron, React, Vite

Aplicação desktop para gestão administrativa:
- Dashboard de empréstimos
- Gestão de clientes
- Configuração de parceiros bancários
- Análise de cross-validation
- Simulador USSD integrado
- Simulador SMS

### 4. USSD Simulator Standalone

**Porta:** 3001  
**Tecnologia:** Node.js, Express, SQLite

Simulador independente de interface USSD:
- Banco de dados próprio de clientes
- Simulação de sessões USSD
- Integração com PayJA Backend
- Logs de interações

## 🔄 Fluxos de Dados

### Fluxo de Solicitação de Empréstimo

```
1. Cliente acessa canal (Desktop/USSD/Web)
   │
2. Autenticação/Identificação
   │
3. Formulário de solicitação
   │
4. POST /loans/apply → Backend
   │
5. Validação de dados
   │
6. Análise de crédito (Scoring Module)
   │
7. Decisão automatizada (Decision Module)
   │
   ├─→ APROVADO
   │   │
   │   8. Validação de conta bancária → Banco Mock
   │   │
   │   9. Solicitação de desembolso → Banco Mock
   │   │
   │   10. Webhook de confirmação ← Banco Mock
   │   │
   │   11. Atualização de status → Database
   │   │
   │   12. Notificação SMS → Cliente
   │
   └─→ REJEITADO
       │
       8. Registro de rejeição → Database
       │
       9. Notificação → Cliente
```

### Fluxo de Webhook Bancário

```
1. Banco Mock processa desembolso
   │
2. POST /webhook/bank-notification → Backend
   │
3. Validação de assinatura
   │
4. Processamento do evento
   │
5. Atualização do empréstimo
   │
6. Notificação ao cliente
```

## 🗄️ Modelo de Dados

### Principais Entidades

#### Customer (Cliente)
```typescript
{
  id: string
  name: string
  phoneNumber: string
  idDocument: string
  bankAccount: string
  creditLimit: decimal
  createdAt: DateTime
  loans: Loan[]
}
```

#### Loan (Empréstimo)
```typescript
{
  id: string
  customerId: string
  amount: decimal
  interestRate: decimal
  termMonths: int
  status: LoanStatus
  approvedAt: DateTime?
  disbursedAt: DateTime?
  createdAt: DateTime
  payments: Payment[]
}
```

#### LoanStatus (Estados)
```typescript
enum LoanStatus {
  PENDING           // Aguardando análise
  APPROVED          // Aprovado
  REJECTED          // Rejeitado
  DISBURSED         // Desembolsado
  ACTIVE            // Ativo/Em pagamento
  COMPLETED         // Quitado
  DEFAULTED         // Inadimplente
}
```

## 🔐 Segurança

### Autenticação
- JWT (JSON Web Tokens)
- Refresh tokens
- Expiração configurável

### Autorização
- Role-Based Access Control (RBAC)
- Níveis: ADMIN, OPERATOR, USER

### Comunicação
- HTTPS obrigatório em produção
- Validação de webhooks com assinatura
- Rate limiting

### Dados Sensíveis
- Hashing de senhas (bcrypt)
- Criptografia de dados bancários
- Logs sanitizados

## 🚀 Escalabilidade

### Horizontalidade
- Serviços stateless
- Pronto para containerização (Docker)
- Load balancing preparado

### Performance
- Caching de análises de crédito
- Índices otimizados no banco
- Paginação de resultados

### Monitoramento
- PM2 para gerenciamento de processos
- Logs estruturados
- Health checks

## 🔧 Configuração e Deploy

### Desenvolvimento
```powershell
# Todos os serviços via PM2
pm2 start all
pm2 logs
```

### Staging/Produção
```powershell
# Configurar variáveis de ambiente
# Executar migrations
# Iniciar com PM2
# Configurar reverse proxy (Nginx)
# SSL/TLS certificates
```

## 📊 Decisões Arquiteturais

### Por que NestJS?
- TypeScript nativo
- Arquitetura modular
- Dependency injection
- Excelente para APIs REST

### Por que Prisma?
- Type-safe
- Migrations automáticas
- Suporte a múltiplos bancos
- Excelente DX

### Por que SQLite?
- Zero configuração
- File-based
- Suficiente para MVP
- Fácil migração para PostgreSQL

### Por que PM2?
- Gerenciamento de processos robusto
- Logs centralizados
- Restart automático
- Cluster mode disponível

## 🔮 Roadmap Técnico

- [ ] Migração para PostgreSQL
- [ ] Containerização (Docker)
- [ ] CI/CD pipeline
- [ ] Kubernetes deployment
- [ ] Redis para caching
- [ ] RabbitMQ para mensageria
- [ ] Microserviços independentes
- [ ] GraphQL API

---

**Arquitetura v2.0 - Dezembro 2025**
