// Script para importar clientes do localStorage (JSON) para o banco Prisma do simulador
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const JSON_PATH = path.join(__dirname, '../simulator-customers.json');

async function importCustomers() {
    try {
        if (!fs.existsSync(JSON_PATH)) {
            console.error('Arquivo simulator-customers.json não encontrado. Exporte do frontend primeiro.');
            return;
        }
        const raw = fs.readFileSync(JSON_PATH, 'utf-8');
        const customers = JSON.parse(raw);
        let count = 0;
        for (const c of customers) {
            await prisma.customer.upsert({
                where: { phone: c.phoneNumber },
                update: {
                    fullName: c.registrationData?.name || '',
                    nuit: c.registrationData?.nuit || '',
                    status: c.status ? c.status.toUpperCase() : 'PENDING',
                    registrationDate: c.registrationData?.createdAt ? new Date(c.registrationData.createdAt) : new Date(),
                },
                create: {
                    phone: c.phoneNumber,
                    fullName: c.registrationData?.name || '',
                    nuit: c.registrationData?.nuit || '',
                    status: c.status ? c.status.toUpperCase() : 'PENDING',
                    registrationDate: c.registrationData?.createdAt ? new Date(c.registrationData.createdAt) : new Date(),
                }
            });
            count++;
        }
        console.log(`Importados ${count} clientes do simulator-customers.json para o Prisma.`);
    } catch (err) {
        console.error('Erro ao importar clientes:', err.message);
    } finally {
        await prisma.$disconnect();
    }
}

importCustomers();
