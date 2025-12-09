import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...');

  // Limpar dados existentes
  await prisma.auditLog.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.loan.deleteMany();
  await prisma.scoringResult.deleteMany();
  await prisma.ussdSession.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.admin.deleteMany();

  // Criar administradores
  const hashedPassword = await bcrypt.hash('admin123', 10);
  
  const admin = await prisma.admin.create({
    data: {
      email: 'admin@payja.co.mz',
      password: hashedPassword,
      name: 'Administrador Principal',
      role: 'SUPER_ADMIN',
      active: true,
    },
  });

  const operator = await prisma.admin.create({
    data: {
      email: 'operador@payja.co.mz',
      password: hashedPassword,
      name: 'Operador PayJA',
      role: 'OPERATOR',
      active: true,
    },
  });

  console.log('✅ Administradores criados');

  // Criar clientes
  const customers = await Promise.all([
    prisma.customer.create({
      data: {
        phoneNumber: '258840000001', // M-Pesa (Vodacom)
        name: 'João Silva',
        nuit: '100000001',
        district: 'Maputo',
        province: 'Maputo',
        verified: true,
      },
    }),
    prisma.customer.create({
      data: {
        phoneNumber: '258870000002', // e-Mola (Movitel)
        name: 'Maria Santos',
        nuit: '100000002',
        district: 'Beira',
        province: 'Sofala',
        verified: true,
      },
    }),
    prisma.customer.create({
      data: {
        phoneNumber: '258820000003', // Mkesh (mcel)
        name: 'Pedro Machado',
        nuit: '100000003',
        district: 'Nampula',
        province: 'Nampula',
        verified: false,
      },
    }),
  ]);

  console.log('✅ Clientes criados');

  // Criar empréstimos para João Silva (histórico bom)
  const loan1 = await prisma.loan.create({
    data: {
      customerId: customers[0].id,
      amount: 10000,
      interestRate: 15,
      termMonths: 6,
      purpose: 'Negócio',
      totalAmount: 10750,
      monthlyPayment: 1791.67,
      status: 'COMPLETED',
      approvedBy: admin.id,
      approvedAt: new Date('2024-06-01'),
      disbursedAt: new Date('2024-06-02'),
      dueDate: new Date('2024-12-02'),
    },
  });

  const scoring1 = await prisma.scoringResult.create({
    data: {
      customerId: customers[0].id,
      finalScore: 720,
      risk: 'LOW',
      factors: JSON.stringify({
        baseScore: 500,
        historyScore: 100,
        amountScore: 70,
        frequencyScore: 50,
        paymentHistoryScore: 100,
      }),
      decision: 'APPROVED',
      maxAmount: 30000,
    },
  });

  await prisma.loan.update({
    where: { id: loan1.id },
    data: { scoringId: scoring1.id },
  });

  // Criar empréstimo pendente para Maria Santos
  const loan2 = await prisma.loan.create({
    data: {
      customerId: customers[1].id,
      amount: 5000,
      interestRate: 15,
      termMonths: 3,
      purpose: 'Educação',
      totalAmount: 5187.5,
      monthlyPayment: 1729.17,
      status: 'ANALYZING',
      dueDate: new Date('2025-05-13'),
    },
  });

  const scoring2 = await prisma.scoringResult.create({
    data: {
      customerId: customers[1].id,
      finalScore: 650,
      risk: 'LOW',
      factors: JSON.stringify({
        baseScore: 400,
        historyScore: 0,
        amountScore: 90,
        frequencyScore: 50,
        paymentHistoryScore: 100,
      }),
      decision: 'APPROVED',
      maxAmount: 20000,
    },
  });

  await prisma.loan.update({
    where: { id: loan2.id },
    data: { scoringId: scoring2.id },
  });

  // Criar empréstimo pendente para Pedro Machado
  const loan3 = await prisma.loan.create({
    data: {
      customerId: customers[2].id,
      amount: 3000,
      interestRate: 15,
      termMonths: 3,
      purpose: 'Emergência',
      totalAmount: 3112.5,
      monthlyPayment: 1037.5,
      status: 'PENDING',
      dueDate: new Date('2025-05-13'),
    },
  });

  console.log('✅ Empréstimos criados');

  // Criar logs de auditoria
  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      userType: 'ADMIN',
      action: 'APPROVE_LOAN',
      entity: 'LOAN',
      entityId: loan1.id,
      changes: JSON.stringify({ status: 'APPROVED' }),
      ipAddress: '127.0.0.1',
    },
  });

  console.log('✅ Logs de auditoria criados');

  console.log('\n🎉 Seed concluído com sucesso!\n');
  console.log('📋 Credenciais de acesso:');
  console.log('   Email: admin@payja.co.mz');
  console.log('   Senha: admin123\n');
  console.log('📱 Números de teste USSD:');
  console.log('   258840000001 - João Silva (cliente verificado)');
  console.log('   258850000002 - Maria Santos (empréstimo pendente)');
  console.log('   258860000003 - Pedro Machado (novo cliente)\n');
}

main()
  .catch((e) => {
    console.error('❌ Erro ao executar seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
