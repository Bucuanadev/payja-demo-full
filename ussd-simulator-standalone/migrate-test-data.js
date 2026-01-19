import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Dados de teste - similares ao que estaria no localStorage
const testCustomers = [
  {
    phoneNumber: '875551234',
    name: 'dick nelson bucuana',
    nuit: '123456789',
    status: 'pending'
  },
  {
    phoneNumber: '875551235',
    name: 'dick',
    nuit: '123456789',
    status: 'pending'
  },
  {
    phoneNumber: '862345678',
    name: 'Maria Santos Machado',
    nuit: '100345678',
    status: 'pending'
  },
  {
    phoneNumber: '873456789',
    name: 'Carlos Alberto Mondlane',
    nuit: '100456789',
    status: 'pending'
  },
  {
    phoneNumber: '861234567',
    name: 'João Pedro da Silva',
    nuit: '100234567',
    status: 'pending'
  }
];

async function migrateCustomers() {
  console.log(`\nInserting ${testCustomers.length} test customers...`);
  
  for (const customer of testCustomers) {
    try {
      const id = crypto.randomUUID();
      await prisma.customer.create({
        data: {
          id,
          phoneNumber: customer.phoneNumber,
          name: customer.name,
          nuit: customer.nuit,
          verified: false,
          status: 'active',
          creditLimit: 0
        }
      });
      console.log(`✓ Created: ${customer.name} (${customer.phoneNumber})`);
    } catch (error) {
      console.error(`✗ Failed: ${customer.name}`, error.message);
    }
  }
  
  const allCustomers = await prisma.customer.findMany();
  console.log(`\nTotal customers in database: ${allCustomers.length}`);
  allCustomers.forEach(c => {
    console.log(`- ${c.phoneNumber} | ${c.name} | Status: ${c.status} | Verified: ${c.verified}`);
  });
  
  await prisma.$disconnect();
}

migrateCustomers().catch(console.error);
