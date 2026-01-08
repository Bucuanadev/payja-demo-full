// Exporta clientes do banco Prisma do simulador para um arquivo JSON
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function exportCustomers() {
    try {
        const customers = await prisma.customer.findMany();
        fs.writeFileSync('simulator-customers.json', JSON.stringify(customers, null, 2));
        console.log(`Exportados ${customers.length} clientes para simulator-customers.json`);
    } catch (err) {
        console.error('Erro ao exportar clientes:', err.message);
    } finally {
        await prisma.$disconnect();
    }
}

exportCustomers();
