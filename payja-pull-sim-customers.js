// Script para PayJA puxar clientes pendentes do simulador a cada 15 segundos
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const SIMULATOR_URL = 'http://localhost:3002/api/payja/ussd/new-customers';

async function pullCustomers() {
    try {
        const res = await fetch(SIMULATOR_URL);
        if (!res.ok) throw new Error('Erro ao buscar clientes: ' + res.status);
        const customers = await res.json();
        console.log(`[${new Date().toISOString()}] Clientes pendentes:`);
        console.table(customers);
        // Aqui você pode processar, salvar ou enviar para o PayJA conforme necessário
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Falha ao puxar clientes:`, err.message);
    }
}

setInterval(pullCustomers, 15000);
// Executa imediatamente ao iniciar
pullCustomers();
