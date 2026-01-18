# Mapa de APIs (Simulador, PayJA, Banco Mock)

## Visão Geral
- Objetivo: documentar os endpoints que conectam o simulador USSD, o PayJA e o Banco Mock, indicando quem chama quem, em que scripts vivem e que dados circulam.
- Foco: APIs usadas no fluxo USSD (cadastro, elegibilidade, empréstimo, desembolso) e nas sincronizações automáticas.

## Simulador USSD (porta 3001)
Arquivo principal: `ussd-simulator-standalone/src/main.js`

### Endpoints expostos pelo simulador
- `GET /api/health` — health check.
- `GET /api/payja/ussd/new-customers` — lista clientes ativos para o PayJA importar.
  - Consumido por: PayJA (`PayjaSyncService.fetchNewCustomers`).
  - Dados: `phoneNumber`, `name`, `nuit`, `biNumber`, `institution`, `verified`.
- `POST /api/payja/ussd/eligibility` — PayJA devolve limite e elegibilidade ao simulador.
  - Consumido por: PayJA (`PayjaSyncService.postEligibility`).
  - Efeito: atualiza `creditLimit` do cliente no simulador.
- `POST /api/payja/ussd/mark-verified` — PayJA marca cliente como verificado.
  - Consumido por: PayJA (`PayjaSyncService.validateAndUpdateCustomer`).
  - Efeito: `verified=true`, envia SMS de confirmação.
- `GET /api/loans` — lista empréstimos criados no simulador.
  - Consumido por: PayJA (`PayjaSyncService.fetchSimulatorLoans`).
- `POST /api/loans` — cria empréstimo no simulador (via UI/USSD).
- `PATCH /api/loans/:id/status` — atualiza status do empréstimo.
  - Consumido por: PayJA ao confirmar desembolso (`confirmDisbursal`), status `DISBURSED` dispara SMS de desembolso.
- `GET /api/sms/logs` — logs de SMS simulados.
- `POST /api/customers/register` — cadastro de cliente via UI/USSD.
- `POST /api/customers/sync-from-localStorage` — importa clientes de storage da UI.
- `POST /api/customers/reset-all` — limpa clientes (utilitário).

### Automações no simulador
- Polling a cada 15s para `GET {PAYJA_BASE_URL}/api/v1/integrations/ussd/customer-status/:phone` (arquivo `main.js`, setInterval). Se `verified`, marca local, atualiza limite e envia SMS.
- SMS mocks: `sendConfirmationSms` e `sendLoanDisbursedSms` registram em memória e expõem em `/api/sms/logs`.

## PayJA Backend (porta 3000, prefixo global /api/v1)
Arquivos chave:
- `backend/src/modules/payja-sync/payja-sync.controller.ts`
- `backend/src/modules/payja-sync/payja-sync.service.ts`
- Global prefix: definido em `backend/src/main.ts` (`app.setGlobalPrefix('api/v1')`).

### Endpoints expostos pelo PayJA para integrações USSD
Base: `/api/v1/integrations/ussd`
- `POST /sync-new-customers` — força sync de novos clientes do simulador.
- `POST /sync-loans` — força sync de empréstimos do simulador.
- `GET /loans` — lista empréstimos armazenados no PayJA (inclui `customerName` e `phoneNumber`).
- `POST /loans/:id/disburse` e `PATCH /loans/:id/disburse` — Banco Mock confirma desembolso. Atualiza status para `DISBURSED`, seta `disbursedAt`, notifica simulador via `PATCH /api/loans/:id/status`.
- `POST /validate-customer/:phoneNumber` — valida cliente consultando Banco Mock.
- `GET /customer-status/:phoneNumber` — usado pelo simulador para ver se o cliente já foi validado.

### Como o PayJA consome o simulador (PayjaSyncService)
- Config (defaults): `USSD_SIM_BASE_URL=http://155.138.227.26:3001`, `USSD_SIM_ENDPOINT_NEW=/api/payja/ussd/new-customers`, `USSD_SIM_ENDPOINT_ELIG=/api/payja/ussd/eligibility`, `USSD_SIM_ENDPOINT_LOANS=/api/loans`.
- Auto-sync (Interval 15s): `autoSyncNewCustomers` e `autoSyncLoans` chamam o simulador.
- `syncNewCustomers`:
  1) `GET /api/payja/ussd/new-customers` (simulador) → cria/atualiza customers no PayJA.
  2) `validateAndUpdateCustomer` pode chamar Banco Mock para validar (nuit/bi/instituição) e, se ok, marca cliente como verificado.
  3) Notifica simulador: `POST /api/payja/ussd/mark-verified` e `POST /api/payja/ussd/eligibility`.
- `syncLoans`:
  1) `GET /api/loans` (simulador) → cria/atualiza loans no PayJA.
  2) Mapeia status do simulador para PayJA (`mapSimulatorStatus`).

### Como o PayJA consome o Banco Mock (validação de cliente)
- `validateWithBankByCustomer` consulta `GET {BANK_BASE_URL}/api/clientes` (banco-mock) para cruzar `nuit`, `bi`, `empregador`.

### Como o PayJA notifica o simulador
- Desembolso confirmado: `PATCH /api/loans/:id/status` (simulador) com `status=DISBURSED` e `disbursedAt`.

## Banco Mock Backend (porta 4500)
Arquivos chave:
- `banco-mock/backend/src/index.js` — registra rotas.
- `banco-mock/backend/src/routes/payja-loans.js` — rota de sincronização com PayJA.
- `banco-mock/backend/src/database.js` — clientes fictícios e buscas.

