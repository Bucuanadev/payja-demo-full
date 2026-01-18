import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:./dev.db'
    }
  }
});

async function checkCustomers() {
  console.log('Checking customers in PayJA backend...\n');
  
  const customers = await prisma.customer.findMany({
    select: {
      id: true,
      phoneNumber: true,
      name: true,
      nuit: true,
      verified: true,
      createdAt: true
    }
  });
  
  console.log(`Total customers: ${customers.length}\n`);
  customers.forEach(c => {
    console.log(`${c.phoneNumber} | ${c.name} | ${c.nuit} | Verified: ${c.verified}`);
  });
  
  await prisma.$disconnect();
}

checkCustomers().catch(console.error);
