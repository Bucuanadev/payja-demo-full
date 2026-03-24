const fs = require('fs');
const path = '/root/payja-demo-full/backend/src/modules/bank-sync/bank-sync.service.ts';

let content = fs.readFileSync(path, 'utf8');

// Adicionar Interval de @nestjs/schedule se não existir
if (!content.includes('@nestjs/schedule')) {
  content = content.replace(
    "import { Injectable, Logger, OnModuleInit } from '@nestjs/common';",
    "import { Injectable, Logger, OnModuleInit } from '@nestjs/common';\nimport { Interval } from '@nestjs/schedule';"
  );
}

// Substituir o onModuleInit para usar um intervalo de 1 minuto
const newOnModuleInit = `  async onModuleInit() {
    this.logger.log('Iniciando sincronização automática com o Banco Mock (Intervalo: 1 min)...');
    // Sincronização inicial
    setTimeout(() => {
      this.syncAllFromBank().catch(err => 
        this.logger.error('Erro na sincronização inicial:', err.message)
      );
    }, 5000);
  }

  @Interval(60000)
  async handleIntervalSync() {
    this.logger.log('Executando sincronização periódica (Interval)...');
    await this.syncAllFromBank();
  }`;

content = content.replace(/async onModuleInit\(\) \{[\s\S]+?\}\n/m, newOnModuleInit);

fs.writeFileSync(path, content);
console.log('Ficheiro actualizado com sucesso!');
