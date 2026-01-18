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
  
  await prisma.admin.create({
    data: {
      email: 'admin@payja.co.mz',
      password: hashedPassword,
      name: 'Administrador Principal',
      role: 'SUPER_ADMIN',
      active: true,
    },
  });

  await prisma.admin.create({
    data: {
      email: 'operador@payja.co.mz',
      password: hashedPassword,
      name: 'Operador PayJA',
      role: 'OPERATOR',
      active: true,
    },
  });

  console.log('✅ Administradores criados');
  console.log('\n🎉 Seed concluído com sucesso!\n');
}

main()
  .catch((e) => {
    console.error('❌ Erro ao executar seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
