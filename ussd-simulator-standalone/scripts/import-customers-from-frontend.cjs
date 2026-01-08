// Script para importar clientes do frontend via API (igual ao banco PayJA)
const { PrismaClient } = require('@prisma/client');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const prisma = new PrismaClient();
const FRONTEND_URL = 'http://155.138.228.89:3001/customers.html'; // Ajuste se necessário
const LOCAL_API_URL = 'http://localhost:3002/api/customers-from-frontend';

async function importCustomersFromFrontend() {
    try {
        // Busca clientes do endpoint local do simulador (que já lê do localStorage via POST automático)
        const res = await fetch('http://localhost:3002/api/customers');
        if (!res.ok) throw new Error('Erro ao buscar clientes: ' + res.status);
        const data = await res.json();
        const customers = data.customers || [];
        let count = 0;
        for (const c of customers) {
            await prisma.customer.upsert({
                where: { phone: c.phone },
                update: {
                    fullName: c.fullName || '',
                    nuit: c.nuit || '',
                    status: c.status || 'PENDING',
                    registrationDate: c.registrationDate ? new Date(c.registrationDate) : new Date(),
                },
                create: {
                    phone: c.phone,
                    fullName: c.fullName || '',
                    nuit: c.nuit || '',
                    status: c.status || 'PENDING',
                    registrationDate: c.registrationDate ? new Date(c.registrationDate) : new Date(),
                }
            });
            count++;
        }
        console.log(`Importados ${count} clientes do frontend para o Prisma do simulador.`);
    } catch (err) {
        console.error('Erro ao importar clientes:', err.message);
    } finally {
        await prisma.$disconnect();
    }
}

importCustomersFromFrontend();
