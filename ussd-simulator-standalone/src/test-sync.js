const { PayjaSync } = require('./payja-sync');

async function test() {
  console.log('🧪 TESTANDO SINCRONIZAÇÃO PAYJA');
  const sync = new PayjaSync();
  // Testar mapeamento
  const testData = {
    phoneNumber: '258841234567',
    name: 'João Silva Santos',
    creditScore: 750,
    nuit: '123456789',
    biNumber: '1234567890123A',
    salary: 50000,
    creditLimit: 100000,
    verified: 1,
    status: 'verified',
    updatedAt: '2025-12-22T12:05:20.870Z'
  };
  console.log('\n📝 Testando mapeamento:');
  const mapped = sync.mapPayjaToCustomer(testData);
  console.log('Dados mapeados:', mapped);
  console.log('\n✅ Teste de mapeamento concluído');
}

test().catch(console.error);
