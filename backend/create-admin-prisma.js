// Script para criar admin usando Prisma Client do backend
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Criando admin no PayJA...');
  
  const admins = [
    { email: 'admin@payja.mz', password: 'PayJA@2024', name: 'Administrador PayJA', role: 'SUPER_ADMIN' },
    { email: 'admin@admin.com', password: 'admin123', name: 'Admin', role: 'SUPER_ADMIN' },
    { email: 'payja@payja.mz', password: 'payja2024', name: 'PayJA Admin', role: 'ADMIN' },
  ];
  
  for (const a of admins) {
    try {
      // Apagar se já existir
      await prisma.admin.deleteMany({ where: { email: a.email } });
      
      const hashedPassword = await bcrypt.hash(a.password, 10);
      
      const admin = await prisma.admin.create({
        data: {
          email: a.email,
          password: hashedPassword,
          name: a.name,
          role: a.role,
          active: true,
        },
        select: { id: true, email: true, name: true, role: true, active: true }
      });
      
      console.log(`✅ Admin criado: ${admin.email} (${admin.role})`);
      console.log(`   Password: ${a.password}`);
    } catch (err) {
      console.error(`❌ Erro ao criar ${a.email}:`, err.message);
    }
  }
  
  // Listar todos os admins
  const all = await prisma.admin.findMany({
    select: { email: true, name: true, role: true, active: true }
  });
  console.log('\n📋 Todos os admins:', JSON.stringify(all, null, 2));
  
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