### Endpoints expostos pelo Banco Mock
- `GET /api/payja-loans` — lista desembolsos sincronizados do PayJA (memória).
- `GET /api/payja-loans/:id` — detalhe de um desembolso.
- `PATCH /api/payja-loans/:id/status` — atualiza status manualmente (teste).
- `POST /api/payja-loans/sync` — dispara sync manual com PayJA.
- Outros (não foco USSD): `/api/clientes`, `/api/validacao`, `/api/desembolso`, `/api/emprestimos`, etc.

### Como o Banco Mock consome o PayJA
- Config: `PAYJA_API_URL` (ex.: `http://155.138.227.26:3000`), `PAYJA_API_PREFIX` (ex.: `/api/v1`). Helper `buildPayjaUrl` evita prefixo duplicado.
- Sync loop a cada 15s (`startAutoSync` em `payja-loans.js`):
  1) `GET {PAYJA}/api/v1/integrations/ussd/loans` → recebe loans do PayJA.
  2) Enriquecimento: tenta casar `loan.customerName` com `db.getClienteByNome` para achar conta/saldo/emola.
  3) Mapeia status PayJA → Banco (`PENDING`→`PENDENTE`, `APPROVED`→`PROCESSANDO`, `DISBURSED`→`CONCLUIDO`, `REJECTED`→`ERRO`, `ACTIVE`→`PROCESSANDO`).
  4) Guarda em memória `disbursals` para ser exibido no frontend Banco.
- Webhook de volta para PayJA: `notifyPayJADisbursal`
  - `PATCH {PAYJA}/api/v1/integrations/ussd/loans/:id/disburse` com status `DISBURSED` ou `REJECTED` (tentativas com retry).

### Lógica de auto-desembolso no Banco Mock
- Condições (em `autoConfirmDisbursal`):
  - Cliente encontrado pelo nome.
  - Status PayJA `PENDING` e local `PENDENTE`.
  - Valor não excede `limite_credito` e saldo suficiente.
- Passos:
  1) Marca `PROCESSANDO`, debita saldo simulado em `db.updateCliente`.
  2) Marca `CONCLUIDO`, incrementa tentativas.
  3) Webhook para PayJA (status `DISBURSED`, info de conta/emola/valor/data).
  4) Se sem limite, marca `ERRO` e notifica PayJA como `REJECTED`.

## Fluxo ponta-a-ponta (resumo)
1) **Cadastro USSD**: simulador cria cliente (`POST /api/customers/register`), fica `verified=false`.
2) **PayJA importa clientes**: `GET /api/payja/ussd/new-customers` (simulador) → `syncNewCustomers` cria/atualiza no PayJA.
3) **Validação com banco**: PayJA chama `GET /api/clientes` (Banco Mock) para cruzar dados; se ok, marca cliente verificado, notifica simulador via `POST /api/payja/ussd/mark-verified` e elegibilidade via `POST /api/payja/ussd/eligibility`.
4) **Criação de empréstimo**: simulador cria loan (`POST /api/loans`).
5) **PayJA importa empréstimos**: `GET /api/loans` (simulador) → `syncLoans` grava no PayJA.
6) **Banco Mock sincroniza loans do PayJA**: `GET /api/v1/integrations/ussd/loans` → guarda em `/api/payja-loans` e tenta auto-desembolsar.
7) **Banco Mock confirma desembolso**: ao concluir, envia `PATCH /api/v1/integrations/ussd/loans/:id/disburse` → PayJA seta loan `DISBURSED`.
8) **PayJA avisa simulador**: `PATCH /api/loans/:id/status` (simulador) → status `DISBURSED` dispara SMS de desembolso e define dueDate.
9) **Frontends**: 
   - PayJA UI consome PayJA backend direto.
   - Banco frontend lê `GET /api/payja-loans` para mostrar “Desembolsos”.
   - Simulador UI usa seus próprios endpoints e logs de SMS.

## Variáveis de ambiente relevantes
- Simulador: `PAYJA_BASE_URL` (para polling de status), porta `PORT`.
- PayJA: `USSD_SIM_BASE_URL`, `USSD_SIM_ENDPOINT_NEW`, `USSD_SIM_ENDPOINT_ELIG`, `USSD_SIM_ENDPOINT_LOANS`, `BANK_BASE_URL`.
- Banco Mock: `PAYJA_API_URL`, `PAYJA_API_PREFIX`, `PORT` (default 4500).

## Scripts/onde rodar
- Simulador: `ussd-simulator-standalone/start-pm2.cjs` ou `npm run dev` (dependendo do package). Backend principal em `src/main.js`.
- PayJA backend: `pm2 payja-backend` config em `pm2.payja-backend.config.js` (entry `backend/src/main.ts` compilado via Nest). CLI simples: `npm run start:dev` no diretório `backend`.
- Banco Mock backend: `pm2.banco-mock-backend.config.js` roda `node src/index.js` na pasta `banco-mock/backend`.

## Observações
- Prefixo do PayJA: sempre `/api/v1`. O helper `buildPayjaUrl` evita aplicar o prefixo duas vezes quando `PAYJA_API_URL` já o inclui.
- Armazenamento de desembolsos no Banco Mock é in-memory; restart limpa a lista (mas clientes seed permanecem).
- Todos os SMS são mocks e ficam em `/api/sms/logs` no simulador.
