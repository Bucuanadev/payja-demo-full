const Database = require('./src/database.cjs');

async function addCustomer() {
  const db = new Database();
  
  // Wait for DB to initialize
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  try {
    console.log('📝 Adicionando cliente: 874567890 - Ana Isabel Cossa');
    
    const result = await db.addCustomer('874567890', 'Ana Isabel Cossa');
    console.log('✅ Cliente adicionado:', result);
    
    // Verify
    const customers = await db.getAllCustomers();
    console.log(`\n📊 Total de clientes no banco: ${customers.length}`);
    customers.forEach(c => {
      console.log(`  - ${c.msisdn}: ${c.name} (synced: ${c.synced_with_payja})`);
    });
    
    await db.close();
    console.log('\n✅ Concluído!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Erro:', error);
    await db.close();
    process.exit(1);
  }
}

addCustomer();
