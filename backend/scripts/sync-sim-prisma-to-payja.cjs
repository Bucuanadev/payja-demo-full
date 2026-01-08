// Script para o PayJA buscar clientes do banco Prisma do simulador e atualizar seu próprio banco e frontend
const { PrismaClient } = require('@prisma/client');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const payjaPrisma = new PrismaClient();
const SIMULATOR_API = 'http://localhost:3002/api/customers';

async function syncSimulatorToPayja() {
    try {
        const res = await fetch(SIMULATOR_API);
        if (!res.ok) throw new Error('Erro ao buscar clientes do simulador: ' + res.status);
        const data = await res.json();
        const customers = data.customers || [];
        let count = 0;
        for (const c of customers) {
            await payjaPrisma.customer.upsert({
                where: { phoneNumber: c.phoneNumber },
                update: {
                    name: c.name || '',
                    nuit: c.nuit || '',
                    status: c.status || 'PENDING',
                    registrationDate: c.registrationDate ? new Date(c.registrationDate) : new Date(),
                },
                create: {
                    phoneNumber: c.phoneNumber,
                    name: c.name || '',
                    nuit: c.nuit || '',
                    status: c.status || 'PENDING',
                    registrationDate: c.registrationDate ? new Date(c.registrationDate) : new Date(),
                }
            });
            count++;
        }
        console.log(`[PayJA Sync] ${new Date().toISOString()}: ${count} clientes sincronizados do simulador para o banco do PayJA.`);
    } catch (err) {
        console.error('Erro ao sincronizar clientes do simulador:', err.message);
    }
}

// Loop automático a cada 20 segundos
setInterval(syncSimulatorToPayja, 20000);
// Executa imediatamente ao iniciar
syncSimulatorToPayja();
