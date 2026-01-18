const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function listCustomers() {
  try {
    const customers = await prisma.customer.findMany();
    
    console.log('\n📋 Clientes no banco de dados:\n');
    
    if (customers.length === 0) {
      console.log('  Nenhum cliente encontrado.\n');
    } else {
      customers.forEach(c => {
        console.log(`  📱 ${c.phoneNumber}`);
        console.log(`     NUIT: ${c.nuit || 'N/A'}`);
        console.log(`     BI: ${c.biNumber || 'N/A'}`);
        console.log(`     Nome: ${c.name || 'N/A'}`);
        console.log(`     Verificado: ${c.verified ? '✓' : '✗'}`);
        console.log(`     Canal: ${c.channel || 'N/A'}`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

listCustomers();
