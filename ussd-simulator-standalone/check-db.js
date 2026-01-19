import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Checking database...');
  
  const customers = await prisma.customer.findMany();
  console.log(`Total customers: ${customers.length}`);
  
  if (customers.length > 0) {
    console.log('\nCustomers:');
    customers.forEach(c => {
      console.log(`- ${c.name} (${c.phoneNumber}) - Status: ${c.status}, Verified: ${c.verified}`);
    });
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);
