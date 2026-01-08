const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrateDatabase() {
  console.log('🔄 Adicionando campos faltantes à tabela Customer...');
  try {
    // Usar SQL raw para adicionar colunas se não existirem
    // Função auxiliar para checar e adicionar coluna
    async function addColumnIfMissing(table, column, typeAndDefault) {
      const info = await prisma.$queryRawUnsafe(`PRAGMA table_info(${table})`);
      if (!info.some(col => col.name === column)) {
        await prisma.$executeRawUnsafe(`ALTER TABLE ${table} ADD COLUMN ${column} ${typeAndDefault}`);
        console.log(`  ➕ Coluna adicionada: ${column}`);
      } else {
        console.log(`  ✔️  Coluna já existe: ${column}`);
      }
    }

    await addColumnIfMissing('customers', 'email', 'TEXT');
    await addColumnIfMissing('customers', 'balance', 'REAL DEFAULT 0');
    await addColumnIfMissing('customers', 'status', "TEXT DEFAULT 'active'");
    await addColumnIfMissing('customers', 'createdAt', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
    await addColumnIfMissing('customers', 'updatedAt', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
    console.log('✅ Campos adicionados com sucesso!');
    // Mostrar estrutura atual da tabela
    const tableInfo = await prisma.$queryRawUnsafe(`PRAGMA table_info(customers)`);
    console.log('\n📋 Estrutura atual da tabela customers:');
    tableInfo.forEach(col => {
      console.log(`  - ${col.name} (${col.type})`);
    });
    // Contar registros
    const count = await prisma.customer.count();
    console.log(`\n👥 Total de clientes: ${count}`);
    // Mostrar alguns clientes
    const customers = await prisma.customer.findMany({ take: 3 });
    console.log('\n📄 Exemplo de clientes:');
    customers.forEach(c => {
      console.log(`  ID: ${c.id}, Phone: ${c.phone}, Name: ${c.fullName}`);
    });
  } catch (error) {
    console.error('❌ Erro na migração:', error);
  } finally {
    await prisma.$disconnect();
  }
}
migrateDatabase();
