// Lista clientes do banco Prisma do simulador
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function listCustomers() {
    try {
        const customers = await prisma.customer.findMany();
        console.log(`Total de clientes: ${customers.length}`);
        customers.forEach(c => {
            console.log(`${c.id} | ${c.phone} | ${c.fullName} | ${c.nuit} | ${c.status}`);
        });
    } catch (err) {
        console.error('Erro ao listar clientes:', err.message);
    } finally {
        await prisma.$disconnect();
    }
}

listCustomers();
