const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Iniciando limpeza forçada de dados...');
    
    // Deletar em ordem de dependência
    const scoring = await prisma.scoringResult.deleteMany({});
    console.log(`- ${scoring.count} resultados de scoring removidos`);
    
    const installments = await prisma.loanInstallment.deleteMany({});
    console.log(`- ${installments.count} prestações removidas`);
    
    const loans = await prisma.loan.deleteMany({});
    console.log(`- ${loans.count} empréstimos removidos`);
    
    const customers = await prisma.customer.deleteMany({});
    console.log(`- ${customers.count} clientes removidos`);
    
    console.log('✓ Limpeza concluída com sucesso!');
  } catch (error) {
    console.error('Erro durante a limpeza:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
