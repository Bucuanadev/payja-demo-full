const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.bankPartner.updateMany({
    where: { code: 'GHW' },
    data: { apiUrl: 'http://localhost:4000' }
  });
  console.log('✓ Banco GHW atualizado:', result.count, 'registros');
  
  const bank = await prisma.bankPartner.findUnique({ where: { code: 'GHW' } });
  console.log('URL atual:', bank?.apiUrl);
}

main()
  .finally(() => prisma.$disconnect());
