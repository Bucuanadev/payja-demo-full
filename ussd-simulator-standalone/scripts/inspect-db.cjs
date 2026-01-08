const prisma = require('../src/prismaClient.cjs');
(async () => {
  try {
    const cols = await prisma.$queryRaw`PRAGMA table_info(customers)`;
    console.log('columns:', cols);
    const indexes = await prisma.$queryRaw`PRAGMA index_list(customers)`;
    console.log('indexes:', indexes);
    for (const idx of indexes) {
      const info = await prisma.$queryRaw`PRAGMA index_info(${idx.name})`;
      console.log(`index ${idx.name} info:`, info);
    }
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();