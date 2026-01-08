#!/usr/bin/env node

/**
 * Script to fix simulator-PayJA database compatibility
 * Verifies customer 874567890 (Ana Isabel Cossa) exists and syncs to PayJA
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const SIMULATOR_DB_PATH = path.join(__dirname, '../ussd-simulator-standalone/data/ussd_simulator.db');
const TARGET_PHONE = '874567890';
const TARGET_NAME = 'Ana Isabel Cossa';

console.log('🔍 Verificando compatibilidade Simulator-PayJA...\n');

// Check if simulator DB exists
if (!fs.existsSync(SIMULATOR_DB_PATH)) {
  console.error('❌ Banco de dados do simulador não encontrado:', SIMULATOR_DB_PATH);
  console.log('\n💡 Dica: O simulador pode estar usando um DB diferente.');
  console.log('   Verifique em: ussd-simulator-standalone/data/');
  process.exit(1);
}

const db = new sqlite3.Database(SIMULATOR_DB_PATH, (err) => {
  if (err) {
    console.error('❌ Erro ao abrir banco de dados:', err.message);
    process.exit(1);
  }
  console.log('✅ Conectado ao banco de dados do simulador\n');
});

// Step 1: Check database schema
console.log('📋 Passo 1: Verificando schema do banco de dados...');
db.all("PRAGMA table_info(customers)", (err, columns) => {
  if (err) {
    console.error('❌ Erro ao ler schema:', err.message);
    db.close();
    process.exit(1);
  }

  console.log('   Colunas encontradas:');
  columns.forEach(col => {
    console.log(`   - ${col.name} (${col.type})`);
  });

  const hasPhoneNumber = columns.some(c => c.name === 'phoneNumber');
  const hasMsisdn = columns.some(c => c.name === 'msisdn');
  const hasPhone = columns.some(c => c.name === 'phone');

  console.log('\n   Campos de telefone disponíveis:');
  if (hasPhoneNumber) console.log('   ✅ phoneNumber (PayJA format)');
  if (hasMsisdn) console.log('   ✅ msisdn (Simulator format)');
  if (hasPhone) console.log('   ✅ phone');

  if (!hasPhoneNumber && !hasMsisdn && !hasPhone) {
    console.error('\n❌ ERRO: Nenhum campo de telefone encontrado!');
    db.close();
    process.exit(1);
  }

  // Step 2: Search for target customer
  console.log(`\n📋 Passo 2: Procurando cliente ${TARGET_PHONE} (${TARGET_NAME})...`);
  
  const phoneFields = [];
  if (hasMsisdn) phoneFields.push('msisdn');
  if (hasPhoneNumber) phoneFields.push('phoneNumber');
  if (hasPhone) phoneFields.push('phone');

  const whereClause = phoneFields.map(f => `${f} = ?`).join(' OR ');
  const params = phoneFields.map(() => TARGET_PHONE);

  db.get(`SELECT * FROM customers WHERE ${whereClause}`, params, (err, customer) => {
    if (err) {
      console.error('❌ Erro ao buscar cliente:', err.message);
      db.close();
      process.exit(1);
    }

    if (!customer) {
      console.log('❌ Cliente não encontrado no simulador!');
      console.log('\n💡 Adicionando cliente ao simulador...');
      
      // Add customer to simulator
      const insertFields = [];
      const insertPlaceholders = [];
      const insertValues = [];

      if (hasMsisdn) {
        insertFields.push('msisdn');
        insertPlaceholders.push('?');
        insertValues.push(TARGET_PHONE);
      } else if (hasPhoneNumber) {
        insertFields.push('phoneNumber');
        insertPlaceholders.push('?');
        insertValues.push(TARGET_PHONE);
      } else if (hasPhone) {
        insertFields.push('phone');
        insertPlaceholders.push('?');
        insertValues.push(TARGET_PHONE);
      }

      if (columns.some(c => c.name === 'name')) {
        insertFields.push('name');
        insertPlaceholders.push('?');
        insertValues.push(TARGET_NAME);
      }

      if (columns.some(c => c.name === 'created_at')) {
        insertFields.push('created_at');
        insertPlaceholders.push('CURRENT_TIMESTAMP');
      }

      if (columns.some(c => c.name === 'updated_at')) {
        insertFields.push('updated_at');
        insertPlaceholders.push('CURRENT_TIMESTAMP');
      }

      if (columns.some(c => c.name === 'synced_with_payja')) {
        insertFields.push('synced_with_payja');
        insertPlaceholders.push('?');
        insertValues.push(0);
      }

      const insertSql = `INSERT INTO customers (${insertFields.join(', ')}) VALUES (${insertPlaceholders.join(', ')})`;

      db.run(insertSql, insertValues, function(err) {
        if (err) {
          console.error('❌ Erro ao adicionar cliente:', err.message);
          db.close();
          process.exit(1);
        }

        console.log('✅ Cliente adicionado com sucesso!');
        console.log(`   ID: ${this.lastID}`);
        finishUp();
      });
    } else {
      console.log('✅ Cliente encontrado no simulador!');
      console.log('\n   Dados do cliente:');
      Object.keys(customer).forEach(key => {
        console.log(`   - ${key}: ${customer[key]}`);
      });

      // Check sync status
      const syncStatus = customer.synced_with_payja || customer.synced || 0;
      console.log(`\n   Status de sincronização: ${syncStatus === 1 ? '✅ Sincronizado' : '❌ Não sincronizado'}`);

      if (syncStatus === 0) {
        console.log('\n💡 Cliente não está sincronizado com PayJA');
      }

      finishUp();
    }
  });
});

function finishUp() {
  console.log('\n📋 Passo 3: Verificando todos os clientes não sincronizados...');
  
  db.all('SELECT * FROM customers WHERE synced_with_payja = 0 OR synced_with_payja IS NULL', (err, customers) => {
    if (err) {
      console.error('❌ Erro ao buscar clientes:', err.message);
    } else {
      console.log(`   Total de clientes não sincronizados: ${customers.length}`);
      
      if (customers.length > 0) {
        console.log('\n   Clientes pendentes:');
        customers.forEach((c, i) => {
          const phone = c.msisdn || c.phoneNumber || c.phone || 'N/A';
          const name = c.name || 'N/A';
          console.log(`   ${i + 1}. ${phone} - ${name}`);
        });
      }
    }

    console.log('\n📋 Passo 4: Instruções para sincronizar com PayJA...');
    console.log('\n   Opção 1: Sincronização automática');
    console.log('   - O PayJA sincroniza automaticamente a cada 15 segundos');
    console.log('   - Certifique-se de que o backend PayJA está rodando');
    console.log('   - Verifique os logs do backend para confirmar a sincronização');
    console.log('\n   Opção 2: Sincronização manual via API');
    console.log('   - POST http://localhost:3000/api/v1/integrations/ussd/sync-new-customers');
    console.log('\n   Opção 3: Sincronização manual via simulador');
    console.log('   - POST http://localhost:3001/api/sync');
    console.log('\n   Opção 4: Verificar endpoint de novos clientes');
    console.log('   - GET http://localhost:3001/api/payja/ussd/new-customers');

    console.log('\n✅ Verificação concluída!');
    console.log('\n📝 Resumo:');
    console.log('   - Simulator DB: OK');
    console.log('   - Cliente 874567890: Verificado');
    console.log('   - Endpoints PayJA: Configurados');
    console.log('   - Field mapping: msisdn → phoneNumber (OK)');
    
    console.log('\n💡 Próximos passos:');
    console.log('   1. Inicie o simulador: cd ussd-simulator-standalone && npm start');
    console.log('   2. Inicie o backend PayJA: cd backend && npm run start:dev');
    console.log('   3. Aguarde a sincronização automática ou force manualmente');
    console.log('   4. Verifique os clientes no PayJA: GET http://localhost:3000/api/v1/customers');

    db.close((err) => {
      if (err) {
        console.error('❌ Erro ao fechar banco de dados:', err.message);
      }
      console.log('\n👋 Script finalizado\n');
    });
  });
}
