const { payjaSync } = require('./payja-sync');

async function startSync() {
  try {
    console.log('🚀 Iniciando sincronização PayJA...');
    const result = await payjaSync.sync();
    await payjaSync.listCustomers();
    return result;
  } catch (error) {
    console.error('❌ Erro fatal na sincronização:', error);
    return { success: 0, errors: 1 };
  }
}

startSync().then(result => {
  console.log('🎯 Resultado final:', result);
});

const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutos
setInterval(() => {
  console.log(`\n⏰ Executando sincronização agendada em ${new Date().toISOString()}`);
  startSync();
}, SYNC_INTERVAL);
