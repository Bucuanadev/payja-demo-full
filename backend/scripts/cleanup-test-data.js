const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function cleanup() {
  try {
    console.log('🧹 Limpando dados de teste...\n');

    // Primeiro, buscar IDs de clientes de teste
    const testCustomers = await prisma.customer.findMany({
      where: {
        OR: [
          { phoneNumber: { startsWith: '25886' } },
          { nuit: '123456789' },
        ],
      },
      select: { id: true, phoneNumber: true, nuit: true },
    });

    if (testCustomers.length === 0) {
      console.log('✓ Nenhum dado de teste encontrado.');
      return;
    }

    console.log(`📋 Encontrados ${testCustomers.length} clientes de teste:`);
    testCustomers.forEach(c => console.log(`   - ${c.phoneNumber} (NUIT: ${c.nuit})`));
    console.log('');

    const customerIds = testCustomers.map(c => c.id);

    // Buscar IDs dos empréstimos
    const testLoans = await prisma.loan.findMany({
      where: { customerId: { in: customerIds } },
      select: { id: true },
    });
    const loanIds = testLoans.map(l => l.id);

    // 1. Deletar installments relacionados aos empréstimos
    const installments = await prisma.installment.deleteMany({
      where: {
        loanId: { in: loanIds },
      },
    });
    console.log(`✓ ${installments.count} parcelas removidas`);

    // 2. Deletar transações relacionadas aos empréstimos
    const transactions = await prisma.transaction.deleteMany({
      where: {
        loanId: { in: loanIds },
      },
    });
    console.log(`✓ ${transactions.count} transações removidas`);

    // 3. Deletar pagamentos relacionados aos empréstimos
    const payments = await prisma.payment.deleteMany({
      where: {
        loanId: { in: loanIds },
      },
    });
    console.log(`✓ ${payments.count} pagamentos removidos`);

    // 4. Deletar empréstimos
    const loans = await prisma.loan.deleteMany({
      where: {
        customerId: { in: customerIds },
      },
    });
    console.log(`✓ ${loans.count} empréstimos removidos`);

    // 5. Deletar scoring results
    const scoring = await prisma.scoringResult.deleteMany({
      where: {
        customerId: { in: customerIds },
      },
    });
    console.log(`✓ ${scoring.count} resultados de scoring removidos`);

    // 6. Deletar sessões USSD de teste
    const sessions = await prisma.ussdSession.deleteMany({
      where: {
        OR: [
          { phoneNumber: { startsWith: '25886' } },
          { customerId: { in: customerIds } },
        ],
      },
    });
    console.log(`✓ ${sessions.count} sessões USSD removidas`);

    // 7. Deletar SMS de teste
    const sms = await prisma.smsLog.deleteMany({
      where: {
        phoneNumber: { startsWith: '25886' },
      },
    });
    console.log(`✓ ${sms.count} SMS removidos`);

    // 8. Finalmente, deletar clientes de teste
    const customers = await prisma.customer.deleteMany({
      where: {
        id: { in: customerIds },
      },
    });
    console.log(`✓ ${customers.count} clientes removidos`);

    console.log('\n✅ Limpeza concluída!');
    console.log('💡 Agora você pode testar o fluxo de registro completo.\n');
  } catch (error) {
    console.error('❌ Erro na limpeza:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

cleanup();
