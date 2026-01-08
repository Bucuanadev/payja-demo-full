const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function dump() {
  try {
    const customers = await prisma.customer.findMany({ take: 5, include: { loans: true } });
    console.log(JSON.stringify(customers, null, 2));
  } catch (e) {
    console.error('ERROR', e.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

dump();
