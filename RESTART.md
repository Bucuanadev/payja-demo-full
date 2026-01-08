# Como reiniciar sem perder configurações ou lógica

Este repositório usa PM2 (Windows) para rodar os serviços: PayJA backend, frontends, banco-mock e o simulador USSD.

Objetivo: ao reiniciar ou atualizar, garantir que nenhuma configuração ou lógica seja perdida, e que `dist` seja regenerado a partir de `src` corretamente.

Passos recomendados (rápido):

- Fazer commit das alterações no `src` antes de reiniciar: `git add -A && git commit -m "Save changes"`.
- Fazer backup dos DBs: `powershell -File scripts\backup-dbs.ps1`.
- Rebuild e restart (recomendado): `powershell -File scripts\restart-all.ps1`.

O que os scripts fazem:

- `scripts/restart-all.ps1`:
  - executa `npm install` e `npm run build` em `backend` (regenera `dist` a partir de `src`);
  - garante que `backend/logs` existe;
  - reinicia os processos PM2 conhecidos (tenta `restart`, se falhar tenta `start` com o config existente).
- `scripts/backup-dbs.ps1`:
  - copia os arquivos de banco mais importantes para `tmp/backups/<timestamp>`.

Boas práticas:

- Sempre persista alterações no código com `git` antes de reiniciar o ambiente.
- Nunca edite arquivos em `backend/dist` diretamente — altere `backend/src` e execute `npm run build`.
- Verifique logs após reinício: `type backend\logs\<arquivo>.log` ou `pm2 logs`.

Se quiser que eu commit essas mudanças (scripts + docs) ao repositório ou ajustar os nomes dos processos PM2, diga qual fluxo prefere.
