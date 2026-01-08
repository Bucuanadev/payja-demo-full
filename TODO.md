# Fix Simulator-PayJA Database Compatibility

## Problem
Client 874567890 (Ana Isabel Cossa) registered in simulator but not appearing in PayJA due to database compatibility issues.

# TODO — Estado Actual do Projeto e Próximos Passos

Este ficheiro reúne o estado actual do repositório, mudanças recentes, problemas conhecidos e um plano de acção para estabilizar o fluxo PayJA ←→ USSD simulator (incluindo envio único de SMS de verificação/eligibilidade).

**Resumo / Objectivos**
- Garantir que o USSD Simulator e PayJA sincronizam clientes corretamente.
- Eliminar envios duplicados de SMS de verificação/eligibilidade — cada cliente deve receber apenas 1 mensagem por tipo.
- Manter o fluxo smartphone → simulador → PayJA Admin funcional para testes E2E de empréstimo.

**Estado Actual (2026-01-06)**
- Serviços principais: USSD simulator (porta 3001), PayJA backend, banco-mock e frontends executáveis via PM2 no Windows.
- Base de dados do simulador: SQLite em `data/ussd.db`.
- Endpoints úteis (simulador):
	- Health: GET http://localhost:3001/health
	- Clientes: GET http://localhost:3001/api/customers
	- Marcar verificado (PayJA compat): POST http://localhost:3001/api/payja/ussd/mark-verified
	- Novos clientes PayJA: GET http://localhost:3001/api/payja/ussd/new-customers
	- Logs SMS: GET http://localhost:3001/api/sms/logs

**Principais ficheiros alterados / relevantes**
- [ussd-simulator-standalone/src/main.cjs](ussd-simulator-standalone/src/main.cjs) — adicionada lógica de dedupe em memória e persistência "best-effort" para flags `eligibility_notified` / `confirmation_notified` e instrumentação de logs.
- [ussd-simulator-standalone/src/payja-compatible-simulator.cjs](ussd-simulator-standalone/src/payja-compatible-simulator.cjs) — adaptado para tentar ler/escrever flags no DB antes/depois de enviar SMS.
- [ussd-simulator-standalone/src/app.module.js](ussd-simulator-standalone/src/app.module.js) e [ussd-simulator-standalone/src/main.js](ussd-simulator-standalone/src/main.js) — dedupe local para emissores de confirmação.
- [backend/src/modules/payja-sync/payja-sync.service.js](backend/dist/src/modules/payja-sync/payja-sync.service.js) — artefacto compilado; o código fonte TS relevante encontra-se em `backend/src/modules/payja-sync/`.

**O que foi feito até agora**
- Localizados todos os pontos que emitem SMS de verificação/confirmação (poll, sync, compat endpoint, handlers da UI).
- Implementado debouncing em memória (mapas `recentSmsSent*`) para bloquear envios repetidos numa janela temporal.
- Instrumentado logs com pequenos stack traces para identificar qual caminho disparou o envio.
- Implementada persistência "best-effort" para flags `eligibility_notified` e `confirmation_notified` no SQLite para evitar reenvios entre módulos/instâncias.
- Reiniciado o simulador via PM2 e verificado logs; dedupe está a funcionar para evitar reenvios imediatos.

**Problema remanescente (causa raiz)**
- Ainda ocorrem envios duplicados históricos quando múltiplos caminhos (ou instâncias) disparam quase em simultâneo antes da flag persistida no DB.
- A persistência actual é "best-effort" e não é atómica: pode haver uma corrida entre processos antes da primeira escrita.

Correção recomendada (implementação imediata)
- Substituir a actual sequência de "check-then-send-then-persist" por uma operação atómica de DB: marcar a flag com um `UPDATE` condicional e usar o `changes`/`affectedRows` para decidir se efetua o envio.

Exemplo (SQLite / Node) — implementar dentro do emissor central:

```js
const sql = `UPDATE customers
	SET eligibility_notified = 1
	WHERE msisdn = ? AND (eligibility_notified IS NULL OR eligibility_notified = 0)`;
this.db.run(sql, [msisdn], function (err) {
	if (err) { /* log e fallback */ return; }
	if (this.changes && this.changes > 0) {
		// Ganhei a corrida — enviar SMS e gravar em smsLogs
	} else {
		// Outro processo já marcou — ignorar envio
	}
});
```

Porquê: o `UPDATE` é atómico no SQLite; apenas um chamador verá `changes > 0` e fará o envio.

Melhorias adicionais recomendadas
- Centralizar o envio de SMS num único helper/serviço que faça a operação atómica e logging.
- Criar migração DB para adicionar as colunas `eligibility_notified` e `confirmation_notified` (INT DEFAULT 0) se ausentes.
- Considerar um campo `notified_at` com timestamp para auditoria.

Passos imediatos (para executar localmente)
1) Reiniciar o simulador:

```powershell
pm2 restart ussd-simulator --update-env
```

2) Disparar manualmente marcação verificada (substitua payload conforme necessário):

```bash
curl -X POST http://localhost:3001/api/payja/ussd/mark-verified \
	-H "Content-Type: application/json" \
	-d '{"phoneNumber":"872345678","creditLimit":30000}'
```

3) Consultar logs do simulador e histórico SMS:

```powershell
pm2 logs ussd-simulator --lines 200
Invoke-RestMethod http://localhost:3001/api/sms/logs
```

Checklist de tarefas (TODO)
- [x] Encontrar todos os pontos que enviam mensagens de verificação/confirmação
- [x] Implementar dedupe em memória e logs de rastreio
- [x] Tentar persistir flags no DB (implementação atual: best-effort)
- [ ] Implementar `UPDATE` atómico para marcar-notificado (recomendado — alta prioridade)
- [ ] Centralizar emissor de SMS e substituir chamadas directas pelos chamadores existentes
- [ ] Adicionar migração DB para colunas de notificação e índice se necessário
- [ ] Executar testes E2E para confirmar que cada cliente recebe apenas 1 SMS por tipo

Notas operacionais / onde olhar ao debugar
- Logs PM2 (simulador): `C:\Users\User\.pm2\logs\ussd-simulator-out.log` e `...-error.log`.
- DB file: `ussd-simulator-standalone/data/ussd.db`.
- Endpoints PayJA compatível: consulte [ussd-simulator-standalone/src/payja-compatible-simulator.cjs](ussd-simulator-standalone/src/payja-compatible-simulator.cjs).

Próximo passo sugerido (posso executar para si)
- Implementar a alteração atómica (`UPDATE` + check `changes`) nos emissores principais no simulador e substituir os pontos de envio para chamar o emissor central. Posso aplicar o patch e reiniciar o serviço se autorizar.

---
Gerado automaticamente com o estado do repositório em 2026-01-06.
