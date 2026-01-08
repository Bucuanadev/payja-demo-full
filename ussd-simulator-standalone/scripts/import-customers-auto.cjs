// Script automático: exporta clientes do localStorage (via arquivo JSON) e importa para o banco Prisma do simulador
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const JSON_PATH = path.join(__dirname, '../simulator-customers.json');

async function importCustomers() {
    try {
        if (!fs.existsSync(JSON_PATH)) {
            console.log('Arquivo JSON não encontrado. Aguarde exportação do navegador...');
            return;
        }
        const customers = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
        let count = 0;
        for (const c of customers) {
            await prisma.customer.upsert({
                where: { phone: c.phoneNumber || c.phone },
                update: {
                    fullName: c.name || c.fullName || '',
                    nuit: c.nuit || '',
                    birthDate: c.birthDate ? new Date(c.birthDate) : null,
                    address: c.address || '',
                    district: c.district || '',
                    province: c.province || '',
                    status: c.status || 'PENDING',
                },
                create: {
                    phone: c.phoneNumber || c.phone,
                    fullName: c.name || c.fullName || '',
                    nuit: c.nuit || '',
                    birthDate: c.birthDate ? new Date(c.birthDate) : null,
                    address: c.address || '',
                    district: c.district || '',
                    province: c.province || '',
                    status: c.status || 'PENDING',
                }
            });
            count++;
        }
        console.log(`Importados ${count} clientes do JSON para o banco Prisma do simulador.`);
    } catch (err) {
        console.error('Erro ao importar clientes:', err.message);
    } finally {
        await prisma.$disconnect();
    }
}

// Executa a cada 30 segundos
setInterval(importCustomers, 30000);
// Executa imediatamente ao iniciar
importCustomers();
