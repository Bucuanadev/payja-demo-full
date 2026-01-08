// Script para importar clientes do simulador para o banco do PayJA
const { PrismaClient } = require('@prisma/client');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const prisma = new PrismaClient();
const SIMULATOR_URL = 'http://localhost:3002/api/payja/ussd/new-customers';

async function importCustomers() {
    try {
        const res = await fetch(SIMULATOR_URL);
        if (!res.ok) throw new Error('Erro ao buscar clientes: ' + res.status);
        const customers = await res.json();
        for (const c of customers) {
            // Adapta para o modelo do PayJA
            await prisma.customer.upsert({
                where: { phoneNumber: c.phoneNumber },
                update: {
                    name: c.name || '',
                    nuit: c.nuit || '',
                    biNumber: c.biNumber || '',
                    address: c.address || '',
                    province: c.province || '',
                    district: c.district || '',
                    status: 'PENDING',
                },
                create: {
                    phoneNumber: c.phoneNumber,
                    name: c.name || '',
                    nuit: c.nuit || '',
                    biNumber: c.biNumber || '',
                    address: c.address || '',
                    province: c.province || '',
                    district: c.district || '',
                    status: 'PENDING',
                }
            });
        }
        console.log(`Importados ${customers.length} clientes do simulador para o PayJA.`);
    } catch (err) {
        console.error('Erro ao importar clientes:', err.message);
    } finally {
        await prisma.$disconnect();
    }
}

importCustomers();
