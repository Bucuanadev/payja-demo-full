# PayJA - Guia de Início Rápido

## ⚡ 5 Passos para Começar

### 1️⃣ Instalar Dependências

**Backend PayJA:**
```powershell
cd backend
npm install
npx prisma generate
npx prisma migrate deploy
```

**Banco-Mock (Desenvolvimento):**
```powershell
cd banco-mock/backend
npm install

cd banco-mock/frontend
npm install
```

**Desktop PayJA:**
```powershell
cd desktop
npm install
```

### 2️⃣ Iniciar Banco-Mock (Terminal 1)
```powershell
cd banco-mock/backend
node src/index.js
```
- API disponível em http://localhost:4000/api
- Admin em http://localhost:4100

### 3️⃣ Iniciar PayJA Backend (Terminal 2)
```powershell
cd backend
npm run start:dev
```
- API disponível em http://localhost:3000/api/v1
- Integrado com Banco-Mock automaticamente

### 4️⃣ Iniciar Banco-Mock Frontend (Terminal 3)
```powershell
cd banco-mock/frontend
npm run dev -- --host --port 4100
```
- Dashboard de banco em http://localhost:4100
- Veja clientes, validações e desembolsos

### 5️⃣ Iniciar PayJA Desktop (Terminal 4)
```powershell
cd desktop
npm run dev
```
- Dashboard em http://localhost:5173

---

## 🎯 Fluxo Completo de Teste

### 1. Teste de Elegibilidade
Acesse http://localhost:4100 → Validações

Teste com NUIT `100234567` (João Pedro da Silva)
- Score: 750
- Limite: 50.000 MZN
- Status: Aprovado

### 2. Registrar Cliente via USSD (*899#)
No PayJA Desktop → Simulador USSD

Menu de Registro:
```
1. Insira NUIT: 100345678
2. Nome: Maria Santos Machado  
3. BI: 2345678901234M
4. Confirmar
```

Sistema:
- ✅ Busca cliente no Banco-Mock
- ✅ Valida dados
- ✅ Atribui limite do banco (30.000 MZN)
- ✅ Envia SMS de aprovação

### 3. Solicitar Empréstimo via USSD (*898#)
No PayJA Desktop → Simulador USSD

Menu de Empréstimo:
```
1. Valor: 5000
2. Propósito: Educação
3. Confirmar
```

Sistema:
- ✅ Valida creditLimit do cliente
- ✅ Chama Banco para desembolso
- ✅ Registra transação
- ✅ Envia SMS com referência

### 4. Acompanhar no Dashboard Banco
Acesse http://localhost:4100 → Desembolsos

Veja:
- Transações processadas
- Status de desembolsos
- Histórico de cliente


### 2. Testar o Simulador USSD
1. Vá em **Simulador USSD** no menu
2. Clique na aba **USSD Movitel**
3. Número de teste: `258860000001`
4. Clique em "Iniciar Sessão"
5. Siga o fluxo de registro

**Fluxo de Teste:**
```
*898# → 1 (Registrar) → Digite NUIT: 123456789
→ Digite BI: 12345678901
→ Instituição: MinhaEmpresa
→ Recebe OTP por SMS
→ Digite novamente *898#
→ Insira OTP recebido
→ Registro confirmado!
```

### 3. Ver SMS Enviados
1. Vá em **Simulador SMS**
2. Veja os SMS enviados para o número de teste
3. Verifique o código OTP recebido

### 4. Criar um Empréstimo de Teste
1. Volte ao **Simulador USSD Movitel**
2. Inicie nova sessão (já registrado)
3. Escolha "1. Solicitar emprestimo"
4. Digite valor: `50000`
5. Escolha finalidade: `1` (Negócio)
6. Selecione banco: `1` ([Banco 1])
7. Aceite termos: `1` (Aceito)
8. Aguarde análise automática

### 5. Visualizar o Empréstimo
1. Vá em **Empréstimos** no menu
2. Veja o empréstimo criado
3. Clique para ver detalhes
4. Aprove ou rejeite manualmente se necessário

---

## 🧪 Dados de Teste

### Números Válidos
```
258860000001  (Movitel)
258860000002  (Movitel)
258860000003  (Movitel)
```

### NIUITs para Teste
```
123456789
987654321
555555555
```

