const axios = require('axios');

async function testSyncConnection() {
  console.log('=== Testando Conexão PayJA ↔ Simulador ===\n');
  try {
    console.log('1. Testando conexão com simulador:');
    const simulatorHealth = await axios.get('http://155.138.228.89:3000/health');
    console.log(`   ✅ Simulador: ${simulatorHealth.data.status}\n`);

    console.log('2. Verificando clientes não sincronizados:');
    const unsynced = await axios.get('http://155.138.228.89:3000/api/customers/unsynced');
    console.log(`   ✅ Clientes não sincronizados: ${unsynced.data.length}`);

    if (unsynced.data.length > 0) {
      unsynced.data.forEach(cust => {
        console.log(`      📞 ${cust.msisdn}: ${cust.name}`);
      });
    } else {
      console.log('   ⚠️  Nenhum cliente não sincronizado encontrado');
      const all = await axios.get('http://155.138.228.89:3000/api/customers');
      console.log(`   Total de clientes: ${all.data.length}`);
      all.data.forEach(cust => {
        console.log(`      ${cust.synced_with_payja ? '✅' : '🔄'} ${cust.msisdn}: ${cust.name}`);
      });
    }

    console.log('\n3. Testando endpoints do backend PayJA:');
    const status = await axios.get('http://155.138.228.89:3001/payja/sync/status');
    console.log(`   ✅ Status da sincronização: ${status.data.simulator_status}`);

    console.log('\n4. Disparando sincronização manual:');
    const syncResult = await axios.post('http://155.138.228.89:3001/payja/sync/trigger');
    console.log(`   ✅ ${syncResult.data.message}\n`);

    console.log('5. Verificando após sincronização:');
    const afterSync = await axios.get('http://155.138.228.89:3000/api/customers/unsynced');
    console.log(`   Clientes não sincronizados restantes: ${afterSync.data.length}\n`);

    console.log('6. Logs de sincronização:');
    const syncLogs = await axios.get('http://155.138.228.89:3000/api/sync-logs');
    const recentLogs = (syncLogs.data || []).slice(0, 3);
    recentLogs.forEach(log => {
      console.log(`   📝 ${log.sync_date}: ${log.msisdn} - ${log.sync_status}`);
    });

    console.log('\n=== Teste concluído com sucesso! ===');
  } catch (error) {
    console.error('\n❌ Erro durante o teste:');
    console.error(`   Mensagem: ${error.message}`);
    process.exit(1);
  }
}

testSyncConnection();
