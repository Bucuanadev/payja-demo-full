# Gerenciamento de Processos com PM2 para Todos os Projetos

Este projeto utiliza o PM2 para gerenciar e monitorar os principais serviços (backends e frontends) de forma robusta, especialmente em ambiente Windows. Abaixo está o padrão adotado para cada configuração e como iniciar cada serviço.

## Estrutura das Configurações PM2

Cada serviço frontend que utiliza `npm run dev` possui um arquivo de configuração PM2 dedicado, salvo na pasta do respectivo frontend, com extensão `.cjs` para garantir compatibilidade com CommonJS e Windows.

### Exemplo de configuração (frontend)

```js
// pm2.payja-frontend.config.cjs ou pm2.banco-mock-frontend.config.cjs
module.exports = {
  apps: [
    {
      name: "NOME_DO_SERVICO", // Ex: payja-frontend ou banco-mock-frontend
      cwd: __dirname,           // Garante que o comando rode na pasta correta
      script: "cmd",           // Usa o interpretador de comandos do Windows
      args: "/c npm run dev",  // Executa o npm run dev via cmd
      env: {
        NODE_ENV: "development"
      },
      exec_mode: "fork"
    }
  ]
};
```

### Exemplo de configuração (backend ou Node puro)
Para backends Node.js puros, normalmente já existe um arquivo de configuração PM2 padrão, por exemplo:

```js
// pm2.payja-backend.config.js
module.exports = {
  apps: [
    {
      name: "payja-backend",
      script: "dist/main.js", // ou o entrypoint do backend
      watch: false,
      env: {
        NODE_ENV: "development"
      }
    }
  ]
};
```

## Como iniciar cada serviço

1. **Frontend PayJA**
   - Arquivo: `desktop/pm2.payja-frontend.config.cjs`
   - Comando:
     ```sh
     pm2 start desktop/pm2.payja-frontend.config.cjs
     ```

2. **Frontend Banco Mock**
   - Arquivo: `banco-mock/frontend/pm2.banco-mock-frontend.config.cjs`
   - Comando:
     ```sh
     pm2 start banco-mock/frontend/pm2.banco-mock-frontend.config.cjs
     ```

3. **Backends**
   - Use os arquivos de configuração já existentes, por exemplo:
     ```sh
     pm2 start pm2.payja-backend.config.js
     pm2 start pm2.banco-mock-backend.config.js
     pm2 start pm2.ussd-simulator.config.js
     ```

## Observações Importantes
- Sempre utilize arquivos `.cjs` para configurações PM2 de frontends em Windows, pois garantem compatibilidade com CommonJS.
- O campo `cwd` garante que o comando rode na pasta correta do projeto.
- O campo `script: "cmd"` e `args: "/c npm run dev"` são essenciais para rodar scripts npm no Windows via PM2.
- Para ver o status dos serviços:
  ```sh
  pm2 status
  ```
- Para ver logs de um serviço:
  ```sh
  pm2 logs NOME_DO_SERVICO
  ```
- Para reiniciar um serviço:
  ```sh
  pm2 restart NOME_DO_SERVICO
  ```

---

Com essa padronização, todos os serviços do projeto podem ser monitorados, reiniciados automaticamente e gerenciados de forma centralizada pelo PM2.