### Valores de Empréstimo
```
Mínimo: 1.000 MZN
Máximo: 100.000 MZN
Sugerido para teste: 50.000 MZN
```

---

## 🔄 Resetar Dados de Teste

### Via Dashboard
1. Vá em **Definições**
2. Clique na aba **Reset Simuladores**
3. Clique em "Resetar Simuladores"
4. Confirme a ação

### Via Script
```powershell
cd backend
node scripts/cleanup-test-data.js
```

---

## 📊 Funcionalidades por Aba

### 📈 Dashboard
- Visão geral do sistema
- Estatísticas de clientes e empréstimos
- Gráficos de desempenho

### 💰 Empréstimos
- Lista completa de empréstimos
- Filtros por status
- Detalhes e histórico
- Aprovação/Rejeição manual

### 👥 Clientes
- Lista de todos os clientes
- Histórico de cada cliente
- Edição de informações
- Score de crédito

### 📱 Simulador USSD
- Testar fluxo Movitel completo
- Simular registro de cliente
- Simular solicitação de empréstimo
- Ver histórico de interações

### 💬 Simulador SMS
- Ver SMS enviados
- Verificar códigos OTP
- Filtrar por número
- Marcar como lido

### 🔌 Integrações
- Status de bancos parceiros
- Status de operadoras
- Testar conectividade
- Ver logs de integração

### ⚙️ Definições
- Criar usuários
- Configurar parâmetros (taxas, limites)
- Gerenciar APIs
- Resetar simuladores

---

## 🚨 Problemas Comuns

### Backend não inicia
```powershell
cd backend
npm install
npx prisma generate
npx prisma migrate dev
npm run start:dev
```

### Frontend não carrega
```powershell
cd desktop
npm install
npm run dev
```

### Banco de dados corrompido
```powershell
cd backend
Remove-Item prisma\dev.db
npx prisma migrate dev
npx prisma db seed
```

### Erro de autenticação
1. Limpe o cache do navegador (Ctrl + Shift + Del)
2. Faça logout
3. Faça login novamente

### Simulador USSD não responde
1. Verifique se o backend está rodando
2. Abra o console do navegador (F12)
3. Veja se há erros de rede
4. Tente resetar os dados de teste

---

## 📝 Fluxos Completos

### Registro de Cliente via USSD
```
1. *898# → Discar USSD
2. Sistema: "Não está registrado..."
3. Opção: 1 (Registrar)
4. Digite NUIT: 9 dígitos
5. Digite BI: mínimo 9 caracteres
6. Digite Instituição: nome da empresa
7. Recebe OTP por SMS
8. USSD fecha
9. *898# → Discar novamente
10. Sistema pede OTP
11. Digite código recebido
12. Confirmação de registro
13. SMS de confirmação
```

### Solicitação de Empréstimo
```
1. *898# → Já registrado
2. Menu principal
3. Opção: 1 (Solicitar empréstimo)
4. Digite valor: ex: 50000
5. Escolha finalidade: 1-5
6. Selecione banco: 1-2
7. Leia termos e condições
8. Opção: 1 (Aceito)
9. Sistema analisa crédito
10. Notificação de resultado
11. SMS de confirmação
```

---

## 💡 Dicas

1. **Use o Simulador**: Teste tudo no simulador antes de integrar
2. **Monitore SMS**: Sempre confira os SMS enviados
3. **Resete Dados**: Limpe dados de teste regularmente
4. **Veja Logs**: Console do navegador mostra erros úteis
5. **Backup**: O banco SQLite fica em `backend/prisma/dev.db`

---

## 🎓 Próximos Passos

1. ✅ Completar fluxo de registro
2. ✅ Testar solicitação de empréstimo
3. ✅ Explorar todas as abas
4. ✅ Criar múltiplos clientes de teste
5. ✅ Testar aprovação/rejeição manual
6. ✅ Verificar cálculo de scoring
7. ✅ Configurar parâmetros do sistema
8. ⏭️ Integrar com APIs reais de bancos
9. ⏭️ Configurar servidor de produção

---

## 🆘 Precisa de Ajuda?

- 📖 Documentação completa: `README.md`
- 🏗️ Estrutura do projeto: `ESTRUTURA.md`
- 📧 Email: suporte@payja.co.mz

**Boa sorte com o PayJA! 🚀**
