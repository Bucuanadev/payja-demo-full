const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const nuit = '100678901';
  const customer = await prisma.customer.findUnique({ where: { nuit } });
  
  if (customer) {
    console.log(`Fixing customer: ${customer.name}`);
    
    // Update customer verified status
    await prisma.customer.update({
      where: { id: customer.id },
      data: { verified: false, creditLimit: 0 }
    });
    
    // Update scoring result
    await prisma.scoringResult.updateMany({
      where: { customerId: customer.id },
      data: {
        decision: 'REJECTED',
        risk: 'HIGH',
        maxAmount: 0,
        factors: JSON.stringify({
          bankReason: "Cliente INCUMPRIDOR (Lista Negra)",
          isAccountActive: true,
          isBiValid: true,
          status_credito: "INCUMPRIDOR",
          isIncumpridor: true,
          hasMinimumAccountAge: true,
          hasSalaryDomiciliation: true,
          effortRate: "10.00",
          hasAcceptableEffortRate: true,
          hasExcessiveDebt: false,
          salary: 42000,
          monthlyCommitment: 4200,
          totalDebt: 15000
        })
      }
    });
    console.log('Fixed successfully');
  } else {
    console.log('Customer not found');
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
